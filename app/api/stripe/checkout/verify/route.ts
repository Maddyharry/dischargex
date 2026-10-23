import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getStripe } from "@/lib/stripe";
import { getStripeCustomerId } from "@/lib/stripe-portal";
import { verifyPurchaseAnalytics } from "@/lib/stripe-purchase-verification";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ ok: false }, { status: 401 });
  try {
    const body: unknown = await req.json();
    if (!body || typeof body !== "object" || Array.isArray(body)) return NextResponse.json({ ok: false }, { status: 400 });
    const input = body as Record<string, unknown>;
    if (Object.keys(input).length !== 1 || typeof input.sessionId !== "string" ||
        !/^cs_(?:test|live)_[A-Za-z0-9]{16,96}$/.test(input.sessionId)) {
      return NextResponse.json({ ok: false }, { status: 400 });
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true, stripeCustomerId: true },
    });
    if (!user?.stripeCustomerId) return NextResponse.json({ ok: false }, { status: 404 });

    const payment = await prisma.paymentRequest.findFirst({
      where: { stripeSessionId: input.sessionId, userId: user.id },
      select: { id: true, userId: true, status: true, entitlementAppliedAt: true, finalAmount: true },
    });
    if (!payment) {
      return NextResponse.json({ ok: false, pending: true }, { status: 202 });
    }
    if (payment.status !== "approved" || !payment.entitlementAppliedAt) {
      return NextResponse.json({ ok: false, pending: true }, { status: 202 });
    }

    const stripeSession = await getStripe().checkout.sessions.retrieve(input.sessionId);
    const purchase = verifyPurchaseAnalytics({
      authenticatedUserId: user.id,
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
    if (!purchase) {
      return NextResponse.json({ ok: false }, { status: 404 });
    }

    return NextResponse.json({
      ok: true,
      purchase,
    });
  } catch {
    return NextResponse.json({ ok: false }, { status: 503 });
  }
}
