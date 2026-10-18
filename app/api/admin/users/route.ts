import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  daysLeftUntil,
  getDailyApproxLimit,
  getCreditCycleBounds,
  getPeriodBounds,
  getPlanDefinition,
  isPaidPlan,
  normalizePlanId,
} from "@/lib/billing-rules";
import { getPlanTokenBudgetThb } from "@/lib/token-billing";
import { getUsagePolicySnapshot, selectUsagePolicyLedgerRows, type UsagePolicyLedgerRow } from "@/lib/usage-policy";
import {
  EFFECTIVE_FROM,
  forecastRevenue5xPeriodCostCapThb,
  isRevenue5xEligible,
} from "@/lib/api-cost";

export const runtime = "nodejs";
const PRIVATE_NO_STORE = { "Cache-Control": "private, no-store, max-age=0" };

function isAdmin(session: unknown) {
  return (session as { user?: { role?: string } } | null)?.user?.role === "admin";
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!isAdmin(session)) {
      return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403, headers: PRIVATE_NO_STORE });
    }

    const now = new Date();
    const dayStart = new Date(now);
    dayStart.setHours(0, 0, 0, 0);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const summaryReasons = ["generate", "long_case_generate", "token_generate"];
    const users = await prisma.user.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        email: true,
        name: true,
        plan: true,
        role: true,
        subscriptionStatus: true,
        totalGenerations: true,
        createdAt: true,
        periodStartedAt: true,
        subscriptionExpiresAt: true,
        extraCredits: true,
        _count: { select: { deviceSessions: true } },
      },
    });

    type UserRow = (typeof users)[number];
    const successfulAddonPayments = (await prisma.paymentRequest.findMany({
      where: { type: "addon", entitlementAppliedAt: { not: null } },
      select: { userId: true, addCredits: true, finalAmount: true, createdAt: true, entitlementAppliedAt: true },
    })).filter((payment) => payment.entitlementAppliedAt !== null);
    const addonUseTotals = await prisma.usageLog.aggregate({
      where: { addonCreditsUsed: { gt: 0 } },
      _sum: { addonCreditsUsed: true },
    });
    const list = await Promise.all(
      users.map(async (u: UserRow) => {
        const normalizedPlanId = normalizePlanId(u.plan);
        const planDefinition = getPlanDefinition(normalizedPlanId);
        const planTotal = planDefinition.creditsPerCycle;
        const periodStartDate = u.periodStartedAt ?? u.createdAt;
        const paidPlan = isPaidPlan(normalizedPlanId);
        const paidSubscriptionActive = u.subscriptionStatus === "active" || u.subscriptionStatus === "pending_change";
        const revenue5xEligible = paidPlan && paidSubscriptionActive && isRevenue5xEligible(u.periodStartedAt);
        const revenue5xPolicyMode = paidPlan && isRevenue5xEligible(u.periodStartedAt);
        const nextRenewalCapForecastThb = paidPlan ? forecastRevenue5xPeriodCostCapThb(planDefinition.priceThb) : null;
        const { start: periodStart, end: fallbackPeriodEnd } = getPeriodBounds(periodStartDate, normalizedPlanId);
        const periodEnd = u.subscriptionExpiresAt ?? fallbackPeriodEnd;
        const isExpired = now.getTime() > periodEnd.getTime();
        const { cycleStart, cycleEnd } = getCreditCycleBounds(periodStart, normalizedPlanId, now);
        const cycleWindowEnd = cycleEnd.getTime() > periodEnd.getTime() ? periodEnd : cycleEnd;
        const usedInPeriod = isExpired
          ? 0
          : (await prisma.usageLog.aggregate({
              _sum: { baseCreditsUsed: true },
              where: {
                userId: u.id,
                createdAt: { gte: cycleStart, lte: cycleWindowEnd },
              },
            }))._sum.baseCreditsUsed ?? 0;
        const costWindowStart = revenue5xPolicyMode ? periodStartDate : monthStart;
        const [summariesToday, summariesThisMonth, lifetimeSummaries, addonUse] = await Promise.all([
          prisma.usageLog.count({
            where: { userId: u.id, reason: { in: summaryReasons }, createdAt: { gte: dayStart, lt: new Date(dayStart.getTime() + 24 * 60 * 60 * 1000) } },
          }),
          prisma.usageLog.count({ where: { userId: u.id, reason: { in: summaryReasons }, createdAt: { gte: monthStart, lt: monthEnd } } }),
          prisma.usageLog.count({ where: { userId: u.id, reason: { in: summaryReasons } } }),
          prisma.usageLog.aggregate({ where: { userId: u.id, addonCreditsUsed: { gt: 0 } }, _sum: { addonCreditsUsed: true }, _max: { createdAt: true } }),
        ]);
        const userAddonPayments = successfulAddonPayments.filter((payment) => payment.userId === u.id);
        const purchasedPasses = userAddonPayments.reduce((sum, payment) => sum + (payment.addCredits ?? 0), 0);
        const addonRevenue = userAddonPayments.reduce((sum, payment) => sum + (payment.finalAmount ?? 0), 0);
        let tokenLedgerRows: UsagePolicyLedgerRow[] | null = null;
        try {
          const queriedLedgerRows = await prisma.tokenUsageLedger.findMany({
            where: { userId: u.id, createdAt: { gte: costWindowStart, lte: now } },
            select: { createdAt: true, model: true, inputTokens: true, outputTokens: true, totalTokens: true, estimatedCostThb: true, source: true, referenceId: true },
          });
          tokenLedgerRows = queriedLedgerRows.map((row) => ({
            createdAt: row.createdAt, model: row.model, inputTokens: row.inputTokens,
            outputTokens: row.outputTokens, totalTokens: row.totalTokens,
            estimatedCostThb: row.estimatedCostThb === null ? null : Number(row.estimatedCostThb),
            source: row.source, referenceId: row.referenceId,
          }));
        } catch {
          // The snapshot receives null and reports unknown rather than treating a failed read as zero usage.
        }
        const daysLeft = isExpired ? 0 : daysLeftUntil(periodEnd, now);
        const policy = getUsagePolicySnapshot({
          planId: normalizedPlanId,
          subscriptionStatus: u.subscriptionStatus,
          periodStartedAt: u.periodStartedAt,
          expiresAt: periodEnd,
          legacyCalendarMonthCapThb: getPlanTokenBudgetThb(normalizedPlanId),
          ledgerRows: tokenLedgerRows,
        }, now);
        const apiCostEstimate = policy.actualApiCostEstimate;
        const apiCostRowCount = tokenLedgerRows === null ? null : selectUsagePolicyLedgerRows(tokenLedgerRows, policy.mode).length;
        return {
          id: u.id,
          email: u.email,
          name: u.name,
          plan: u.plan,
          role: u.role,
          totalGenerations: u.totalGenerations,
          usageCount: usedInPeriod,
          planTotal,
          summariesToday,
          dailySummaryLimit: getDailyApproxLimit(normalizedPlanId).summaryPerDay,
          boostPassesRemaining: u.extraCredits,
          boostPassesPurchased: purchasedPasses,
          boostPurchaseCount: userAddonPayments.length,
          boostPurchaseRevenue: addonRevenue,
          boostPassesConsumed: addonUse._sum.addonCreditsUsed ?? 0,
          boostLastPurchaseAt: userAddonPayments.length ? userAddonPayments.reduce((latest, payment) => payment.createdAt > latest ? payment.createdAt : latest, userAddonPayments[0].createdAt).toISOString() : null,
          boostLastUsedAt: addonUse._max.createdAt?.toISOString() ?? null,
          summariesThisMonth,
          lifetimeSummaries,
          apiCostEstimateStatus: apiCostEstimate.status,
          apiCostEstimateThb: apiCostEstimate.estimatedCostThb,
          apiCostKnownSubtotalThb: apiCostEstimate.knownSubtotalThb,
          apiCostUnknownModelCount: apiCostEstimate.unknownModelCount,
          apiCostInvalidRowCount: apiCostEstimate.invalidRowCount,
          apiCostRowCount,
          apiCostUncertainty: apiCostEstimate.uncertainty,
          revenue5xEligible,
          revenue5xEffectiveFrom: EFFECTIVE_FROM,
          currentApiCostCapThb: policy.capThb,
          currentApiCostCapKind: policy.mode,
          currentApiCostWindow: revenue5xPolicyMode ? "billing_period_to_date" : paidPlan ? "legacy_calendar_month_to_date" : "calendar_month_to_date",
          apiCostSafeForEnforcement: apiCostEstimate.safeForEnforcement,
          policySpendThb: policy.spendThb,
          policyRemainingThb: policy.remainingThb,
          policyStatus: policy.status,
          policyAllowed: policy.allowed,
          policyResetAt: policy.resetAt,
          usagePolicySpendBasis: policy.costEstimate.basis,
          currentPeriodEndsAt: periodEnd.toISOString(),
          dailyUsageResetsAt: new Date(dayStart.getTime() + 24 * 60 * 60 * 1000).toISOString(),
          monthlyUsageResetsAt: monthEnd.toISOString(),
          nextRenewalCapForecastThb,
          daysLeftInMonth: daysLeft,
          deviceCount: u._count.deviceSessions,
          createdAt: u.createdAt.toISOString(),
        };
      })
    );

    const boostOverview = {
      successfulPurchases: successfulAddonPayments.length,
      passesSold: successfulAddonPayments.reduce((sum, payment) => sum + (payment.addCredits ?? 0), 0),
      revenueThb: successfulAddonPayments.reduce((sum, payment) => sum + (payment.finalAmount ?? 0), 0),
      passesRemaining: users.reduce((sum: number, row: UserRow) => sum + row.extraCredits, 0),
      passesConsumed: addonUseTotals._sum.addonCreditsUsed ?? 0,
    };
    return NextResponse.json({ ok: true, users: list, boostOverview }, { headers: PRIVATE_NO_STORE });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "โหลดรายการไม่สำเร็จ";
    return NextResponse.json({ ok: false, error: String(message) }, { status: 500, headers: PRIVATE_NO_STORE });
  }
}

export async function PATCH(req: Request) {
  const session = await getServerSession(authOptions);
  if (!isAdmin(session)) {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = (await req.json()) as { userId: string; plan?: string; role?: string };
    const { userId, plan, role } = body;

    if (!userId) {
      return NextResponse.json({ ok: false, error: "Missing userId" }, { status: 400 });
    }

    const data: {
      plan?: string;
      role?: string;
      subscriptionStatus?: string;
      periodStartedAt?: Date | null;
      subscriptionExpiresAt?: Date | null;
      currentCreditCycleStart?: Date | null;
      currentCreditCycleEnd?: Date | null;
      nextCreditRefreshAt?: Date | null;
      nextPlanId?: string | null;
      nextPlanEffectiveDate?: Date | null;
    } = {};
    if (
      typeof plan === "string" &&
      [
        "trial",
        "basic",
        "standard",
        "pro",
        "basic_monthly",
        "basic_yearly",
        "standard_monthly",
        "standard_yearly",
        "pro_monthly",
        "pro_yearly",
      ].includes(plan)
    ) {
      data.plan = plan;
      // Keep subscription fields consistent when admin changes plan manually.
      const normalized = normalizePlanId(plan);
      const now = new Date();
      if (!isPaidPlan(normalized) || normalized === "trial") {
        data.subscriptionStatus = "trial";
        data.periodStartedAt = null;
        data.subscriptionExpiresAt = null;
        data.currentCreditCycleStart = null;
        data.currentCreditCycleEnd = null;
        data.nextCreditRefreshAt = null;
        data.nextPlanId = null;
        data.nextPlanEffectiveDate = null;
      } else {
        const periodStartedAt = now;
        const { end: expiresAt } = getPeriodBounds(periodStartedAt, normalized);
        const { cycleStart, cycleEnd } = getCreditCycleBounds(periodStartedAt, normalized, now);
        const cycleEndLimited = cycleEnd.getTime() > expiresAt.getTime() ? expiresAt : cycleEnd;
        data.subscriptionStatus = "active";
        data.periodStartedAt = periodStartedAt;
        data.subscriptionExpiresAt = expiresAt;
        data.currentCreditCycleStart = cycleStart;
        data.currentCreditCycleEnd = cycleEndLimited;
        data.nextCreditRefreshAt =
          cycleEndLimited.getTime() < expiresAt.getTime() ? cycleEndLimited : null;
        data.nextPlanId = null;
        data.nextPlanEffectiveDate = null;
      }
    }
    if (typeof role === "string" && ["user", "admin"].includes(role)) {
      data.role = role;
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ ok: false, error: "No valid plan or role to update" }, { status: 400 });
    }

    const user = await prisma.user.update({
      where: { id: userId },
      data,
    });

    return NextResponse.json({ ok: true, user: { id: user.id, plan: user.plan, role: user.role } });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal Server Error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  const session = await getServerSession(authOptions);
  if (!isAdmin(session)) {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = (await req.json()) as { userId: string };
    const { userId } = body;
    if (!userId) {
      return NextResponse.json({ ok: false, error: "Missing userId" }, { status: 400 });
    }

    const email = (session as { user?: { email?: string } })?.user?.email;
    if (email) {
      const me = await prisma.user.findUnique({
        where: { email },
        select: { id: true },
      });
      if (me?.id === userId) {
        return NextResponse.json(
          { ok: false, error: "ไม่สามารถลบบัญชีของตัวเองได้" },
          { status: 400 }
        );
      }
    }

    await prisma.user.delete({
      where: { id: userId },
    });
    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal Server Error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
