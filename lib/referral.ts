import { prisma } from "./prisma";
import { ensureUserReferralCode } from "./bonus-credits";
import { notifyUser } from "./notifications";
import { REFERRAL_BONUS_FIRST_PURCHASE } from "./referral-constants";

export { REFERRAL_BONUS_FIRST_PURCHASE, REFERRAL_BONUS_FIRST_USAGE } from "./referral-constants";

export function shouldAwardReferralForCheckout(mode: string, paymentStatus: string | null, paymentType: string) {
  return mode === "subscription" && paymentStatus === "paid" && paymentType === "new";
}

export function shouldAwardReferralForPaidInvoice(billingReason: string | null, amountPaid: number | null) {
  return billingReason === "subscription_create" && typeof amountPaid === "number" && amountPaid > 0;
}

export async function getReferralDashboard(userId: string) {
  const code = await ensureUserReferralCode(userId);
  const rows = await prisma.referral.findMany({
    where: { referrerUserId: userId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      status: true,
      signupAt: true,
      firstUsageAt: true,
      firstPurchaseAt: true,
      signupCreditGranted: true,
      usageCreditGranted: true,
      purchaseCreditGranted: true,
    },
    take: 100,
  });

  const stats = rows.reduce(
    (acc, row) => {
      acc.referredCount += 1;
      if (row.firstPurchaseAt) acc.firstPurchases += 1;
      acc.boostEarned += row.signupCreditGranted + row.usageCreditGranted + row.purchaseCreditGranted;
      return acc;
    },
    { referredCount: 0, firstPurchases: 0, boostEarned: 0 }
  );

  return {
    referralCode: code,
    stats,
    history: rows.map((r) => ({
      id: r.id,
      signupAt: r.signupAt.toISOString(),
      firstUsageAt: r.firstUsageAt?.toISOString() ?? null,
      firstPurchaseAt: r.firstPurchaseAt?.toISOString() ?? null,
      creditsEarned: r.signupCreditGranted + r.usageCreditGranted + r.purchaseCreditGranted,
      status: r.status,
    })),
  };
}

export async function claimReferralCode(params: {
  referredUserId: string;
  referralCode: string;
  claimedIp?: string | null;
  claimedUserAgent?: string | null;
}) {
  const code = params.referralCode.trim().toUpperCase();
  if (!/^[A-Z0-9]{2,32}$/.test(code)) throw new Error("รหัสแนะนำเพื่อนไม่ถูกต้อง");
  const referrer = await prisma.user.findFirst({
    where: { referralCode: code },
    select: { id: true },
  });
  if (!referrer) throw new Error("ไม่พบรหัสแนะนำเพื่อน");
  if (referrer.id === params.referredUserId) throw new Error("ไม่สามารถใช้รหัสของตัวเองได้");

  const exists = await prisma.referral.findUnique({
    where: { referredUserId: params.referredUserId },
    select: { id: true },
  });
  if (exists) throw new Error("บัญชีนี้ถูกผูก referral แล้ว");

  const claimedIp = params.claimedIp ?? null;
  const claimedUserAgent = params.claimedUserAgent ?? null;

  const recentSameIpCount =
    claimedIp != null
      ? await prisma.referral.count({
          where: { claimedIp, createdAt: { gte: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000) } },
        })
      : 0;
  const suspicious = claimedIp != null && recentSameIpCount >= 3;

  await prisma.referral.create({
    data: {
      referrerUserId: referrer.id,
      referredUserId: params.referredUserId,
      referralCode: code,
      signupCreditGranted: 0,
      claimedIp,
      claimedUserAgent,
      suspiciousFlag: suspicious,
      status: suspicious ? "suspicious" : "active",
      suspiciousReason: suspicious ? "high_volume_same_ip_claims" : null,
    },
  });
}

export async function markReferralFirstUsage(referredUserId: string) {
  const referral = await prisma.referral.findUnique({
    where: { referredUserId },
  });
  if (!referral || referral.firstUsageAt) return;
  const updated = await prisma.referral.updateMany({
    where: { id: referral.id, firstUsageAt: null },
    data: { firstUsageAt: new Date() },
  });
  return updated.count > 0;
}

export async function markReferralFirstPurchase(referredUserId: string) {
  const referral = await prisma.referral.findUnique({
    where: { referredUserId },
  });
  if (!referral || referral.firstPurchaseAt || referral.purchaseCreditGranted > 0 || referral.status !== "active") return;

  const granted = await prisma.$transaction(async (tx) => {
    const updated = await tx.referral.updateMany({
      where: { id: referral.id, firstPurchaseAt: null, status: "active" },
      data: {
        firstPurchaseAt: new Date(),
        purchaseCreditGranted: REFERRAL_BONUS_FIRST_PURCHASE,
      },
    });
    if (updated.count !== 1) return false;
    await tx.user.update({
      where: { id: referral.referrerUserId },
      data: { extraCredits: { increment: REFERRAL_BONUS_FIRST_PURCHASE } },
    });
    await tx.creditLedger.create({
      data: {
        userId: referral.referrerUserId,
        sourceType: "referral",
        sourceId: referral.id,
        amount: REFERRAL_BONUS_FIRST_PURCHASE,
        direction: "plus",
        note: "Referral Boost passes: first paid subscription",
        createdBy: "system",
      },
    });
    return true;
  });
  if (granted) {
    await notifyUser({
      userId: referral.referrerUserId,
      type: "bonus",
      title: "Referral: เพื่อนซื้อแพ็กเกจครั้งแรก",
      message: `เพื่อนที่คุณแนะนำซื้อแพ็กเกจแบบชำระเงินครั้งแรก คุณได้รับ Boost ${REFERRAL_BONUS_FIRST_PURCHASE} สิทธิ์ ใช้ได้ขณะแพ็กเกจของคุณยัง active หรือ pending_change`,
      meta: { referralId: referral.id, milestone: "first_purchase", credit: REFERRAL_BONUS_FIRST_PURCHASE, creditType: "boost_passes" },
    });
  }
}
