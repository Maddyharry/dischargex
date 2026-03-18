import { prisma } from "./prisma";
import { getCreditCycleBounds, getPeriodBounds, getPlanDefinition, normalizePlanId } from "./billing-rules";
import { notifyUser } from "./notifications";

export async function applyScheduledPlanChangeIfDue(userId: string, now: Date) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      plan: true,
      subscriptionStatus: true,
      subscriptionExpiresAt: true,
      periodStartedAt: true,
      nextPlanId: true,
      nextPlanEffectiveDate: true,
    },
  });
  if (!user) return { applied: false as const };
  if (user.subscriptionStatus !== "pending_change") return { applied: false as const };
  if (!user.nextPlanId || !user.nextPlanEffectiveDate) return { applied: false as const };
  if (now.getTime() < user.nextPlanEffectiveDate.getTime()) return { applied: false as const };

  const targetPlanId = normalizePlanId(user.nextPlanId);
  const targetPlan = getPlanDefinition(targetPlanId);
  const newPeriodStart = now;
  const { end: newExpiryDate } = getPeriodBounds(newPeriodStart, targetPlanId);
  const { cycleStart: newCycleStart, cycleEnd: newCycleEnd } = getCreditCycleBounds(
    newPeriodStart,
    targetPlanId,
    newPeriodStart
  );
  const cycleEndLimited = newCycleEnd.getTime() > newExpiryDate.getTime() ? newExpiryDate : newCycleEnd;

  await prisma.$transaction(async (tx) => {
    // apply once
    const updated = await tx.user.updateMany({
      where: {
        id: user.id,
        subscriptionStatus: "pending_change",
        nextPlanId: user.nextPlanId,
        nextPlanEffectiveDate: user.nextPlanEffectiveDate,
      },
      data: {
        plan: targetPlan.id,
        subscriptionStatus: "active",
        periodStartedAt: newPeriodStart,
        subscriptionExpiresAt: newExpiryDate,
        currentCreditCycleStart: newCycleStart,
        currentCreditCycleEnd: cycleEndLimited,
        nextCreditRefreshAt: cycleEndLimited.getTime() < newExpiryDate.getTime() ? cycleEndLimited : null,
        nextPlanId: null,
        nextPlanEffectiveDate: null,
        extraCredits: 0,
      },
    });
    if (updated.count === 0) return;

    await tx.entitlementLog.create({
      data: {
        userId: user.id,
        action: "downgrade_applied",
        creditsDelta: targetPlan.creditsPerCycle,
        expiryDeltaDays: targetPlan.durationDays,
        note: `Auto-switch to ${targetPlan.id}`,
      },
    });
  });

  await notifyUser({
    userId: user.id,
    type: "billing",
    title: "เปลี่ยนแพ็กเกจรอบถัดไปแล้ว",
    message: `ระบบเปลี่ยนเป็น ${targetPlan.id} แล้ว เริ่มรอบใหม่อัตโนมัติ`,
    meta: { toPlanId: targetPlan.id, effectiveAt: user.nextPlanEffectiveDate.toISOString() },
  });

  return { applied: true as const, toPlanId: targetPlan.id };
}

