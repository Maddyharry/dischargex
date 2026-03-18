import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  daysLeftUntil,
  getCreditCycleBounds,
  getPeriodBounds,
  getPlanDefinition,
  isPaidPlan,
  normalizePlanId,
} from "@/lib/billing-rules";
import { applyScheduledPlanChangeIfDue } from "@/lib/subscription-switch";

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
  const daysLeft = isActive ? daysLeftUntil(periodEnd, now) : 0;
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
    periodEnd: periodEnd.toISOString(),
    nextCreditRefreshAt,
    subscriptionStatus: isActive ? dbUser?.subscriptionStatus ?? "active" : "expired",
    nextPlanId: dbUser?.nextPlanId ?? null,
    nextPlanEffectiveDate: dbUser?.nextPlanEffectiveDate?.toISOString() ?? null,
    daysLeftInMonth: daysLeft,
  });
}

