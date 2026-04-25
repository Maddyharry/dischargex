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

export const runtime = "nodejs";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const email = session.user.email;
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
    dbUser?.plan ?? (session.user as { plan?: string } | null | undefined)?.plan ?? "trial"
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
  const remaining = isActive ? baseRemaining + extraCredits : 0;
  const baseUsagePercent =
    plan.creditsPerCycle > 0
      ? Math.max(0, Math.min(100, Math.round((baseUsed / plan.creditsPerCycle) * 100)))
      : 0;
  const tokenSpendInCycle =
    dbUser?.id != null
      ? await prisma.tokenUsageLedger.aggregate({
          _sum: { estimatedCostThb: true },
          where: {
            userId: dbUser.id,
            createdAt: { gte: cycleStart, lte: cycleWindowEnd },
          },
        })
      : { _sum: { estimatedCostThb: 0 } };
  const tokenSpendThb = Number(tokenSpendInCycle._sum.estimatedCostThb || 0);
  const tokenBudgetThb = getPlanTokenBudgetThb(normalizedPlanId);
  const tokenUsagePercent = tokenBudgetThb > 0 ? Math.max(0, Math.min(100, Math.round((tokenSpendThb / tokenBudgetThb) * 100))) : 0;
  const dayStart = new Date(now);
  dayStart.setHours(0, 0, 0, 0);
  const nextDailyResetAt = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);
  const dailyApprox = getDailyApproxLimit(normalizedPlanId);
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
  const tokenBudgetReached = !isAdminUser && tokenSpendThb >= tokenBudgetThb;
  const daysLeftByPeriodEnd = isActive ? daysLeftUntil(periodEnd, now) : 0;
  const daysLeftByCycleEnd = isActive ? daysLeftUntil(cycleWindowEnd, now) : 0;
  const daysLeft = Math.max(daysLeftByPeriodEnd, daysLeftByCycleEnd);
  const nextCreditRefreshAt =
    cycleWindowEnd.getTime() < periodEnd.getTime() ? cycleWindowEnd.toISOString() : null;

  return NextResponse.json({
    ok: true,
    email,
    plan: normalizedPlanId,
    total: plan.creditsPerCycle + extraCredits,
    used: baseUsed,
    remaining,
    extraCredits,
    tokenSpendThb: Number(tokenSpendThb.toFixed(2)),
    tokenBudgetThb,
    tokenRemainingThb: Math.max(0, Number((tokenBudgetThb - tokenSpendThb).toFixed(2))),
    tokenUsagePercent,
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

