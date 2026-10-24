import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { trackTelemetry } from "@/lib/telemetry";
import { normalizeSafeAnalyticsPayload } from "@/lib/analytics-events";
import { getDedupedWebAnalyticsRecordId } from "@/lib/analytics-server";
import { getStripe } from "@/lib/stripe";
import { getStripeCustomerId } from "@/lib/stripe-portal";
import { verifyPurchaseAnalytics } from "@/lib/stripe-purchase-verification";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  // Preview/local browsers must never pollute real conversion statistics.
  if (process.env.VERCEL_ENV !== "production") return NextResponse.json({ ok: true, skipped: true });
  try {
    const payload = normalizeSafeAnalyticsPayload(await req.json());
    if (!payload) {
      return NextResponse.json({ ok: false, error: "Invalid event" }, { status: 400 });
    }

    const session = await getServerSession(authOptions);
    const userId = (session?.user as { id?: string } | undefined)?.id ?? null;

    if (payload.event === "first_case_completed") {
      const eventId = payload.metadata && "event_id" in payload.metadata ? payload.metadata.event_id : "";
      if (!userId || !eventId) return NextResponse.json({ ok: false }, { status: 403 });
      const marker = await prisma.firstCaseAnalytics.findUnique({ where: { userId }, select: { eventToken: true } });
      if (!marker || marker.eventToken !== eventId) return NextResponse.json({ ok: false }, { status: 403 });
    }

    if (payload.event === "purchase") {
      const purchaseMetadata = payload.metadata && "transaction_id" in payload.metadata ? payload.metadata : null;
      if (!userId || !purchaseMetadata) return NextResponse.json({ ok: false }, { status: 403 });
      const user = await prisma.user.findUnique({ where: { id: userId }, select: { stripeCustomerId: true } });
      if (!user?.stripeCustomerId) return NextResponse.json({ ok: false }, { status: 403 });
      const payment = await prisma.paymentRequest.findFirst({
        where: { userId, stripeSessionId: purchaseMetadata.transaction_id },
        select: { userId: true, status: true, entitlementAppliedAt: true, finalAmount: true },
      });
      if (!payment) return NextResponse.json({ ok: false }, { status: 403 });
      const stripeSession = await getStripe().checkout.sessions.retrieve(purchaseMetadata.transaction_id);
      const verifiedPurchase = verifyPurchaseAnalytics({
        authenticatedUserId: userId,
        payment,
        checkout: {
          id: stripeSession.id,
          payment_status: stripeSession.payment_status,
          currency: stripeSession.currency,
          amount_total: stripeSession.amount_total,
          customerId: getStripeCustomerId(stripeSession.customer),
        },
        expectedCustomerId: user.stripeCustomerId,
      });
      if (!verifiedPurchase || verifiedPurchase.value !== purchaseMetadata.value ||
          verifiedPurchase.transaction_id !== purchaseMetadata.transaction_id) {
        return NextResponse.json({ ok: false }, { status: 403 });
      }
    }

    const id = getDedupedWebAnalyticsRecordId(payload);
    if (id) {
      await prisma.feedback.createMany({
        data: [{
          id,
          userId: userId ?? undefined,
          type: "telemetry",
          message: `web:${payload.event}`,
          payload: payload.metadata ? JSON.stringify(payload.metadata) : undefined,
          category: "other",
          shortSummary: `web:${payload.event}`,
          status: "pending",
        }],
        skipDuplicates: true,
      });
    } else {
      await trackTelemetry({ userId, source: "web", event: payload.event, payload: payload.metadata });
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false, error: "Bad request" }, { status: 400 });
  }
}
