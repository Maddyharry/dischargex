import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCreditCycleBounds, getPeriodBounds, getPlanDefinition, normalizePlanId } from "@/lib/billing-rules";
import { getStripe, getStripeWebhookSecret } from "@/lib/stripe";
import { notifyUser } from "@/lib/notifications";

export const runtime = "nodejs";

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

      if (payment.type === "addon" && payment.addCredits) {
        await prisma.user.update({
          where: { id: user.id },
          data: { extraCredits: { increment: payment.addCredits } },
        });
      } else {
        const periodStart = now;
        const { end: expiry } = getPeriodBounds(periodStart, targetPlanId);
        const { cycleStart, cycleEnd } = getCreditCycleBounds(periodStart, targetPlanId, periodStart);
        const cycleEndLimited = cycleEnd.getTime() > expiry.getTime() ? expiry : cycleEnd;
        await prisma.user.update({
          where: { id: user.id },
          data: {
            plan: targetPlan.id,
            subscriptionStatus: "active",
            periodStartedAt: periodStart,
            subscriptionExpiresAt: expiry,
            currentCreditCycleStart: cycleStart,
            currentCreditCycleEnd: cycleEndLimited,
            nextCreditRefreshAt: cycleEndLimited.getTime() < expiry.getTime() ? cycleEndLimited : null,
            nextPlanId: null,
            nextPlanEffectiveDate: null,
            extraCredits: 0,
          },
        });
      }

      await prisma.paymentRequest.update({
        where: { id: payment.id },
        data: {
          status: "approved",
          entitlementAppliedAt: now,
          reviewedAt: now,
          reviewedBy: "stripe_webhook",
          stripePaymentIntentId: typeof session.payment_intent === "string" ? session.payment_intent : null,
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
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "stripe_webhook_failed" },
      { status: 400 }
    );
  }
}
