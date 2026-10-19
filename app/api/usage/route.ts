import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  daysLeftUntil,
  getCreditCycleBounds,
  getDailyApproxLimit,
  getPeriodBounds,
  getPlanDefinition,
  isPaidPlan,
  normalizePlanId,
} from "@/lib/billing-rules";
import { applyScheduledPlanChangeIfDue } from "@/lib/subscription-switch";
import { getPlanTokenBudgetThb } from "@/lib/token-billing";
import { isRevenue5xEligible } from "@/lib/api-cost";
import { getUsagePolicySnapshot, type UsagePolicyLedgerRow } from "@/lib/usage-policy";
import { resolveEmailFromBearerToken } from "@/lib/api-token";

export const runtime = "nodejs";

export async function GET(req: Request) {
  try {
    return withPrivateNoStore(await getUsage(req));
  } catch {
    return withPrivateNoStore(NextResponse.json(
      { ok: false, error: "Usage data is temporarily unavailable" },
      { status: 500 },
    ));
  }
}

function withPrivateNoStore(response: NextResponse): NextResponse {
  response.headers.set("Cache-Control", "private, no-store, max-age=0");
  return response;
}

async function getUsage(req: Request) {
  const bearerEmail = await resolveEmailFromBearerToken(req);
  const session = bearerEmail ? null : await getServerSession(authOptions);
  const email = bearerEmail || session?.user?.email;
  if (!email) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  const now = new Date();

  let dbUser = await prisma.user.findUnique({
    where: { email },
    select: {
      id: true,
      role: true,
      plan: true,
      extraCredits: true,
      createdAt: true,
      periodStartedAt: true,
      subscriptionStatus: true,
      subscriptionExpiresAt: true,
      nextPlanId: true,
      nextPlanEffectiveDate: true,
    },
  });

  if (dbUser?.id) {
    await applyScheduledPlanChangeIfDue(dbUser.id, now);
    dbUser = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        role: true,
        plan: true,
        extraCredits: true,
        createdAt: true,
        periodStartedAt: true,
        subscriptionStatus: true,
        subscriptionExpiresAt: true,
        nextPlanId: true,
        nextPlanEffectiveDate: true,
      },
    });
  }

  const normalizedPlanId = normalizePlanId(
    dbUser?.plan ?? (session?.user as { plan?: string } | null | undefined)?.plan ?? "trial"
  );
  const plan = getPlanDefinition(normalizedPlanId);
  const extraCredits = dbUser?.extraCredits ?? 0;

  const periodStartDate = dbUser?.periodStartedAt ?? dbUser?.createdAt ?? now;
  const { start: periodStart, end: fallbackPeriodEnd } = getPeriodBounds(periodStartDate, normalizedPlanId);
  const periodEnd = dbUser?.subscriptionExpiresAt ?? fallbackPeriodEnd;
  const isExpired = now.getTime() >= periodEnd.getTime();
  const isActive =
    !isExpired &&
    (dbUser?.subscriptionStatus === "active" ||
      dbUser?.subscriptionStatus === "pending_change" ||
      (normalizedPlanId === "trial" && !isPaidPlan(normalizedPlanId)));

  const { cycleStart, cycleEnd } = getCreditCycleBounds(periodStart, normalizedPlanId, now);
  const cycleWindowEnd = cycleEnd.getTime() > periodEnd.getTime() ? periodEnd : cycleEnd;
  const usedBaseInCycle =
    dbUser?.id != null
      ? await prisma.usageLog.aggregate({
          _sum: { baseCreditsUsed: true },
          where: {
            userId: dbUser.id,
            createdAt: { gte: cycleStart, lte: cycleWindowEnd },
          },
        })
      : { _sum: { baseCreditsUsed: 0 } };
  const baseUsed = usedBaseInCycle._sum.baseCreditsUsed ?? 0;
  const baseRemaining = Math.max(0, plan.creditsPerCycle - baseUsed);
  const remaining = isActive ? baseRemaining : 0;

  const dailyApprox = getDailyApproxLimit(normalizedPlanId);
  const cycleSpanMs = Math.max(86_400_000, cycleWindowEnd.getTime() - cycleStart.getTime());
  const approxCycleDays = Math.max(1, Math.ceil(cycleSpanMs / 86_400_000));
  const approxMaxChatsInCycle = Math.max(1, dailyApprox.chatPerDay * approxCycleDays);
  const chatTurnsInCycle =
    dbUser?.id != null
      ? await prisma.feedback.count({
          where: {
            userId: dbUser.id,
            type: "telemetry",
            message: "chat:specialist_chat_reply",
            createdAt: { gte: cycleStart, lte: cycleWindowEnd },
          },
        })
      : 0;
  const virtualChatBaseCredits = Math.min(
    Math.max(0, plan.creditsPerCycle - baseUsed),
    Math.round((chatTurnsInCycle / approxMaxChatsInCycle) * plan.creditsPerCycle)
  );
  const combinedBaseUsageForPercent = Math.min(plan.creditsPerCycle, baseUsed + virtualChatBaseCredits);
  const baseUsagePercent =
    plan.creditsPerCycle > 0
      ? (() => {
          const raw = (combinedBaseUsageForPercent / plan.creditsPerCycle) * 100;
          if (raw <= 0) return 0;
          // Avoid showing 0% after user already started spending usage in this cycle.
          return Math.max(1, Math.min(100, Math.round(raw)));
        })()
      : 0;
  // Read only the current enforcement window, not a user's full ledger history.
  // Policy eligibility requires an actual paid-period start; account creation is not a substitute.
  const usagePolicyPeriodStart = dbUser?.periodStartedAt ?? null;
  const usesRevenue5x = plan.isPaid && isRevenue5xEligible(usagePolicyPeriodStart);
  const tokenLedgerStart = usesRevenue5x
    ? usagePolicyPeriodStart!
    : new Date(now.getFullYear(), now.getMonth(), 1);
  const tokenLedgerEnd = usesRevenue5x
    ? periodEnd
    : new Date(now.getFullYear(), now.getMonth() + 1, 1);
  let ledgerRows: UsagePolicyLedgerRow[] | null = null;
  if (dbUser?.id != null) {
    try {
      ledgerRows = await prisma.tokenUsageLedger.findMany({
        where: {
          userId: dbUser.id,
          createdAt: { gte: tokenLedgerStart, lt: tokenLedgerEnd },
        },
        select: {
          createdAt: true,
          model: true,
          inputTokens: true,
          outputTokens: true,
          totalTokens: true,
          estimatedCostThb: true,
          source: true,
          referenceId: true,
        },
      });
    } catch {
      // Preserve unknown rather than presenting a failed ledger read as free usage.
      ledgerRows = null;
    }
  }
  const usagePolicy = getUsagePolicySnapshot({
    planId: normalizedPlanId,
    subscriptionStatus: dbUser?.subscriptionStatus ?? null,
    periodStartedAt: usagePolicyPeriodStart,
    expiresAt: periodEnd,
    legacyCalendarMonthCapThb: getPlanTokenBudgetThb(normalizedPlanId),
    ledgerRows,
  }, now);
  const tokenSpendThb = usagePolicy.spendThb;
  const tokenBudgetThb = usagePolicy.capThb;
  const tokenUsagePercent =
    tokenBudgetThb !== null && tokenBudgetThb > 0 && tokenSpendThb !== null
      ? Math.max(
          0,
          Math.min(100, tokenSpendThb > 0 ? Math.max(1, Math.ceil((tokenSpendThb / tokenBudgetThb) * 100 - 1e-9)) : 0)
        )
      : null;
  const dayStart = new Date(now);
  dayStart.setHours(0, 0, 0, 0);
  const nextDailyResetAt = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);
  const chatUsedToday =
    dbUser?.id != null
      ? await prisma.feedback.count({
          where: {
            userId: dbUser.id,
            type: "telemetry",
            message: "chat:specialist_chat_reply",
            createdAt: { gte: dayStart },
          },
        })
      : 0;
  const summaryUsedToday =
    dbUser?.id != null
      ? await prisma.usageLog.count({
          where: {
            userId: dbUser.id,
            reason: { in: ["generate", "long_case_generate", "token_generate"] },
            createdAt: { gte: dayStart },
          },
        })
      : 0;
  const isAdminUser = dbUser?.role === "admin";
  const chatDailyLimitReached = !isAdminUser && chatUsedToday >= dailyApprox.chatPerDay;
  const summaryDailyLimitReached = !isAdminUser && summaryUsedToday >= dailyApprox.summaryPerDay;
  const tokenBudgetReached = !isAdminUser && isActive &&
    (tokenSpendThb === null || tokenBudgetThb === null || tokenSpendThb >= tokenBudgetThb);
  const daysLeftByPeriodEnd = isActive ? daysLeftUntil(periodEnd, now) : 0;
  const daysLeftByCycleEnd = isActive ? daysLeftUntil(cycleWindowEnd, now) : 0;
  const daysLeft = Math.max(daysLeftByPeriodEnd, daysLeftByCycleEnd);
  const nextCreditRefreshAt =
    cycleWindowEnd.getTime() < periodEnd.getTime() ? cycleWindowEnd.toISOString() : null;

  return NextResponse.json({
    ok: true,
    email,
    plan: normalizedPlanId,
    total: plan.creditsPerCycle,
    used: baseUsed,
    remaining,
    extraCredits,
    periodAllowancePercentUsed: tokenUsagePercent,
    periodAllowanceReached: tokenBudgetReached,
    periodAllowanceResetAt: usagePolicy.resetAt,
    periodAllowanceDisplayMode: plan.isPaid ? (usesRevenue5x ? "ai_cost" : "legacy_units") : "not_applicable",
    periodAllowanceGrandfathered:
      plan.isPaid && usagePolicy.status === "active" && usagePolicyPeriodStart !== null && !usesRevenue5x,
    usagePolicyKnown: usagePolicy.costEstimate.status === "known" && usagePolicy.costEstimate.safeForEnforcement,
    boostPurchaseAvailable: isActive && plan.isPaid && usagePolicy.costEstimate.status === "known" && usagePolicy.costEstimate.safeForEnforcement,
    baseUsagePercent,
    chatUsedToday,
    chatDailyLimit: dailyApprox.chatPerDay,
    chatDailyLimitReached,
    summaryUsedToday,
    summaryDailyLimit: dailyApprox.summaryPerDay,
    summaryDailyLimitReached,
    tokenBudgetReached,
    nextDailyResetAt: nextDailyResetAt.toISOString(),
    periodEnd: periodEnd.toISOString(),
    nextCreditRefreshAt,
    subscriptionStatus: isActive ? dbUser?.subscriptionStatus ?? "active" : "expired",
    nextPlanId: dbUser?.nextPlanId ?? null,
    nextPlanEffectiveDate: dbUser?.nextPlanEffectiveDate?.toISOString() ?? null,
    daysLeftInMonth: daysLeft,
  });
}

