import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getStripe } from "@/lib/stripe";
import {
  APP_MANAGED_SCHEDULE_MARKER,
  APP_MANAGED_SCHEDULE_SUBSCRIPTION_KEY,
  APP_MANAGED_SCHEDULE_USER_KEY,
  getScheduleSubscriptionId,
  getStripeCustomerId,
  getSubscriptionPaidThroughSeconds,
  isSameOriginBillingPost,
} from "@/lib/stripe-portal";

export const runtime = "nodejs";

const failed = (status = 503, message = "ยังยกเลิกการต่ออายุไม่สำเร็จ กรุณาลองใหม่ภายหลัง") =>
  NextResponse.json({ ok: false, error: message }, { status });

export async function POST(request: Request) {
  if (!isSameOriginBillingPost(request)) {
    return NextResponse.json({ ok: false, error: "คำขอไม่ถูกต้อง กรุณาโหลดหน้าใหม่แล้วลองอีกครั้ง" }, { status: 403 });
  }
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ ok: false, error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });

  let body: { confirm?: unknown };
  try {
    body = (await request.json()) as { confirm?: unknown };
  } catch {
    return NextResponse.json({ ok: false, error: "กรุณายืนยันการยกเลิกการต่ออายุ" }, { status: 400 });
  }
  if (body.confirm !== true) {
    return NextResponse.json({ ok: false, error: "กรุณายืนยันการยกเลิกการต่ออายุ" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: {
      id: true,
      stripeCustomerId: true,
      stripeSubscriptionId: true,
      subscriptionStatus: true,
    },
  });
  if (!user) return NextResponse.json({ ok: false, error: "ไม่พบบัญชีผู้ใช้" }, { status: 404 });
  if (!user.stripeCustomerId || !user.stripeSubscriptionId) return failed(409, "ไม่พบบัญชี Stripe ที่จัดการได้");

  try {
    const stripe = getStripe();
    const subscription = await stripe.subscriptions.retrieve(user.stripeSubscriptionId, {
      expand: ["items.data.price", "schedule"],
    });
    if (getStripeCustomerId(subscription.customer) !== user.stripeCustomerId) {
      return failed(409, "ยืนยันเจ้าของ subscription ไม่สำเร็จ");
    }
    if (subscription.status !== "active") return failed(409, "ไม่พบแพ็กเกจที่กำลังใช้งาน");
    if (subscription.cancel_at_period_end) {
      const alreadyPaidThrough = getSubscriptionPaidThroughSeconds(subscription);
      if (!alreadyPaidThrough) return failed(503, "ยังยืนยันวันสิ้นสุดสิทธิ์ที่ชำระแล้วไม่ได้");
      return NextResponse.json({
        ok: true,
        cancelAtPeriodEnd: true,
        paidThroughAt: new Date(alreadyPaidThrough * 1000).toISOString(),
      });
    }

    const scheduleReference = subscription.schedule;
    const scheduleId = typeof scheduleReference === "string" ? scheduleReference : scheduleReference?.id;
    if (!scheduleId) return failed(409, "ไม่มีการเปลี่ยนแผนที่กำหนดไว้ในระบบนี้ กรุณาใช้ Stripe Billing Portal");
    const schedule =
      typeof scheduleReference === "string"
        ? await stripe.subscriptionSchedules.retrieve(scheduleReference)
        : scheduleReference;
    if (!schedule) return failed(409, "ไม่พบตารางเปลี่ยนแผน กรุณารีเฟรชสถานะ");
    const ownsSchedule =
      schedule.status === "active" &&
      schedule.metadata?.[APP_MANAGED_SCHEDULE_MARKER] === "true" &&
      schedule.metadata?.[APP_MANAGED_SCHEDULE_USER_KEY] === user.id &&
      schedule.metadata?.[APP_MANAGED_SCHEDULE_SUBSCRIPTION_KEY] === subscription.id &&
      getScheduleSubscriptionId(schedule) === subscription.id &&
      getStripeCustomerId(schedule.customer) === user.stripeCustomerId;
    if (!ownsSchedule) {
      return failed(409, "มีตารางเปลี่ยนแผนจากแหล่งอื่นอยู่ จึงยังยกเลิกอัตโนมัติไม่ได้ กรุณาติดต่อทีมงาน");
    }

    const paidThroughSeconds = getSubscriptionPaidThroughSeconds(subscription);
    if (!paidThroughSeconds || paidThroughSeconds <= Date.now() / 1000) {
      return failed(409, "ยังยืนยันวันสิ้นสุดสิทธิ์ปัจจุบันไม่ได้");
    }

    await stripe.subscriptionSchedules.release(schedule.id, { preserve_cancel_date: true });
    let canceledSubscription;
    try {
      canceledSubscription = await stripe.subscriptions.update(subscription.id, {
        cancel_at_period_end: true,
        proration_behavior: "none",
      });
    } catch {
      await prisma.user.update({
        where: { id: user.id },
        data: { subscriptionStatus: "active", nextPlanId: null, nextPlanEffectiveDate: null },
      });
      return failed(503, "ยกเลิกแผนที่ตั้งไว้แล้ว แต่ยังตั้งยกเลิกการต่ออายุไม่สำเร็จ กรุณาใช้ Stripe Billing Portal");
    }

    const canceledCustomerId = getStripeCustomerId(canceledSubscription.customer);
    const canceledPaidThrough = getSubscriptionPaidThroughSeconds(canceledSubscription);
    if (
      canceledCustomerId !== user.stripeCustomerId ||
      !canceledSubscription.cancel_at_period_end ||
      canceledPaidThrough !== paidThroughSeconds
    ) {
      return failed(503);
    }

    await prisma.user.update({
      where: { id: user.id },
      data: {
        subscriptionStatus: "active",
        nextPlanId: null,
        nextPlanEffectiveDate: null,
      },
    });
    return NextResponse.json({
      ok: true,
      cancelAtPeriodEnd: true,
      paidThroughAt: new Date(paidThroughSeconds * 1000).toISOString(),
    });
  } catch {
    return failed();
  }
}
