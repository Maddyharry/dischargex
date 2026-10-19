import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { deidentify } from "@/lib/deidentify";
import { estimateActualApiCostThbFromLedgerRows } from "@/lib/api-cost";
import { getBoostAdminStatus } from "@/lib/stripe-boost-payment";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const PRIVATE_NO_STORE = { "Cache-Control": "private, no-store, max-age=0" };

function isAdmin(session: unknown) {
  return (session as { user?: { role?: string } } | null)?.user?.role === "admin";
}

function safePayload(payload: string | null) {
  if (!payload) return {};
  try {
    const parsed: unknown = JSON.parse(payload);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

function safeText(value: unknown, max = 1200): string | null {
  if (typeof value !== "string" || !value.trim()) return null;
  return deidentify(value).slice(0, max);
}

export async function GET(req: Request, context: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!isAdmin(session)) {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403, headers: PRIVATE_NO_STORE });
  }

  try {
    const { id: userId } = await context.params;
    if (!userId) return NextResponse.json({ ok: false, error: "Missing user id" }, { status: 400, headers: PRIVATE_NO_STORE });
    const url = new URL(req.url);
    const requestedLimit = Number(url.searchParams.get("limit") ?? 20);
    const limit = Number.isFinite(requestedLimit) ? Math.min(30, Math.max(1, Math.floor(requestedLimit))) : 20;
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
    if (!user) return NextResponse.json({ ok: false, error: "User not found" }, { status: 404, headers: PRIVATE_NO_STORE });

    const [usageLogs, ledger, feedback, addonPayments] = await Promise.all([
      prisma.usageLog.findMany({
        where: { userId }, orderBy: { createdAt: "desc" }, take: limit,
        select: { id: true, createdAt: true, reason: true, creditsUsed: true, baseCreditsUsed: true, addonCreditsUsed: true, caseId: true, summarySnapshot: true },
      }),
      prisma.tokenUsageLedger.findMany({
        where: { userId, source: { in: ["summary_provider_call", "summary_image_ocr", "summary_generate", "summary_recalc"] } }, orderBy: { createdAt: "desc" }, take: limit,
        select: { id: true, createdAt: true, source: true, model: true, inputTokens: true, outputTokens: true, totalTokens: true, estimatedCostThb: true, referenceId: true },
      }),
      prisma.feedback.findMany({
        where: { userId, type: { in: ["summary_job", "error_report"] } }, orderBy: { createdAt: "desc" }, take: limit,
        select: { id: true, createdAt: true, type: true, message: true, status: true, category: true, shortSummary: true, pageOrFeature: true, reproducibleSteps: true, impactLevel: true, aiScore: true, payload: true },
      }),
      prisma.paymentRequest.findMany({
        where: { userId, type: "addon" }, orderBy: { createdAt: "desc" }, take: limit,
        select: { type: true, status: true, addCredits: true, finalAmount: true, createdAt: true, entitlementAppliedAt: true, reviewedBy: true, stripePaymentIntentId: true },
      }),
    ]);

    const activities = [
      ...usageLogs.map((row) => {
        const summaryText = safeText(row.summarySnapshot, 12_000);
        return {
          id: `usage:${row.id}`, kind: "summary" as const, createdAt: row.createdAt.toISOString(),
          reason: safeText(row.reason, 100), creditsUsed: row.creditsUsed, baseCreditsUsed: row.baseCreditsUsed,
          addonCreditsUsed: row.addonCreditsUsed, caseId: safeText(row.caseId, 120), summaryText,
          snapshotAvailable: Boolean(row.summarySnapshot),
          summaryTextTruncated: Boolean(row.summarySnapshot && deidentify(row.summarySnapshot).length > 12_000),
        };
      }),
      ...ledger.map((row) => {
        const apiEstimate = estimateActualApiCostThbFromLedgerRows([{
          model: row.model ?? "", source: row.source, referenceId: row.referenceId,
          inputTokens: row.inputTokens, outputTokens: row.outputTokens, totalTokens: row.totalTokens,
        }]);
        return {
          id: `ledger:${row.id}`, kind: "token_usage" as const, createdAt: row.createdAt.toISOString(),
          source: safeText(row.source, 100), model: safeText(row.model, 100), inputTokens: row.inputTokens,
          outputTokens: row.outputTokens, totalTokens: row.totalTokens,
          estimatedCostThb: row.estimatedCostThb === null ? null : Number(row.estimatedCostThb),
          actualApiCostEstimateStatus: apiEstimate.status,
          actualApiCostEstimateThb: apiEstimate.estimatedCostThb,
          actualApiCostUncertainty: apiEstimate.uncertainty,
          referenceId: safeText(row.referenceId, 120),
        };
      }),
      ...feedback.map((row) => {
        const metadata = safePayload(row.payload);
        const warnings = Array.isArray(metadata.warnings)
          ? metadata.warnings.slice(0, 8).flatMap((warning) => {
              const text = safeText(warning, 300);
              return text ? [text] : [];
            })
          : null;
        const diagnosisConfidence = typeof metadata.diagnosisConfidence === "number" || typeof metadata.diagnosisConfidence === "string"
          ? safeText(String(metadata.diagnosisConfidence), 40)
          : null;
        const candidateErrorCode = typeof metadata.errorCode === "string" ? metadata.errorCode : metadata.code;
        const genericErrorCode = typeof candidateErrorCode === "string" && /^[A-Z0-9_:-]{1,64}$/.test(candidateErrorCode)
          ? candidateErrorCode
          : null;
        const privacyMetadata = metadata.privacy && typeof metadata.privacy === "object" && !Array.isArray(metadata.privacy)
          ? metadata.privacy as Record<string, unknown>
          : {};
        const privacy = typeof metadata.privacy === "string" ? safeText(metadata.privacy, 100) : null;
        return {
          id: `feedback:${row.id}`, kind: row.type as "summary_job" | "error_report", createdAt: row.createdAt.toISOString(),
          status: safeText(row.status, 100), message: row.type === "summary_job" && row.status === "failed" ? null : safeText(row.message, 1000), category: safeText(row.category, 100),
          shortSummary: safeText(row.shortSummary, 500), pageOrFeature: safeText(row.pageOrFeature, 200),
          reproducibleSteps: safeText(row.reproducibleSteps, 1000), impactLevel: safeText(row.impactLevel, 100),
          aiScore: row.aiScore, issueFlagIsAutomatedSuggestion: row.aiScore != null,
          durationMs: Number.isFinite(metadata.durationMs) ? metadata.durationMs : null,
          warningCount: Number.isFinite(metadata.warningCount) ? metadata.warningCount : null,
          warnings, diagnosisConfidence, privacy, errorCode: genericErrorCode,
          textRedactionApplied: typeof privacyMetadata.textRedactionApplied === "boolean" ? privacyMetadata.textRedactionApplied : null,
          imageRedactionConfirmed: typeof privacyMetadata.imageRedactionConfirmed === "boolean" ? privacyMetadata.imageRedactionConfirmed : null,
          imageContentVerified: typeof privacyMetadata.imageContentVerified === "boolean" ? privacyMetadata.imageContentVerified : null,
        };
      }),
      ...addonPayments.map((row, index) => ({
        id: `boost_purchase:${row.createdAt.toISOString()}:${index}`,
        kind: "boost_purchase" as const,
        createdAt: row.createdAt.toISOString(),
        type: row.type,
        status: getBoostAdminStatus(row),
        addCredits: row.addCredits,
        finalAmount: row.finalAmount,
      })),
    ].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, limit);

    return NextResponse.json({ ok: true, limit, activities }, { headers: PRIVATE_NO_STORE });
  } catch {
    return NextResponse.json({ ok: false, error: "โหลดกิจกรรมไม่สำเร็จ" }, { status: 500, headers: PRIVATE_NO_STORE });
  }
}
