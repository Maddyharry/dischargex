import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  listPayments,
  updatePaymentStatus,
  PaymentStatus,
} from "@/lib/payments-store";
import { prisma } from "@/lib/prisma";
import {
  calculateUpgradeFinalAmount,
  calculateUpgradeCreditCarryover,
  classifyPaidPlanChange,
  getCreditCycleBounds,
  getPeriodBounds,
  getPlanDefinition,
  isPaidPlan,
  normalizePlanId,
  type PaymentType,
} from "@/lib/billing-rules";
import { markReferralFirstPurchase } from "@/lib/referral";
import { notifyUser } from "@/lib/notifications";

export const runtime = "nodejs";

function isAdmin(session: unknown) {
  return (session as { user?: { role?: string } } | null)?.user?.role === "admin";
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!isAdmin(session)) {
      return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
    }
    const payments = await listPayments();
    return NextResponse.json({ ok: true, payments });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "โหลดรายการไม่สำเร็จ";
    return NextResponse.json({ ok: false, error: String(message) }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!isAdmin(session)) {
      return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
    }

    const body = (await req.json()) as {
      id?: string;
      action?: PaymentStatus;
      adminNote?: string;
      rejectionReason?: string;
    };

    const id = body.id;
    const action = body.action;

    if (!id || !action) {
      return NextResponse.json(
        { ok: false, error: "Missing id or action" },
        { status: 400 }
      );
    }

    const now = new Date();
    const reviewerEmail = (session?.user as { email?: string } | undefined)?.email ?? null;

    if (action !== "approved") {
      const payment = await prisma.paymentRequest.findUnique({ where: { id } });
      if (!payment) {
        return NextResponse.json(
          { ok: false, error: "Payment request not found" },
          { status: 404 }
        );
      }
      const updated = await updatePaymentStatus(id, action, {
        adminNote: body.adminNote ?? null,
        rejectionReason: action === "rejected" ? body.rejectionReason ?? null : null,
        reviewedBy: reviewerEmail,
        reviewedAt: now,
      });
      const targetUserId =
        payment.userId ??
        (
          await prisma.user.findUnique({
            where: { email: payment.contactEmail },
            select: { id: true },
          })
        )?.id ??
        null;
      if (targetUserId) {
        await notifyUser({
          userId: targetUserId,
          type: "billing",
          title: action === "rejected" ? "คำขอถูกปฏิเสธ" : "อัปเดตสถานะคำขอชำระเงิน",
          message:
            action === "rejected"
              ? `คำขอชำระเงินถูกปฏิเสธ${body.rejectionReason ? `: ${body.rejectionReason}` : ""}`
              : `สถานะคำขอชำระเงินถูกอัปเดตเป็น ${action}`,
          meta: { paymentRequestId: payment.id, status: action },
        });
      }
      return NextResponse.json({ ok: true, payment: updated });
    }
    let appliedUserId: string | null = null;
    let appliedType: PaymentType | null = null;
    let appliedToPlanId: string | null = null;
    let appliedAddCredits: number | null = null;
    let appliedFinalAmount: number | null = null;
    let appliedCarryoverCredits: number | null = null;
    let scheduledEffectiveAt: Date | null = null;
    let idempotent = false;

    await prisma.$transaction(async (transaction) => {
      // lock-claim: only first approver can apply entitlement
      const claimed = await transaction.paymentRequest.updateMany({
        where: { id, entitlementAppliedAt: null },
        data: {
          entitlementAppliedAt: now,
          status: "approved",
          reviewedBy: reviewerEmail,
          reviewedAt: now,
          adminNote: body.adminNote ?? null,
          rejectionReason: null,
        },
      });
      if (claimed.count === 0) {
        idempotent = true;
        return;
      }

      const payment = await transaction.paymentRequest.findUnique({ where: { id } });
      if (!payment) throw new Error("Payment request not found");

      const user = await transaction.user.findUnique({
        where: { email: payment.contactEmail },
        select: {
          id: true,
          email: true,
          createdAt: true,
          plan: true,
          extraCredits: true,
          periodStartedAt: true,
          subscriptionStatus: true,
          subscriptionExpiresAt: true,
          nextPlanId: true,
          nextPlanEffectiveDate: true,
        },
      });
      if (!user) throw new Error("User not found for this payment");

      const currentPlanId = normalizePlanId(user.plan);
      const targetPlanId = normalizePlanId(payment.toPlanId || payment.planRequested);
      const periodStart = user.periodStartedAt ?? user.createdAt;
      const { end: fallbackExpiryDate } = getPeriodBounds(periodStart, currentPlanId);
      const currentExpiryDate = user.subscriptionExpiresAt ?? fallbackExpiryDate;
      const isSubscriptionActive =
        user.subscriptionStatus === "active" && currentExpiryDate.getTime() > now.getTime();

      const { cycleStart, cycleEnd } = getCreditCycleBounds(periodStart, currentPlanId, now);
      const cycleWindowEnd =
        cycleEnd.getTime() > currentExpiryDate.getTime() ? currentExpiryDate : cycleEnd;
      const usageInCycle = await transaction.usageLog.aggregate({
        _sum: { baseCreditsUsed: true },
        where: {
          userId: user.id,
          createdAt: { gte: cycleStart, lte: cycleWindowEnd },
        },
      });
      const currentBaseUsed = usageInCycle._sum.baseCreditsUsed ?? 0;
      const currentBaseRemaining = Math.max(
        0,
        getPlanDefinition(currentPlanId).creditsPerCycle - currentBaseUsed
      );
      const currentRemainingCredits = currentBaseRemaining + user.extraCredits;

      let applyType: PaymentType = (payment.type as PaymentType) || "new";
      if (payment.addCredits != null && payment.addCredits > 0) {
        applyType = "addon";
      } else if (applyType === "new" || applyType === "renewal") {
        applyType = classifyPaidPlanChange({
          currentPlanId,
          targetPlanId,
          activeSubscription: isSubscriptionActive,
        });
      }

      const targetPlan = getPlanDefinition(targetPlanId);
      const remainingDays = Math.max(
        0,
        Math.ceil((currentExpiryDate.getTime() - now.getTime()) / (24 * 60 * 60 * 1000))
      );
      const upgradeQuote = calculateUpgradeFinalAmount({
        currentPlanId,
        targetPlanId,
        remainingDays,
      });

      if (applyType === "addon") {
        if (!isSubscriptionActive || !isPaidPlan(currentPlanId)) {
          throw new Error("ซื้อเครดิตเพิ่มได้เฉพาะบัญชีที่มี subscription แบบชำระเงินและยัง active");
        }
        const addCredits = payment.addCredits ?? 0;
        appliedAddCredits = addCredits;
        await transaction.user.update({
          where: { id: user.id },
          data: {
            extraCredits: { increment: addCredits },
          },
        });
        await transaction.entitlementLog.create({
          data: {
            userId: user.id,
            action: "addon",
            creditsDelta: addCredits,
            expiryDeltaDays: 0,
            note: `Add-on ${addCredits} credits`,
            relatedPaymentId: payment.id,
          },
        });
      } else if (applyType === "renewal") {
        const renewalStart =
          currentExpiryDate.getTime() > now.getTime() ? currentExpiryDate : now;
        const newExpiry = new Date(
          renewalStart.getTime() + targetPlan.durationDays * 24 * 60 * 60 * 1000
        );
        await transaction.user.update({
          where: { id: user.id },
          data: {
            plan: targetPlan.id,
            subscriptionStatus: "active",
            subscriptionExpiresAt: newExpiry,
            extraCredits: { increment: targetPlan.creditsPerCycle },
          },
        });
        await transaction.entitlementLog.create({
          data: {
            userId: user.id,
            action: "renewal",
            creditsDelta: targetPlan.creditsPerCycle,
            expiryDeltaDays: targetPlan.durationDays,
            note: "Renew same plan before expiry",
            relatedPaymentId: payment.id,
          },
        });
      } else if (applyType === "upgrade") {
        const newPeriodStart = now;
        const { end: newExpiryDate } = getPeriodBounds(newPeriodStart, targetPlan.id);
        const { cycleStart: newCycleStart, cycleEnd: newCycleEnd } = getCreditCycleBounds(
          newPeriodStart,
          targetPlan.id,
          newPeriodStart
        );
        const cycleEndLimited =
          newCycleEnd.getTime() > newExpiryDate.getTime() ? newExpiryDate : newCycleEnd;

        const carryoverCredits = calculateUpgradeCreditCarryover({
          remainingCredits: currentRemainingCredits,
          carryoverRatio: 0.5,
        });
        appliedCarryoverCredits = carryoverCredits;

        await transaction.user.update({
          where: { id: user.id },
          data: {
            plan: targetPlan.id,
            subscriptionStatus: "active",
            periodStartedAt: newPeriodStart,
            subscriptionExpiresAt: newExpiryDate,
            currentCreditCycleStart: newCycleStart,
            currentCreditCycleEnd: cycleEndLimited,
            nextCreditRefreshAt:
              cycleEndLimited.getTime() < newExpiryDate.getTime() ? cycleEndLimited : null,
            extraCredits: carryoverCredits,
            nextPlanId: null,
            nextPlanEffectiveDate: null,
          },
        });
        await transaction.entitlementLog.create({
          data: {
            userId: user.id,
            action: "upgrade",
            creditsDelta: targetPlan.creditsPerCycle,
            expiryDeltaDays: targetPlan.durationDays,
            note: `Upgrade quote: remaining ${upgradeQuote.remainingValue} THB, final ${upgradeQuote.finalAmount} THB, carryoverCredits=${carryoverCredits}/${currentRemainingCredits}`,
            relatedPaymentId: payment.id,
          },
        });
      } else if (applyType === "downgrade") {
        await transaction.user.update({
          where: { id: user.id },
          data: {
            subscriptionStatus: "pending_change",
            nextPlanId: targetPlan.id,
            nextPlanEffectiveDate: currentExpiryDate,
          },
        });
        scheduledEffectiveAt = currentExpiryDate;
        await transaction.entitlementLog.create({
          data: {
            userId: user.id,
            action: "downgrade_scheduled",
            creditsDelta: 0,
            expiryDeltaDays: 0,
            note: `Downgrade scheduled to ${targetPlan.id} at ${currentExpiryDate.toISOString()}`,
            relatedPaymentId: payment.id,
          },
        });
      } else {
        const newPeriodStart = now;
        const { end: newExpiryDate } = getPeriodBounds(newPeriodStart, targetPlan.id);
        const { cycleStart: newCycleStart, cycleEnd: newCycleEnd } = getCreditCycleBounds(
          newPeriodStart,
          targetPlan.id,
          newPeriodStart
        );
        const cycleEndLimited =
          newCycleEnd.getTime() > newExpiryDate.getTime() ? newExpiryDate : newCycleEnd;

        await transaction.user.update({
          where: { id: user.id },
          data: {
            plan: targetPlan.id,
            subscriptionStatus: "active",
            periodStartedAt: newPeriodStart,
            subscriptionExpiresAt: newExpiryDate,
            currentCreditCycleStart: newCycleStart,
            currentCreditCycleEnd: cycleEndLimited,
            nextCreditRefreshAt:
              cycleEndLimited.getTime() < newExpiryDate.getTime() ? cycleEndLimited : null,
            nextPlanId: null,
            nextPlanEffectiveDate: null,
            extraCredits: 0,
          },
        });
        await transaction.entitlementLog.create({
          data: {
            userId: user.id,
            action: isPaidPlan(currentPlanId) ? "plan_purchase" : "trial_started",
            creditsDelta: targetPlan.creditsPerCycle,
            expiryDeltaDays: targetPlan.durationDays,
            note: `Start ${targetPlan.id}`,
            relatedPaymentId: payment.id,
          },
        });
      }

      appliedUserId = user.id;
      appliedType = applyType;
      appliedToPlanId = targetPlan.id;
      appliedFinalAmount = payment.finalAmount ?? null;
    });

    const updated = await prisma.paymentRequest.findUnique({ where: { id } });
    if (!updated) {
      return NextResponse.json(
        { ok: false, error: "Payment request not found" },
        { status: 404 }
      );
    }
    if (!idempotent && appliedUserId && (appliedType === "new" || appliedType === "renewal" || appliedType === "upgrade")) {
      await markReferralFirstPurchase(appliedUserId);
    }

    if (!idempotent && appliedUserId && appliedType) {
      if (appliedType === "addon") {
        await notifyUser({
          userId: appliedUserId,
          type: "billing",
          title: "เติมเครดิตเพิ่มสำเร็จ",
          message: `เติมเครดิตเพิ่ม ${appliedAddCredits ?? 0} เครดิตแล้ว`,
          meta: { paymentRequestId: id, type: appliedType, addCredits: appliedAddCredits },
        });
      } else if (appliedType === "downgrade") {
        const effectiveAtText = scheduledEffectiveAt
          ? ` (มีผลวันที่ ${(scheduledEffectiveAt as unknown as Date).toLocaleDateString("th-TH")})`
          : "";
        const effectiveAtIso = scheduledEffectiveAt
          ? (scheduledEffectiveAt as unknown as Date).toISOString()
          : null;
        await notifyUser({
          userId: appliedUserId,
          type: "billing",
          title: "ตั้งค่าลดแพ็กเกจรอบถัดไปแล้ว",
          message: `ระบบตั้งค่าเปลี่ยนเป็น ${appliedToPlanId ?? "-"} ในรอบถัดไป${effectiveAtText}`,
          meta: {
            paymentRequestId: id,
            type: appliedType,
            toPlanId: appliedToPlanId,
            effectiveAt: effectiveAtIso,
          },
        });
      } else if (appliedType === "upgrade") {
        await notifyUser({
          userId: appliedUserId,
          type: "billing",
          title: "อัปเกรดแพ็กเกจสำเร็จ",
          message: `อัปเกรดเป็น ${appliedToPlanId ?? "-"} แล้ว เริ่มรอบใหม่ทันที (พกเครดิตเดิม ${appliedCarryoverCredits ?? 0} เครดิต)`,
          meta: { paymentRequestId: id, type: appliedType, toPlanId: appliedToPlanId, carryoverCredits: appliedCarryoverCredits, finalAmount: appliedFinalAmount },
        });
      } else if (appliedType === "renewal") {
        await notifyUser({
          userId: appliedUserId,
          type: "billing",
          title: "ต่ออายุแพ็กเกจสำเร็จ",
          message: `ต่ออายุแพ็กเกจ ${appliedToPlanId ?? "-"} แล้ว (เครดิตและวันถูกสะสมเพิ่ม)`,
          meta: { paymentRequestId: id, type: appliedType, toPlanId: appliedToPlanId, finalAmount: appliedFinalAmount },
        });
      } else if (appliedType === "new") {
        await notifyUser({
          userId: appliedUserId,
          type: "billing",
          title: "เปิดแพ็กเกจสำเร็จ",
          message: `เปิดแพ็กเกจ ${appliedToPlanId ?? "-"} แล้ว พร้อมใช้งาน`,
          meta: { paymentRequestId: id, type: appliedType, toPlanId: appliedToPlanId, finalAmount: appliedFinalAmount },
        });
      }
    }

    return NextResponse.json({ ok: true, payment: updated, idempotent });
  } catch (err: unknown) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Internal Server Error" },
      { status: 500 }
    );
  }
}

