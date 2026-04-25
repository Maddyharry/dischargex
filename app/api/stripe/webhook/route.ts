import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCreditCycleBounds, getPeriodBounds, getPlanDefinition, normalizePlanId } from "@/lib/billing-rules";
import { getPlanIdByStripePriceId, getStripe, getStripeWebhookSecret } from "@/lib/stripe";
import { notifyUser } from "@/lib/notifications";
import { markReferralFirstPurchase } from "@/lib/referral";
import { sendAdminAlertEmail } from "@/lib/admin-alert";

export const runtime = "nodejs";

function mapStripeSubscriptionStatus(status: string | null | undefined) {
  const s = String(status || "").toLowerCase();
  if (s === "active" || s === "trialing") return "active";
  if (s === "past_due" || s === "unpaid") return "past_due";
  if (s === "canceled" || s === "incomplete_expired") return "cancelled";
  if (s === "incomplete") return "pending_change";
  return "active";
}

function toDateFromUnix(seconds: number | null | undefined, fallback: Date) {
  if (typeof seconds === "number" && Number.isFinite(seconds) && seconds > 0) {
    return new Date(seconds * 1000);
  }
  return fallback;
}

async function applySubscriptionState(params: {
  userId: string;
  subscriptionId: string;
  resetExtraCredits?: boolean;
}) {
  const stripe = getStripe();
  const sub = await stripe.subscriptions.retrieve(params.subscriptionId, {
    expand: ["items.data.price"],
  });
  const subAny = sub as unknown as {
    id: string;
    status?: string | null;
    customer?: string | null;
    current_period_start?: number | null;
    current_period_end?: number | null;
    items?: { data?: Array<{ price?: { id?: string | null } }> };
  };
  const firstItem = subAny.items?.data?.[0];
  const priceId = firstItem?.price?.id || null;
  const mappedPlanId = getPlanIdByStripePriceId(priceId);

  const existingUser = await prisma.user.findUnique({
    where: { id: params.userId },
    select: { plan: true, createdAt: true },
  });
  if (!existingUser) return null;

  const planId = normalizePlanId(mappedPlanId || existingUser.plan || "trial");
  const periodStart = toDateFromUnix(subAny.current_period_start, new Date());
  const periodEnd = toDateFromUnix(
    subAny.current_period_end,
    getPeriodBounds(periodStart, planId).end
  );
  const { cycleStart, cycleEnd } = getCreditCycleBounds(periodStart, planId, periodStart);
  const cycleEndLimited = cycleEnd.getTime() > periodEnd.getTime() ? periodEnd : cycleEnd;

  await prisma.user.update({
    where: { id: params.userId },
    data: {
      plan: planId,
      subscriptionStatus: mapStripeSubscriptionStatus(subAny.status),
      periodStartedAt: periodStart,
      subscriptionExpiresAt: periodEnd,
      currentCreditCycleStart: cycleStart,
      currentCreditCycleEnd: cycleEndLimited,
      nextCreditRefreshAt: cycleEndLimited.getTime() < periodEnd.getTime() ? cycleEndLimited : null,
      stripeCustomerId: typeof subAny.customer === "string" ? subAny.customer : null,
      stripeSubscriptionId: subAny.id,
      nextPlanId: null,
      nextPlanEffectiveDate: null,
      ...(params.resetExtraCredits ? { extraCredits: 0 } : {}),
    },
  });

  return {
    planId,
    periodStart,
    periodEnd,
    status: mapStripeSubscriptionStatus(subAny.status),
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

      if (session.mode === "payment" && payment.type === "addon" && payment.addCredits) {
        await prisma.user.update({
          where: { id: user.id },
          data: { extraCredits: { increment: payment.addCredits } },
        });
      } else if (session.mode === "subscription") {
        const stripeSubscriptionId =
          typeof session.subscription === "string" ? session.subscription : null;
        if (!stripeSubscriptionId) {
          return NextResponse.json(
            { ok: false, error: "Missing subscription id on checkout session" },
            { status: 400 }
          );
        }
        await applySubscriptionState({
          userId: user.id,
          subscriptionId: stripeSubscriptionId,
          resetExtraCredits: true,
        });
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

      await prisma.paymentRequest.update({
        where: { id: payment.id },
        data: {
          status: "approved",
          entitlementAppliedAt: now,
          reviewedAt: now,
          reviewedBy: "stripe_webhook",
          stripePaymentIntentId: typeof session.payment_intent === "string" ? session.payment_intent : null,
          stripeInvoiceId: typeof session.invoice === "string" ? session.invoice : null,
        },
      });

      await prisma.entitlementLog.create({
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
            ? `เติมวงเงินเสริม ${payment.addCredits || 0} สำเร็จแล้ว`
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
          `Amount THB: ${payment.amount}`,
          `Stripe session: ${stripeSessionId}`,
          `Mode: ${session.mode}`,
        ],
      });
    } else if (event.type === "invoice.paid") {
      const invoice = event.data.object;
      const invoiceAny = invoice as unknown as {
        id: string;
        subscription?: string | null;
        customer?: string | null;
        /** งวดแรกหลังสร้าง subscription — สำรองกรณี `checkout.session.completed` ยิงไม่สำเร็จ */
        billing_reason?: string | null;
      };
      const subscriptionId =
        typeof invoiceAny.subscription === "string" ? invoiceAny.subscription : null;
      const customerId = typeof invoiceAny.customer === "string" ? invoiceAny.customer : null;
      const user = await findUserByStripeRefs(subscriptionId, customerId);
      if (!user || !subscriptionId) return NextResponse.json({ ok: true, ignored: true });

      const applied = await applySubscriptionState({
        userId: user.id,
        subscriptionId,
        resetExtraCredits: false,
      });
      if (!applied) return NextResponse.json({ ok: true, ignored: true });

      if (invoiceAny.billing_reason === "subscription_create") {
        try {
          await markReferralFirstPurchase(user.id);
        } catch (referralErr) {
          console.error("stripe_webhook invoice.paid markReferralFirstPurchase:", referralErr);
        }
      }

      await prisma.entitlementLog.create({
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
      };
      const subscriptionId =
        typeof invoiceAny.subscription === "string" ? invoiceAny.subscription : null;
      const customerId = typeof invoiceAny.customer === "string" ? invoiceAny.customer : null;
      const user = await findUserByStripeRefs(subscriptionId, customerId);
      if (!user) return NextResponse.json({ ok: true, ignored: true });
      await prisma.user.update({
        where: { id: user.id },
        data: { subscriptionStatus: "past_due" },
      });
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
        current_period_end?: number | null;
      };
      const subscriptionId = subAny.id;
      const customerId = typeof subAny.customer === "string" ? subAny.customer : null;
      const user = await findUserByStripeRefs(subscriptionId, customerId);
      if (!user) return NextResponse.json({ ok: true, ignored: true });
      await prisma.user.update({
        where: { id: user.id },
        data: {
          subscriptionStatus: mapStripeSubscriptionStatus(subAny.status),
          subscriptionExpiresAt: toDateFromUnix(subAny.current_period_end, new Date()),
          stripeSubscriptionId: subscriptionId,
          stripeCustomerId: customerId,
        },
      });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "stripe_webhook_failed" },
      { status: 400 }
    );
  }
}
