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
  type PaymentType,
} from "@/lib/billing-rules";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const planRequestedRaw = String(searchParams.get("planRequested") || "").trim();
    const addCreditsRaw = searchParams.get("addCredits");
    const addCredits =
      addCreditsRaw != null && addCreditsRaw !== "" ? parseInt(String(addCreditsRaw), 10) : null;
    const isAddCredits = addCredits != null && addCredits > 0;

    if (!planRequestedRaw && !isAddCredits) {
      return NextResponse.json({ ok: false, error: "Missing planRequested" }, { status: 400 });
    }

    const contactEmail = session.user.email;
    const dbUser = await prisma.user.findUnique({
      where: { email: contactEmail },
      select: {
        id: true,
        createdAt: true,
        plan: true,
        subscriptionStatus: true,
        subscriptionExpiresAt: true,
        periodStartedAt: true,
      },
    });

    const now = new Date();
    const currentPlanId = normalizePlanId(dbUser?.plan ?? "trial");
    const periodStart = dbUser?.periodStartedAt ?? dbUser?.createdAt ?? now;
    const { end: fallbackPeriodEnd } = getPeriodBounds(periodStart, currentPlanId);
    const expiryDate = dbUser?.subscriptionExpiresAt ?? fallbackPeriodEnd;
    const activeSubscription =
      (dbUser?.subscriptionStatus === "active" || dbUser?.subscriptionStatus === "pending_change") &&
      expiryDate.getTime() > now.getTime();

    let paymentType: PaymentType;
    let quotedAmount: number | null = null;
    let finalAmount: number | null = null;
    let remainingValue: number | null = null;
    let remainingDays: number | null = null;
    const fromPlanId: string | null = currentPlanId;
    let toPlanId: string | null = null;

    if (isAddCredits) {
      paymentType = "addon";
      const addonPrice = getAddonPrice(addCredits!);
      if (!addonPrice) {
        return NextResponse.json({ ok: false, error: "แพ็กเกจเครดิตเพิ่มไม่ถูกต้อง" }, { status: 400 });
      }
      if (!activeSubscription || !isPaidPlan(currentPlanId)) {
        return NextResponse.json(
          { ok: false, error: "ซื้อเครดิตเพิ่มได้เฉพาะบัญชีที่มี subscription แบบชำระเงินและยัง active" },
          { status: 400 }
        );
      }
      quotedAmount = addonPrice;
      finalAmount = addonPrice;
      toPlanId = null;
    } else {
      const targetPlanId = normalizePlanId(planRequestedRaw);
      const targetPlan = getPlanDefinition(targetPlanId);
      quotedAmount = targetPlan.priceThb;
      toPlanId = targetPlanId;

      paymentType = classifyPaidPlanChange({
        currentPlanId,
        targetPlanId,
        activeSubscription,
      });

      if (paymentType === "new" || paymentType === "renewal") {
        finalAmount = targetPlan.priceThb;
      } else if (paymentType === "upgrade") {
        remainingDays = Math.max(
          0,
          Math.ceil((expiryDate.getTime() - now.getTime()) / (24 * 60 * 60 * 1000))
        );
        const quote = calculateUpgradeFinalAmount({
          currentPlanId,
          targetPlanId,
          remainingDays,
        });
        remainingValue = quote.remainingValue;
        finalAmount = quote.finalAmount;
      } else {
        // Downgrade is scheduled for next cycle, but user still pays the next plan price.
        finalAmount = targetPlan.priceThb;
      }
    }

    return NextResponse.json({
      ok: true,
      paymentType,
      fromPlanId,
      toPlanId,
      quotedAmount,
      finalAmount,
      remainingValue,
      remainingDays,
      currentPlanId,
      activeSubscription,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal Server Error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

