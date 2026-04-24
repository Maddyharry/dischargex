import { prisma } from "./prisma";
import { grantBonusCredits, ensureUserReferralCode } from "./bonus-credits";
import { notifyUser } from "./notifications";
import {
  REFERRAL_BONUS_FIRST_PURCHASE,
  REFERRAL_BONUS_FIRST_USAGE,
} from "./referral-constants";

export { REFERRAL_BONUS_FIRST_PURCHASE, REFERRAL_BONUS_FIRST_USAGE } from "./referral-constants";

export async function getReferralDashboard(userId: string) {
  const code = await ensureUserReferralCode(userId);
  const rows = await prisma.referral.findMany({
    where: { referrerUserId: userId },
    orderBy: { createdAt: "desc" },
    include: {
      referred: { select: { email: true, name: true } },
    },
    take: 100,
  });

  const stats = rows.reduce(
    (acc, row) => {
      acc.signups += 1;
      if (row.firstUsageAt) acc.firstUsages += 1;
      if (row.firstPurchaseAt) acc.firstPurchases += 1;
      acc.credits += row.signupCreditGranted + row.usageCreditGranted + row.purchaseCreditGranted;
      return acc;
    },
    { signups: 0, firstUsages: 0, firstPurchases: 0, credits: 0 }
  );

  return {
    referralCode: code,
    stats,
    history: rows.map((r) => ({
      id: r.id,
      referredName: r.referred?.name ?? null,
      referredEmail: r.referred?.email ?? null,
      signupAt: r.signupAt.toISOString(),
      firstUsageAt: r.firstUsageAt?.toISOString() ?? null,
      firstPurchaseAt: r.firstPurchaseAt?.toISOString() ?? null,
      creditsEarned: r.signupCreditGranted + r.usageCreditGranted + r.purchaseCreditGranted,
      status: r.status,
      suspiciousFlag: r.suspiciousFlag,
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
  if (!code) throw new Error("รหัสแนะนำเพื่อนไม่ถูกต้อง");
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
  if (referral.status === "blocked" || referral.status === "suspicious") return;

  const updated = await prisma.referral.updateMany({
    where: { id: referral.id, firstUsageAt: null },
    data: {
      firstUsageAt: new Date(),
      usageCreditGranted: REFERRAL_BONUS_FIRST_USAGE,
    },
  });
  if (updated.count > 0) {
    await grantBonusCredits({
      userId: referral.referrerUserId,
      amount: REFERRAL_BONUS_FIRST_USAGE,
      sourceType: "referral",
      sourceId: referral.id,
      note: "Referral milestone: first usage",
      createdBy: "system",
    });
    await notifyUser({
      userId: referral.referrerUserId,
      type: "bonus",
      title: "Referral: เพื่อนเริ่มใช้งานแล้ว",
      message: `มีเพื่อนที่คุณแนะนำเริ่มใช้งานจริง โบนัส +${REFERRAL_BONUS_FIRST_USAGE} หน่วยโควตา`,
      meta: { referralId: referral.id, milestone: "first_usage", credit: REFERRAL_BONUS_FIRST_USAGE },
    });
  }
}

export async function markReferralFirstPurchase(referredUserId: string) {
  const referral = await prisma.referral.findUnique({
    where: { referredUserId },
  });
  if (!referral || referral.firstPurchaseAt) return;
  if (referral.status === "blocked" || referral.status === "suspicious") return;

  const updated = await prisma.referral.updateMany({
    where: { id: referral.id, firstPurchaseAt: null },
    data: {
      firstPurchaseAt: new Date(),
      purchaseCreditGranted: REFERRAL_BONUS_FIRST_PURCHASE,
    },
  });
  if (updated.count > 0) {
    await grantBonusCredits({
      userId: referral.referrerUserId,
      amount: REFERRAL_BONUS_FIRST_PURCHASE,
      sourceType: "referral",
      sourceId: referral.id,
      note: "Referral milestone: first purchase",
      createdBy: "system",
    });
    await notifyUser({
      userId: referral.referrerUserId,
      type: "bonus",
      title: "Referral: เพื่อนซื้อแพ็กเกจครั้งแรก",
      message: `มีเพื่อนที่คุณแนะนำซื้อแพ็กเกจครั้งแรก โบนัส +${REFERRAL_BONUS_FIRST_PURCHASE} หน่วยโควตา`,
      meta: { referralId: referral.id, milestone: "first_purchase", credit: REFERRAL_BONUS_FIRST_PURCHASE },
    });
  }
}
