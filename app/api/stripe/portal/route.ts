import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import type Stripe from "stripe";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getPlanIdByStripePriceId, getStripe } from "@/lib/stripe";
import {
  APP_MANAGED_SCHEDULE_MARKER,
  APP_MANAGED_SCHEDULE_SUBSCRIPTION_KEY,
  APP_MANAGED_SCHEDULE_USER_KEY,
  getBillingReturnUrl,
  getScheduleSubscriptionId,
  getStripeCustomerId,
  getStripePriceId,
  getSubscriptionPaidThroughSeconds,
  getSubscriptionPeriodStartSeconds,
  getVerifiedCancellationPortalConfiguration,
  isSameOriginBillingPost,
} from "@/lib/stripe-portal";

export const runtime = "nodejs";

function unixToIso(seconds: number | null | undefined) {
  return typeof seconds === "number" && seconds > 0 ? new Date(seconds * 1000).toISOString() : null;
}

async function getAuthenticatedUser() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return { response: NextResponse.json({ ok: false, error: "กรุณาเข้าสู่ระบบ" }, { status: 401 }) };
  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: {
      id: true,
      plan: true,
      subscriptionStatus: true,
      subscriptionExpiresAt: true,
      nextPlanId: true,
      nextPlanEffectiveDate: true,
      stripeCustomerId: true,
      stripeSubscriptionId: true,
    },
  });
  if (!user) return { response: NextResponse.json({ ok: false, error: "ไม่พบบัญชีผู้ใช้" }, { status: 404 }) };
  return { user };
}

export async function GET() {
  const auth = await getAuthenticatedUser();
  if ("response" in auth) return auth.response;
  const { user } = auth;

  const state = {
    ok: true,
    currentPlanId: user.plan,
    pendingPlanId: null as string | null,
    pendingPlanEffectiveAt: null as string | null,
    cancelAtPeriodEnd: false,
    cancelAt: null as string | null,
    periodStartedAt: null as string | null,
    paidThroughAt: user.subscriptionExpiresAt?.toISOString() ?? null,
    subscriptionStatus: user.subscriptionStatus,
    hasSchedule: false,
    hasAppManagedSchedule: false,
    hasExternalSchedule: false,
  };
  if (!user.stripeCustomerId || !user.stripeSubscriptionId) return NextResponse.json(state);

  try {
    const stripe = getStripe();
    const subscription = await stripe.subscriptions.retrieve(user.stripeSubscriptionId, {
      expand: ["items.data.price", "schedule"],
    });
    if (getStripeCustomerId(subscription.customer) !== user.stripeCustomerId) {
      return NextResponse.json({ ok: false, error: "ยืนยันข้อมูล subscription ไม่สำเร็จ" }, { status: 409 });
    }

    const currentPriceId = getStripePriceId(subscription.items.data[0]?.price);
    const currentPlanId = getPlanIdByStripePriceId(currentPriceId);
    if (currentPlanId) state.currentPlanId = currentPlanId;
    state.cancelAtPeriodEnd = subscription.cancel_at_period_end === true;
    state.cancelAt = unixToIso(subscription.cancel_at);
    state.periodStartedAt = unixToIso(getSubscriptionPeriodStartSeconds(subscription));
    state.paidThroughAt = unixToIso(getSubscriptionPaidThroughSeconds(subscription)) ?? state.paidThroughAt;
    state.subscriptionStatus = subscription.status;

    const scheduleReference = subscription.schedule;
    const scheduleId =
      typeof scheduleReference === "string" ? scheduleReference : scheduleReference?.id ?? null;
    if (scheduleId) {
      const schedule =
        typeof scheduleReference === "string"
          ? await stripe.subscriptionSchedules.retrieve(scheduleReference)
          : (scheduleReference as Stripe.SubscriptionSchedule);
      state.hasSchedule = schedule.status === "active";
      const isManagedByThisUser =
        schedule.metadata?.[APP_MANAGED_SCHEDULE_MARKER] === "true" &&
        schedule.metadata?.[APP_MANAGED_SCHEDULE_USER_KEY] === user.id &&
        schedule.metadata?.[APP_MANAGED_SCHEDULE_SUBSCRIPTION_KEY] === subscription.id &&
        getScheduleSubscriptionId(schedule) === subscription.id &&
        getStripeCustomerId(schedule.customer) === user.stripeCustomerId &&
        schedule.status === "active" &&
        schedule.phases.length === 2;
      state.hasAppManagedSchedule = isManagedByThisUser;
      state.hasExternalSchedule = schedule.status === "active" && !isManagedByThisUser;
      const targetPriceId = getStripePriceId(schedule.phases[1]?.items[0]?.price);
      const scheduledPlanId = getPlanIdByStripePriceId(targetPriceId);
      const effectiveAt = schedule.phases[0]?.end_date;
      const pendingPhaseIsUpcoming = schedule.current_phase?.start_date === schedule.phases[0]?.start_date;
      if (isManagedByThisUser && pendingPhaseIsUpcoming && scheduledPlanId && effectiveAt) {
        state.pendingPlanId = scheduledPlanId;
        state.pendingPlanEffectiveAt = unixToIso(effectiveAt);
      }
    }

    return NextResponse.json(state);
  } catch {
    return NextResponse.json({ ok: false, error: "โหลดสถานะการชำระเงินจาก Stripe ไม่สำเร็จ" }, { status: 503 });
  }
}

export async function POST(request: Request) {
  if (!isSameOriginBillingPost(request)) {
    return NextResponse.json({ ok: false, error: "คำขอไม่ถูกต้อง กรุณาโหลดหน้าใหม่แล้วลองอีกครั้ง" }, { status: 403 });
  }
  const auth = await getAuthenticatedUser();
  if ("response" in auth) return auth.response;
  const { user } = auth;
  if (!user.stripeCustomerId || !user.stripeSubscriptionId) {
    return NextResponse.json({ ok: false, error: "บัญชีนี้ยังไม่มี Stripe subscription ที่จัดการได้" }, { status: 409 });
  }

  const returnUrl = getBillingReturnUrl();
  if (!returnUrl) {
    return NextResponse.json({ ok: false, error: "ขณะนี้ยังไม่พร้อมเปิดหน้า Stripe Billing Portal" }, { status: 503 });
  }

  try {
    const stripe = getStripe();
    const subscription = await stripe.subscriptions.retrieve(user.stripeSubscriptionId, { expand: ["schedule"] });
    if (getStripeCustomerId(subscription.customer) !== user.stripeCustomerId) {
      return NextResponse.json({ ok: false, error: "ยืนยันเจ้าของ subscription ไม่สำเร็จ" }, { status: 409 });
    }
    if (subscription.status !== "active") {
      return NextResponse.json({ ok: false, error: "ไม่พบแพ็กเกจที่กำลังใช้งานเพื่อจัดการการต่ออายุ" }, { status: 409 });
    }
    if (subscription.schedule) {
      return NextResponse.json(
        { ok: false, error: "มีตารางเปลี่ยนแผนอยู่ กรุณาจัดการการยกเลิกจากส่วน Billing ในหน้าโปรไฟล์" },
        { status: 409 }
      );
    }

    const configuration = await getVerifiedCancellationPortalConfiguration(stripe);
    const portalSession = await stripe.billingPortal.sessions.create({
      customer: user.stripeCustomerId,
      configuration: configuration.id,
      return_url: returnUrl,
    });
    return NextResponse.json({ ok: true, url: portalSession.url });
  } catch {
    return NextResponse.json({ ok: false, error: "ขณะนี้ยังเปิดหน้า Stripe Billing Portal ไม่ได้ กรุณาลองใหม่ภายหลัง" }, { status: 503 });
  }
}
