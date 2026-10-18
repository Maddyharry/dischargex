import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCreditCycleBounds, getPlanDefinition, normalizePlanId } from "@/lib/billing-rules";
import { getPlanIdByStripePriceId, getStripe, getStripeWebhookSecret } from "@/lib/stripe";
import { notifyUser } from "@/lib/notifications";
import { markReferralFirstPurchase } from "@/lib/referral";
import { sendAdminAlertEmail } from "@/lib/admin-alert";
import type Stripe from "stripe";
import {
  APP_MANAGED_SCHEDULE_MARKER,
  APP_MANAGED_SCHEDULE_SUBSCRIPTION_KEY,
  APP_MANAGED_SCHEDULE_USER_KEY,
  getScheduleSubscriptionId,
  getStripeCustomerId,
  getStripePriceId,
  getSubscriptionPaidThroughSeconds,
  getSubscriptionPeriodStartSeconds,
} from "@/lib/stripe-portal";

export const runtime = "nodejs";

function mapStripeSubscriptionStatus(status: string | null | undefined) {
  const s = String(status || "").toLowerCase();
  if (s === "active" || s === "trialing") return "active";
  if (s === "past_due" || s === "unpaid") return "past_due";
  if (s === "canceled" || s === "incomplete_expired") return "cancelled";
  if (s === "incomplete" || s === "paused") return "past_due";
  return "past_due";
}

async function applySubscriptionState(params: {
  userId: string;
  subscriptionId: string;
  allowPeriodAdvance?: boolean;
  expectedPeriodStart?: number | null;
  expectedPeriodEnd?: number | null;
  expectedCustomerId?: string | null;
}) {
  const stripe = getStripe();
  const sub = await stripe.subscriptions.retrieve(params.subscriptionId, {
    expand: ["items.data.price", "schedule"],
  });
  const subAny = sub as unknown as {
    id: string;
    status?: string | null;
    customer?: string | null;
    items?: { data?: Array<{ price?: { id?: string | null } | string | null }> };
  };
  const firstItem = subAny.items?.data?.[0];
  const priceId = getStripePriceId(firstItem?.price as string | Stripe.Price | Stripe.DeletedPrice | null | undefined);
  const mappedPlanId = getPlanIdByStripePriceId(priceId);
  const mappedStatus = mapStripeSubscriptionStatus(sub.status);

  const customerId = getStripeCustomerId(sub.customer);
  if (params.expectedCustomerId && params.expectedCustomerId !== customerId) return null;
  const existingUser = await prisma.user.findUnique({
    where: { id: params.userId },
    select: { plan: true, createdAt: true, periodStartedAt: true, subscriptionExpiresAt: true, stripeCustomerId: true, stripeSubscriptionId: true, currentCreditCycleStart: true, currentCreditCycleEnd: true, nextCreditRefreshAt: true },
  });
  if (!existingUser) return null;
  if ((existingUser.stripeCustomerId && existingUser.stripeCustomerId !== customerId) ||
      (existingUser.stripeSubscriptionId && existingUser.stripeSubscriptionId !== sub.id)) return null;
  if (!mappedPlanId) {
    await prisma.user.updateMany({
      where: { id: params.userId, stripeCustomerId: customerId, stripeSubscriptionId: sub.id },
      data: { subscriptionStatus: mappedStatus === "cancelled" ? "cancelled" : "past_due", nextPlanId: null, nextPlanEffectiveDate: null },
    });
    return null;
  }

  const planId = normalizePlanId(mappedPlanId);
  const startSeconds = getSubscriptionPeriodStartSeconds(sub);
  const endSeconds = getSubscriptionPaidThroughSeconds(sub);
  if (!startSeconds || !endSeconds || endSeconds <= startSeconds) {
    await prisma.user.updateMany({
      where: { id: params.userId, stripeCustomerId: customerId, stripeSubscriptionId: sub.id },
      data: { subscriptionStatus: mappedStatus === "cancelled" ? "cancelled" : "past_due", nextPlanId: null, nextPlanEffectiveDate: null },
    });
    return null;
  }
  const periodStart = new Date(startSeconds * 1000);
  const periodEnd = new Date(endSeconds * 1000);
  if (
    (params.expectedPeriodStart != null && params.expectedPeriodStart !== startSeconds) ||
    (params.expectedPeriodEnd != null && params.expectedPeriodEnd !== endSeconds)
  ) return null;
  const previousStart = existingUser.periodStartedAt?.getTime() ?? 0;
  const previousEnd = existingUser.subscriptionExpiresAt?.getTime() ?? 0;
  // Legacy timestamp-without-time-zone rows may encode local wall time. Permit repair
  // from Stripe's strictly later paid-through date despite a small start offset, while
  // resetting credits only when the paid-period start advances materially.
  if (periodStart.getTime() < previousStart - 12 * 60 * 60 * 1000 && periodEnd.getTime() <= previousEnd) return null;
  if (previousEnd > 0 && periodEnd.getTime() < previousEnd) return null;
  const advancesPeriod = periodStart.getTime() > previousStart + 12 * 60 * 60 * 1000;
  const extendsPaidThrough = periodEnd.getTime() > previousEnd;
  if (extendsPaidThrough && !params.allowPeriodAdvance) return null;
  if (advancesPeriod && !params.allowPeriodAdvance) return null;
  let nextPlanId: string | null = null;
  let nextPlanEffectiveDate: Date | null = null;
  const scheduleRef = sub.schedule;
  const scheduleId = typeof scheduleRef === "string" ? scheduleRef : scheduleRef?.id;
  if (scheduleId) {
    const schedule = typeof scheduleRef === "string" ? await stripe.subscriptionSchedules.retrieve(scheduleRef) : scheduleRef;
    if (!schedule) return null;
    const isOwnedSchedule = schedule.status === "active" &&
      schedule.metadata?.[APP_MANAGED_SCHEDULE_MARKER] === "true" &&
      schedule.metadata?.[APP_MANAGED_SCHEDULE_USER_KEY] === params.userId &&
      schedule.metadata?.[APP_MANAGED_SCHEDULE_SUBSCRIPTION_KEY] === sub.id &&
      getScheduleSubscriptionId(schedule) === sub.id &&
      getStripeCustomerId(schedule.customer) === customerId &&
      schedule.phases.length === 2 &&
      schedule.current_phase?.start_date === schedule.phases[0]?.start_date;
    if (isOwnedSchedule) {
      const pendingPrice = getStripePriceId(schedule.phases[1]?.items[0]?.price);
      nextPlanId = getPlanIdByStripePriceId(pendingPrice);
      const endDate = schedule.phases[0]?.end_date;
      if (nextPlanId && endDate) nextPlanEffectiveDate = new Date(endDate * 1000);
    }
  }
  const cycleFields = advancesPeriod
    ? (() => {
        const { cycleStart, cycleEnd } = getCreditCycleBounds(periodStart, planId, periodStart);
        const cycleEndLimited = cycleEnd.getTime() > periodEnd.getTime() ? periodEnd : cycleEnd;
        return {
          periodStartedAt: periodStart,
          currentCreditCycleStart: cycleStart,
          currentCreditCycleEnd: cycleEndLimited,
          nextCreditRefreshAt: cycleEndLimited.getTime() < periodEnd.getTime() ? cycleEndLimited : null,
        };
      })()
    : {};

  const periodAdvancedWhere = advancesPeriod || extendsPaidThrough
    ? existingUser.subscriptionExpiresAt
      ? { subscriptionExpiresAt: { lt: periodEnd } }
      : { subscriptionExpiresAt: null }
    : {};
  const persisted = await prisma.user.updateMany({
    where: { id: params.userId, stripeSubscriptionId: existingUser.stripeSubscriptionId, ...periodAdvancedWhere },
    data: {
      plan: planId,
      subscriptionStatus: mappedStatus === "active" && nextPlanId ? "pending_change" : mappedStatus,
      subscriptionExpiresAt: periodEnd,
      ...cycleFields,
      stripeCustomerId: customerId,
      stripeSubscriptionId: subAny.id,
      nextPlanId,
      nextPlanEffectiveDate,
    },
  });
  if (persisted.count !== 1) return null;

  return {
    planId,
    periodStart,
    periodEnd,
    status: mappedStatus,
    advancesPeriod,
  };
}

async function findUserByStripeRefs(subscriptionId: string | null, customerId: string | null) {
  if (!subscriptionId && !customerId) return null;
  return prisma.user.findFirst({
    where: {
      OR: [
        ...(subscriptionId ? [{ stripeSubscriptionId: subscriptionId }] : []),
        ...(customerId ? [{ stripeCustomerId: customerId }] : []),
      ],
    },
    select: { id: true, plan: true },
  });
}

export async function POST(req: Request) {
  try {
    const stripe = getStripe();
    const signature = (await headers()).get("stripe-signature");
    if (!signature) return NextResponse.json({ ok: false, error: "Missing signature" }, { status: 400 });
    const rawBody = await req.text();
    const event = stripe.webhooks.constructEvent(rawBody, signature, getStripeWebhookSecret());

    if (event.type === "checkout.session.completed") {
      const session = event.data.object;
      if (session.payment_status !== "paid" && session.payment_status !== "no_payment_required") {
        return NextResponse.json({ ok: true, ignored: true });
      }
      const stripeSessionId = session.id;
      const payment = await prisma.paymentRequest.findFirst({
        where: { stripeSessionId },
      });
      if (!payment || payment.entitlementAppliedAt) return NextResponse.json({ ok: true, ignored: true });

      const user = await prisma.user.findUnique({
        where: { id: payment.userId || "" },
        select: {
          id: true,
          plan: true,
          createdAt: true,
        },
      });
      if (!user) return NextResponse.json({ ok: false, error: "User not found" }, { status: 404 });

      const now = new Date();
      const currentPlanId = normalizePlanId(user.plan);
      const targetPlanId = payment.toPlanId ? normalizePlanId(payment.toPlanId) : currentPlanId;
      const targetPlan = getPlanDefinition(targetPlanId);
      const paymentAppliedData = {
        status: "approved",
        entitlementAppliedAt: now,
        reviewedAt: now,
        reviewedBy: "stripe_webhook",
        stripePaymentIntentId: typeof session.payment_intent === "string" ? session.payment_intent : null,
        stripeInvoiceId: typeof session.invoice === "string" ? session.invoice : null,
      };
      let paymentClaimed = false;
      let addonLogCreated = false;

      if (session.mode === "payment" && payment.type === "addon" && payment.addCredits) {
        const appliedAddon = await prisma.$transaction(async (tx) => {
          const claim = await tx.paymentRequest.updateMany({
            where: { id: payment.id, entitlementAppliedAt: null },
            data: paymentAppliedData,
          });
          if (claim.count !== 1) return false;
          await tx.user.update({ where: { id: user.id }, data: { extraCredits: { increment: payment.addCredits! } } });
          await tx.entitlementLog.create({
            data: {
              userId: user.id,
              action: "addon",
              creditsDelta: payment.addCredits!,
              expiryDeltaDays: 0,
              note: `Applied via Stripe session ${stripeSessionId}`,
              relatedPaymentId: payment.id,
            },
          });
          return true;
        });
        if (!appliedAddon) return NextResponse.json({ ok: true, ignored: true });
        paymentClaimed = true;
        addonLogCreated = true;
      } else if (session.mode === "subscription") {
        const stripeSubscriptionId =
          typeof session.subscription === "string" ? session.subscription : null;
        if (!stripeSubscriptionId) {
          return NextResponse.json(
            { ok: false, error: "Missing subscription id on checkout session" },
            { status: 400 }
          );
        }
        const applied = await applySubscriptionState({
          userId: user.id,
          subscriptionId: stripeSubscriptionId,
          allowPeriodAdvance: true,
          expectedCustomerId: getStripeCustomerId(session.customer),
        });
        if (!applied || applied.planId !== targetPlanId) return NextResponse.json({ ok: true, ignored: true });
        const claim = await prisma.paymentRequest.updateMany({
          where: { id: payment.id, entitlementAppliedAt: null },
          data: paymentAppliedData,
        });
        if (claim.count !== 1) return NextResponse.json({ ok: true, ignored: true });
        paymentClaimed = true;
      } else {
        return NextResponse.json({ ok: false, error: "Unsupported checkout mode" }, { status: 400 });
      }

      if (session.mode === "subscription") {
        try {
          await markReferralFirstPurchase(user.id);
        } catch (referralErr) {
          console.error("stripe_webhook markReferralFirstPurchase:", referralErr);
        }
      }

      if (!paymentClaimed) return NextResponse.json({ ok: true, ignored: true });

      if (!addonLogCreated) await prisma.entitlementLog.create({
        data: {
          userId: user.id,
          action: payment.type === "addon" ? "addon" : "plan_purchase",
          creditsDelta: payment.type === "addon" ? payment.addCredits || 0 : targetPlan.creditsPerCycle,
          expiryDeltaDays: payment.type === "addon" ? 0 : targetPlan.durationDays,
          note: `Applied via Stripe session ${stripeSessionId}`,
          relatedPaymentId: payment.id,
        },
      });

      await notifyUser({
        userId: user.id,
        type: "billing",
        title: "ชำระเงินสำเร็จ",
        message:
          payment.type === "addon"
            ? `เพิ่มสิทธิ์ Boost ${payment.addCredits || 0} สิทธิ์เรียบร้อยแล้ว`
            : `เปิดใช้งานแพ็กเกจ ${targetPlanId} สำเร็จแล้ว`,
        meta: { paymentRequestId: payment.id, stripeSessionId },
      });

      await sendAdminAlertEmail({
        subject: "DischargeX: Payment received",
        lines: [
          `User ID: ${user.id}`,
          `Payment ID: ${payment.id}`,
          `Type: ${payment.type}`,
          `Plan target: ${payment.toPlanId || "-"}`,
          `Add credits: ${payment.addCredits || 0}`,
          `Amount THB: ${payment.finalAmount}`,
          `Stripe session: ${stripeSessionId}`,
          `Mode: ${session.mode}`,
        ],
      });
    } else if (event.type === "invoice.paid") {
      const invoice = event.data.object;
      const invoiceAny = invoice as unknown as {
        id: string;
        status?: string | null;
        subscription?: string | null;
        customer?: string | null;
        parent?: { subscription_details?: { subscription?: string | { id?: string } | null } | null } | null;
        lines?: { data?: Array<{ type?: string; period?: { start?: number; end?: number }; parent?: { type?: string } }> };
        /** งวดแรกหลังสร้าง subscription — สำรองกรณี `checkout.session.completed` ยิงไม่สำเร็จ */
        billing_reason?: string | null;
      };
      const nestedSubscription = invoiceAny.parent?.subscription_details?.subscription;
      const subscriptionId = typeof invoiceAny.subscription === "string"
        ? invoiceAny.subscription
        : typeof nestedSubscription === "string" ? nestedSubscription : nestedSubscription?.id ?? null;
      const customerId = typeof invoiceAny.customer === "string" ? invoiceAny.customer : null;
      const user = await findUserByStripeRefs(subscriptionId, customerId);
      if (!user || !subscriptionId) return NextResponse.json({ ok: true, ignored: true });

      if (invoiceAny.status && invoiceAny.status !== "paid") return NextResponse.json({ ok: true, ignored: true });
      const subscriptionLine = invoiceAny.lines?.data?.find((line) =>
        line.type === "subscription" || line.type === "subscription_item" || line.parent?.type === "subscription_item_details"
      ) ?? invoiceAny.lines?.data?.[0];
      const invoicePeriodStart = subscriptionLine?.period?.start;
      const invoicePeriodEnd = subscriptionLine?.period?.end;
      if (
        (invoiceAny.billing_reason === "subscription_create" || invoiceAny.billing_reason === "subscription_cycle") &&
        (!invoicePeriodStart || !invoicePeriodEnd)
      ) return NextResponse.json({ ok: true, ignored: true });

      const applied = await applySubscriptionState({
        userId: user.id,
        subscriptionId,
        allowPeriodAdvance: invoiceAny.billing_reason === "subscription_create" || invoiceAny.billing_reason === "subscription_cycle",
        expectedPeriodStart: invoicePeriodStart,
        expectedPeriodEnd: invoicePeriodEnd,
        expectedCustomerId: customerId,
      });
      if (!applied) return NextResponse.json({ ok: true, ignored: true });

      if (invoiceAny.billing_reason === "subscription_create") {
        try {
          await markReferralFirstPurchase(user.id);
        } catch (referralErr) {
          console.error("stripe_webhook invoice.paid markReferralFirstPurchase:", referralErr);
        }
      }

      if (applied.advancesPeriod && invoiceAny.billing_reason === "subscription_cycle") await prisma.entitlementLog.create({
        data: {
          userId: user.id,
          action: "renewal",
          creditsDelta: getPlanDefinition(applied.planId).creditsPerCycle,
          expiryDeltaDays: 0,
          note: `Stripe invoice paid ${invoiceAny.id}`,
          relatedPaymentId: null,
        },
      });
    } else if (event.type === "invoice.payment_failed") {
      const invoice = event.data.object;
      const invoiceAny = invoice as unknown as {
        id: string;
        subscription?: string | null;
        customer?: string | null;
        parent?: { subscription_details?: { subscription?: string | { id?: string } | null } | null } | null;
      };
      const nestedSubscription = invoiceAny.parent?.subscription_details?.subscription;
      const subscriptionId = typeof invoiceAny.subscription === "string"
        ? invoiceAny.subscription
        : typeof nestedSubscription === "string" ? nestedSubscription : nestedSubscription?.id ?? null;
      const customerId = typeof invoiceAny.customer === "string" ? invoiceAny.customer : null;
      const user = await findUserByStripeRefs(subscriptionId, customerId);
      if (!user) return NextResponse.json({ ok: true, ignored: true });
      const linked = subscriptionId ? await getStripe().subscriptions.retrieve(subscriptionId) : null;
      if (linked && linked.status !== "active" && linked.status !== "trialing") {
        await prisma.user.update({ where: { id: user.id }, data: { subscriptionStatus: mapStripeSubscriptionStatus(linked.status) } });
      }
      await notifyUser({
        userId: user.id,
        type: "billing",
        title: "ต่ออายุแพ็กเกจไม่สำเร็จ",
        message: "ระบบไม่สามารถตัดชำระต่ออายุอัตโนมัติได้ กรุณาตรวจสอบวิธีชำระเงินใน Stripe",
        meta: { stripeInvoiceId: invoiceAny.id },
      });
    } else if (event.type === "customer.subscription.updated" || event.type === "customer.subscription.deleted") {
      const sub = event.data.object;
      const subAny = sub as unknown as {
        id: string;
        status?: string | null;
        customer?: string | null;
      };
      const subscriptionId = subAny.id;
      const customerId = typeof subAny.customer === "string" ? subAny.customer : null;
      const user = await findUserByStripeRefs(subscriptionId, customerId);
      if (!user) return NextResponse.json({ ok: true, ignored: true });
      await applySubscriptionState({ userId: user.id, subscriptionId, allowPeriodAdvance: false });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "stripe_webhook_failed" },
      { status: 400 }
    );
  }
}
