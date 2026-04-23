import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sendAdminAlertEmail } from "@/lib/admin-alert";

export const runtime = "nodejs";

const AUTO_IMPROVE_KEY = "ai_auto_improve_last_run_v1";

function isAdmin(session: unknown) {
  return (session as { user?: { role?: string } } | null)?.user?.role === "admin";
}

function allowCron(req: NextRequest) {
  const secret = String(process.env.AUTO_IMPROVE_CRON_SECRET || process.env.CRON_SECRET || "").trim();
  const auth = String(req.headers.get("authorization") || "");
  if (secret && (req.headers.get("x-cron-secret") === secret || auth === `Bearer ${secret}`)) return true;
  // Vercel cron sends this header; rely on edge/network auth if no secret is configured yet.
  return Boolean(req.headers.get("x-vercel-cron"));
}

export async function GET() {
  const row = await prisma.appSetting.findUnique({ where: { key: AUTO_IMPROVE_KEY } });
  if (!row?.value) return NextResponse.json({ ok: true, lastRun: null });
  try {
    return NextResponse.json({ ok: true, lastRun: JSON.parse(row.value) });
  } catch {
    return NextResponse.json({ ok: true, lastRun: null });
  }
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!isAdmin(session) && !allowCron(req)) {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }

  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const rows = await prisma.feedback.findMany({
    where: { type: "telemetry", createdAt: { gte: since } },
    orderBy: { createdAt: "desc" },
    take: 6000,
    select: { message: true, payload: true },
  });
  const tokenRows = await prisma.tokenUsageLedger.findMany({
    where: { createdAt: { gte: since } },
    select: { source: true, estimatedCostThb: true },
    take: 6000,
  });

  let helpful = 0;
  let notHelpful = 0;
  const rejectReasons: Record<string, number> = {};
  for (const row of rows) {
    if (row.message === "specialist_chat_feedback:helpful") helpful += 1;
    if (row.message.startsWith("specialist_chat_feedback:not_helpful")) {
      notHelpful += 1;
      const reason = row.message.split(":")[2] || "unspecified";
      rejectReasons[reason] = (rejectReasons[reason] || 0) + 1;
    }
  }
  const totalRated = helpful + notHelpful;
  const acceptanceRate = totalRated > 0 ? helpful / totalRated : 0;
  const totalTokenCostThb = tokenRows.reduce((sum, row) => sum + Number(row.estimatedCostThb || 0), 0);
  const topReasons = Object.entries(rejectReasons)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  const suggestedActions = [
    acceptanceRate < 0.7 ? "ลด verbosity และบังคับตอบรูปแบบ 'วินิจฉัยก่อน + ICD'" : null,
    topReasons.some(([r]) => r === "insufficient_evidence") ? "เพิ่ม retrieval จาก whitelist ให้ครอบคลุมเคสนอกคลัง" : null,
    topReasons.some(([r]) => r === "not_specific") ? "เพิ่ม prompt ให้บอกเกณฑ์ขั้นต่ำและ next test แบบเฉพาะเคส" : null,
    totalTokenCostThb > 200 ? "ปรับ default เป็น Fast mode และจำกัด context/history ใน chat API" : null,
  ].filter(Boolean) as string[];

  const run = {
    generatedAt: new Date().toISOString(),
    periodDays: 7,
    helpful,
    notHelpful,
    acceptanceRate,
    tokenCostThb: Number(totalTokenCostThb.toFixed(2)),
    topRejectReasons: topReasons.map(([reason, count]) => ({ reason, count })),
    suggestedActions,
  };

  await prisma.appSetting.upsert({
    where: { key: AUTO_IMPROVE_KEY },
    create: { key: AUTO_IMPROVE_KEY, value: JSON.stringify(run) },
    update: { value: JSON.stringify(run) },
  });

  await sendAdminAlertEmail({
    subject: "DischargeX: 7-day AI auto-improvement digest",
    lines: [
      `Acceptance rate: ${(acceptanceRate * 100).toFixed(1)}%`,
      `Helpful: ${helpful}`,
      `Not helpful: ${notHelpful}`,
      `Token cost (7d): ${totalTokenCostThb.toFixed(2)} THB`,
      `Top reject reasons: ${topReasons.map(([reason, count]) => `${reason}(${count})`).join(", ") || "-"}`,
      ...suggestedActions.map((x) => `Suggested action: ${x}`),
      "Review details at /admin/telemetry",
    ],
  });

  return NextResponse.json({ ok: true, run });
}
