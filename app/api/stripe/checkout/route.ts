import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  calculateUpgradeFinalAmount,
  classifyPaidPlanChange,
  getAddonPrice,
  getPeriodBounds,
  getPlanDefinition,
  isPaidPlan,
  normalizePlanId,
} from "@/lib/billing-rules";
import { getStripe, getStripePriceMap } from "@/lib/stripe";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }
    const body = (await req.json()) as { planRequested?: string; addCredits?: number };
    const planRequestedRaw = String(body.planRequested || "").trim();
    const addCredits = Number(body.addCredits || 0);
    const isAddCredits = Number.isFinite(addCredits) && addCredits > 0;
    if (!isAddCredits && !planRequestedRaw) {
      return NextResponse.json({ ok: false, error: "Missing planRequested" }, { status: 400 });
    }

    const dbUser = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: {
        id: true,
        email: true,
        createdAt: true,
        plan: true,
        subscriptionStatus: true,
        subscriptionExpiresAt: true,
        periodStartedAt: true,
        stripeCustomerId: true,
        stripeSubscriptionId: true,
      },
    });
    if (!dbUser) return NextResponse.json({ ok: false, error: "User not found" }, { status: 404 });

    const now = new Date();
    const currentPlanId = normalizePlanId(dbUser.plan);
    const periodStart = dbUser.periodStartedAt ?? dbUser.createdAt;
    const { end: fallbackPeriodEnd } = getPeriodBounds(periodStart, currentPlanId);
    const expiryDate = dbUser.subscriptionExpiresAt ?? fallbackPeriodEnd;
    const activeSubscription =
      (dbUser.subscriptionStatus === "active" || dbUser.subscriptionStatus === "pending_change") &&
      expiryDate.getTime() > now.getTime();

    let finalAmount = 0;
    let paymentType = "new";
    let toPlanId: string | null = null;
    if (isAddCredits) {
      const addonPrice = getAddonPrice(addCredits);
      if (!addonPrice) {
        return NextResponse.json({ ok: false, error: "แพ็กเกจวงเงินเสริมไม่ถูกต้อง" }, { status: 400 });
      }
      if (!activeSubscription || !isPaidPlan(currentPlanId)) {
        return NextResponse.json(
          { ok: false, error: "ซื้อวงเงินเสริมได้เฉพาะบัญชีที่มีแพ็กเกจชำระเงินและ active" },
          { status: 400 }
        );
      }
      finalAmount = addonPrice;
      paymentType = "addon";
    } else {
      toPlanId = normalizePlanId(planRequestedRaw);
      const targetPlan = getPlanDefinition(toPlanId);
      paymentType = classifyPaidPlanChange({
        currentPlanId,
        targetPlanId: toPlanId,
        activeSubscription,
      });
      if (paymentType === "upgrade") {
        const remainingDays = Math.max(0, Math.ceil((expiryDate.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)));
        finalAmount = calculateUpgradeFinalAmount({
          currentPlanId,
          targetPlanId: toPlanId,
          remainingDays,
        }).finalAmount;
      } else {
        finalAmount = targetPlan.priceThb;
      }
    }

    const stripe = getStripe();
    let customerId = dbUser.stripeCustomerId || "";
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: dbUser.email || session.user.email,
        metadata: { userId: dbUser.id },
      });
      customerId = customer.id;
      await prisma.user.update({ where: { id: dbUser.id }, data: { stripeCustomerId: customerId } });
    }

    if (!isAddCredits && activeSubscription && dbUser.stripeSubscriptionId) {
      const portal = await stripe.billingPortal.sessions.create({
        customer: customerId,
        return_url: `${process.env.NEXTAUTH_URL || "http://localhost:3000"}/pricing`,
      });
      return NextResponse.json({
        ok: true,
        checkoutUrl: portal.url,
        mode: "billing_portal",
      });
    }

    const priceMap = getStripePriceMap();
    const selectedPriceId = !isAddCredits && toPlanId ? priceMap[toPlanId] || "" : "";
    if (!isAddCredits && !selectedPriceId) {
      return NextResponse.json(
        { ok: false, error: `ยังไม่ได้ตั้งค่า Stripe price สำหรับแพ็กเกจ ${toPlanId || "-"}` },
        { status: 400 }
      );
    }

    const sessionOut = isAddCredits
      ? await stripe.checkout.sessions.create({
          mode: "payment",
          customer: customerId,
          success_url: `${process.env.NEXTAUTH_URL || "http://localhost:3000"}/pricing?stripe=success`,
          cancel_url: `${process.env.NEXTAUTH_URL || "http://localhost:3000"}/pricing?stripe=cancel`,
          line_items: [
            {
              price_data: {
                currency: "thb",
                product_data: {
                  name: `DischargeX Boost ${addCredits}`,
                },
                unit_amount: Math.round(finalAmount * 100),
              },
              quantity: 1,
            },
          ],
          metadata: {
            userId: dbUser.id,
            paymentType,
            currentPlanId,
            toPlanId: "",
            addCredits: String(addCredits),
            finalAmount: String(finalAmount),
          },
        })
      : await stripe.checkout.sessions.create({
          mode: "subscription",
          customer: customerId,
          success_url: `${process.env.NEXTAUTH_URL || "http://localhost:3000"}/pricing?stripe=success`,
          cancel_url: `${process.env.NEXTAUTH_URL || "http://localhost:3000"}/pricing?stripe=cancel`,
          line_items: [{ price: selectedPriceId, quantity: 1 }],
          metadata: {
            userId: dbUser.id,
            paymentType,
            currentPlanId,
            toPlanId: toPlanId || "",
            addCredits: "",
            finalAmount: String(finalAmount),
          },
          subscription_data: {
            metadata: {
              userId: dbUser.id,
              toPlanId: toPlanId || "",
            },
          },
        });

    await prisma.paymentRequest.create({
      data: {
        id: `stripe_${Date.now()}`,
        userId: dbUser.id,
        fullName: session.user.name || "Stripe Customer",
        birthDate: "-",
        hospitalName: "-",
        province: "-",
        phone: "-",
        contactEmail: session.user.email!,
        planRequested: isAddCredits ? "add_credits" : toPlanId || "trial",
        type: paymentType,
        fromPlanId: currentPlanId,
        toPlanId,
        quotedAmount: finalAmount,
        finalAmount,
        slipFileName: "stripe",
        status: "pending",
        addCredits: isAddCredits ? addCredits : null,
        stripeSessionId: sessionOut.id,
      },
    });

    return NextResponse.json({ ok: true, checkoutUrl: sessionOut.url });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "stripe_checkout_failed" },
      { status: 500 }
    );
  }
}
