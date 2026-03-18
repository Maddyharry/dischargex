import { prisma } from "./prisma";
import crypto from "crypto";

type PrismaTx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

export async function grantBonusCredits(params: {
  userId: string;
  amount: number;
  sourceType: "feedback" | "referral" | "manual" | "adjustment";
  sourceId?: string | null;
  note?: string | null;
  createdBy?: string | null;
}) {
  if (!params.userId || params.amount <= 0) return;
  await prisma.$transaction(async (tx: PrismaTx) => {
    await tx.user.update({
      where: { id: params.userId },
      data: { extraCredits: { increment: params.amount } },
    });
    await tx.creditLedger.create({
      data: {
        userId: params.userId,
        sourceType: params.sourceType,
        sourceId: params.sourceId ?? null,
        amount: params.amount,
        direction: "plus",
        note: params.note ?? null,
        createdBy: params.createdBy ?? null,
      },
    });
  });
}

export async function revokeBonusCredits(params: {
  userId: string;
  amount: number;
  sourceType?: "feedback" | "referral" | "manual" | "adjustment" | "revoke";
  sourceId?: string | null;
  note?: string | null;
  createdBy?: string | null;
}) {
  if (!params.userId || params.amount <= 0) return;
  await prisma.$transaction(async (tx: PrismaTx) => {
    const updated = await tx.user.updateMany({
      where: { id: params.userId, extraCredits: { gte: params.amount } },
      data: { extraCredits: { decrement: params.amount } },
    });
    if (updated.count === 0) {
      throw new Error("เครดิตคงเหลือไม่พอสำหรับการ revoke");
    }
    await tx.creditLedger.create({
      data: {
        userId: params.userId,
        sourceType: params.sourceType ?? "revoke",
        sourceId: params.sourceId ?? null,
        amount: params.amount,
        direction: "minus",
        note: params.note ?? null,
        createdBy: params.createdBy ?? null,
      },
    });
  });
}

export async function ensureUserReferralCode(userId: string) {
  const current = await prisma.user.findUnique({
    where: { id: userId },
    select: { referralCode: true },
  });
  if (!current) return null;
  if (current.referralCode) return current.referralCode;

  // Keep it short (easy to share) but hard to guess.
  // Format: DX + 8 chars (base32 without ambiguous chars).
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const makeCode = () => {
    const bytes = crypto.randomBytes(8);
    let out = "DX";
    for (let i = 0; i < 8; i += 1) {
      out += alphabet[bytes[i] % alphabet.length];
    }
    return out;
  };

  // Retry on rare unique collisions.
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const code = makeCode();
    try {
      const updated = await prisma.user.update({
        where: { id: userId },
        data: { referralCode: code },
        select: { referralCode: true },
      });
      return updated.referralCode;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "";
      if (!message.toLowerCase().includes("unique")) throw err;
    }
  }

  throw new Error("สร้าง referral code ไม่สำเร็จ กรุณาลองใหม่");
}
