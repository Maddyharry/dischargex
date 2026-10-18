import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import type Stripe from "stripe";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getPlanDefinition, isPaidPlan, normalizePlanId, type PlanId } from "@/lib/billing-rules";
import { getStripe, getStripePriceMap, getPlanIdByStripePriceId } from "@/lib/stripe";
import {
  APP_MANAGED_SCHEDULE_MARKER,
  APP_MANAGED_SCHEDULE_SUBSCRIPTION_KEY,
  APP_MANAGED_SCHEDULE_USER_KEY,
  getScheduleSubscriptionId,
  getStripeCustomerId,
  getStripePriceId,
  getSubscriptionPaidThroughSeconds,
  getSubscriptionPeriodStartSeconds,
  isSameOriginBillingPost,
} from "@/lib/stripe-portal";

export const runtime = "nodejs";

const PLAN_IDS: PlanId[] = [
  "basic_monthly",
  "basic_yearly",
  "standard_monthly",
  "standard_yearly",
  "pro_monthly",
  "pro_yearly",
];

function unsupportedSubscriptionTerms(subscription: Stripe.Subscription) {
  const items = subscription.items.data;
  return (
    items.length !== 1 ||
    (subscription.discounts?.length ?? 0) > 0 ||
    subscription.automatic_tax.enabled ||
    (subscription.default_tax_rates?.length ?? 0) > 0 ||
    items.some((item) => (item.tax_rates?.length ?? 0) > 0) ||
    subscription.application_fee_percent != null ||
    subscription.transfer_data != null ||
    subscription.billing_thresholds != null ||
    subscription.pending_update != null ||
    subscription.pause_collection != null
  );
}

function cleanError(status = 503) {
  return NextResponse.json(
    { ok: false, error: "ยังตั้งเวลาการเปลี่ยนแพ็กเกจไม่สำเร็จ กรุณาลองใหม่หรือติดต่อทีมงาน" },
    { status }
  );
}

export async function POST(request: Request) {
  if (!isSameOriginBillingPost(request)) {
    return NextResponse.json({ ok: false, error: "คำขอไม่ถูกต้อง กรุณาโหลดหน้าใหม่แล้วลองอีกครั้ง" }, { status: 403 });
  }

  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ ok: false, error: "กรุณาเข้าสู่ระบบก่อนจัดการแพ็กเกจ" }, { status: 401 });
  }

  let body: { planId?: unknown };
  let createdScheduleId: string | null = null;
  try {
    body = (await request.json()) as { planId?: unknown };
  } catch {
    return NextResponse.json({ ok: false, error: "กรุณาเลือกแพ็กเกจที่ต้องการ" }, { status: 400 });
  }
  if (typeof body.planId !== "string" || !PLAN_IDS.includes(body.planId as PlanId)) {
    return NextResponse.json({ ok: false, error: "แพ็กเกจที่เลือกไม่ถูกต้อง" }, { status: 400 });
  }
  const targetPlanId = body.planId as PlanId;
  const targetPlan = getPlanDefinition(targetPlanId);
  if (!isPaidPlan(targetPlanId)) {
    return NextResponse.json({ ok: false, error: "เลือกได้เฉพาะแพ็กเกจที่ชำระเงิน" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: {
      id: true,
      plan: true,
      subscriptionStatus: true,
      subscriptionExpiresAt: true,
      stripeCustomerId: true,
      stripeSubscriptionId: true,
    },
  });
  if (!user) return NextResponse.json({ ok: false, error: "ไม่พบบัญชีผู้ใช้" }, { status: 404 });
  if (!user.stripeCustomerId || !user.stripeSubscriptionId) {
    return NextResponse.json({ ok: false, error: "บัญชีนี้ยังไม่มี Stripe subscription ที่จัดการได้" }, { status: 409 });
  }

  try {
    const stripe = getStripe();
    const subscription = await stripe.subscriptions.retrieve(user.stripeSubscriptionId, {
      expand: ["items.data.price", "schedule"],
    });
    const customerId = getStripeCustomerId(subscription.customer);
    if (customerId !== user.stripeCustomerId) {
      return NextResponse.json({ ok: false, error: "ไม่สามารถยืนยันเจ้าของ subscription นี้ได้" }, { status: 409 });
    }
    if (subscription.status !== "active" || subscription.cancel_at_period_end) {
      return NextResponse.json({ ok: false, error: "แพ็กเกจนี้ยังเปลี่ยนแผนไม่ได้ กรุณาตรวจสอบสถานะการต่ออายุ" }, { status: 409 });
    }
    if (user.subscriptionExpiresAt && user.subscriptionExpiresAt.getTime() <= Date.now()) {
      return NextResponse.json({ ok: false, error: "แพ็กเกจปัจจุบันหมดอายุแล้ว" }, { status: 409 });
    }
    if (subscription.schedule) {
      return NextResponse.json(
        { ok: false, error: "มีการตั้งตารางเปลี่ยนแผนอยู่แล้ว กรุณาติดต่อทีมงานเพื่อป้องกันการตั้งซ้ำ" },
        { status: 409 }
      );
    }
    if (unsupportedSubscriptionTerms(subscription)) {
      return NextResponse.json(
        { ok: false, error: "subscription นี้มีเงื่อนไขภาษีหรือส่วนลดที่ต้องให้ทีมงานตรวจสอบก่อนเปลี่ยนแผน" },
        { status: 409 }
      );
    }

    const subscriptionItem = subscription.items.data[0];
    const currentPriceId = getStripePriceId(subscriptionItem?.price);
    const currentPlanId = getPlanIdByStripePriceId(currentPriceId);
    const startSeconds = getSubscriptionPeriodStartSeconds(subscription);
    const endSeconds = getSubscriptionPaidThroughSeconds(subscription);
    if (!subscriptionItem || !currentPriceId || !currentPlanId || !startSeconds || !endSeconds || endSeconds <= Date.now() / 1000) {
      return NextResponse.json({ ok: false, error: "ยังอ่านรอบชำระเงินปัจจุบันจาก Stripe ไม่ได้" }, { status: 409 });
    }
    if (normalizePlanId(user.plan) !== currentPlanId) {
      return NextResponse.json({ ok: false, error: "ข้อมูลแพ็กเกจยังซิงก์กับ Stripe ไม่ตรงกัน กรุณารีเฟรชแล้วลองใหม่" }, { status: 409 });
    }
    if (currentPlanId === targetPlanId) {
      return NextResponse.json({ ok: false, error: "แพ็กเกจนี้เป็นแพ็กเกจปัจจุบันอยู่แล้ว" }, { status: 400 });
    }

    const targetPriceId = getStripePriceMap()[targetPlanId];
    if (!targetPriceId) return cleanError(503);
    const targetPrice = await stripe.prices.retrieve(targetPriceId);
    const expectedInterval = targetPlan.billingCycle === "yearly" ? "year" : "month";
    if (
      !targetPrice.active ||
      targetPrice.type !== "recurring" ||
      targetPrice.currency !== "thb" ||
      targetPrice.unit_amount !== Math.round(targetPlan.priceThb * 100) ||
      targetPrice.recurring?.interval !== expectedInterval ||
      targetPrice.recurring?.interval_count !== 1
    ) {
      return cleanError(503);
    }

    const schedule = await stripe.subscriptionSchedules.create({ from_subscription: subscription.id });
    createdScheduleId = schedule.id;
    const firstPhase = schedule.phases[0];
    const phaseItem = firstPhase?.items?.[0];
    const inheritedPriceId = getStripePriceId(phaseItem?.price);
    const inheritedCustomerId = getStripeCustomerId(schedule.customer);
    if (
      schedule.status !== "active" ||
      getScheduleSubscriptionId(schedule) !== subscription.id ||
      inheritedCustomerId !== user.stripeCustomerId ||
      !firstPhase ||
      schedule.phases.length !== 1 ||
      firstPhase.items.length !== 1 ||
      inheritedPriceId !== currentPriceId ||
      (firstPhase.discounts?.length ?? 0) > 0 ||
      (firstPhase.default_tax_rates?.length ?? 0) > 0 ||
      firstPhase.automatic_tax?.enabled
    ) {
      await stripe.subscriptionSchedules.release(schedule.id).catch(() => undefined);
      createdScheduleId = null;
      return cleanError(409);
    }

    const quantity = phaseItem.quantity ?? subscriptionItem.quantity ?? 1;
    const updatedSchedule = await stripe.subscriptionSchedules.update(schedule.id, {
      end_behavior: "release",
      proration_behavior: "none",
      metadata: {
        ...schedule.metadata,
        [APP_MANAGED_SCHEDULE_MARKER]: "true",
        [APP_MANAGED_SCHEDULE_USER_KEY]: user.id,
        [APP_MANAGED_SCHEDULE_SUBSCRIPTION_KEY]: subscription.id,
      },
      phases: [
        {
          start_date: firstPhase.start_date,
          end_date: endSeconds,
          items: [{ price: currentPriceId, quantity }],
          collection_method: subscription.collection_method,
          proration_behavior: "none",
        },
        {
          items: [{ price: targetPriceId, quantity }],
          iterations: 1,
          collection_method: subscription.collection_method,
          proration_behavior: "none",
        },
      ],
    });

    if (
      updatedSchedule.status !== "active" ||
      updatedSchedule.phases.length !== 2 ||
      getScheduleSubscriptionId(updatedSchedule) !== subscription.id
    ) {
      await stripe.subscriptionSchedules.release(schedule.id).catch(() => undefined);
      createdScheduleId = null;
      return cleanError();
    }
    createdScheduleId = null;

    const effectiveAt = new Date(endSeconds * 1000);
    await prisma.user.update({
      where: { id: user.id },
      data: {
        subscriptionStatus: "pending_change",
        nextPlanId: targetPlanId,
        nextPlanEffectiveDate: effectiveAt,
      },
    });

    return NextResponse.json({
      ok: true,
      currentPlanId,
      nextPlanId: targetPlanId,
      effectiveAt: effectiveAt.toISOString(),
      message: `เปลี่ยนเป็น ${targetPlan.id} ในรอบชำระเงินถัดไป โดยแพ็กเกจปัจจุบันยังใช้งานได้จนถึงวันดังกล่าว`,
    });
  } catch {
    if (createdScheduleId) {
      await getStripe().subscriptionSchedules.release(createdScheduleId).catch(() => undefined);
    }
    return cleanError();
  }
}
