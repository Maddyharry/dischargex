import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type PrismaTx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

export const runtime = "nodejs";

function isAdmin(session: unknown) {
  return (session as { user?: { role?: string } } | null)?.user?.role === "admin";
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!isAdmin(session)) {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = (await req.json()) as {
      userId?: string;
      creditDelta?: number;
      expiryDeltaDays?: number;
      note?: string;
    };

    const userId = body.userId?.trim();
    const creditDelta = Number(body.creditDelta ?? 0);
    const expiryDeltaDays = Number(body.expiryDeltaDays ?? 0);
    const note = body.note?.trim() || null;

    if (!userId) {
      return NextResponse.json({ ok: false, error: "Missing userId" }, { status: 400 });
    }
    if (!Number.isFinite(creditDelta) || !Number.isFinite(expiryDeltaDays)) {
      return NextResponse.json({ ok: false, error: "Delta format invalid" }, { status: 400 });
    }
    if (creditDelta === 0 && expiryDeltaDays === 0) {
      return NextResponse.json({ ok: false, error: "No adjustment provided" }, { status: 400 });
    }

    const reviewerEmail = (session?.user as { email?: string } | undefined)?.email ?? "admin";
    const now = new Date();

    const result = await prisma.$transaction(async (tx: PrismaTx) => {
      const user = await tx.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          extraCredits: true,
          subscriptionExpiresAt: true,
        },
      });
      if (!user) throw new Error("User not found");

      const updates: {
        extraCredits?: number;
        subscriptionExpiresAt?: Date;
        subscriptionStatus?: string;
      } = {};

      if (creditDelta !== 0) {
        const nextCredits = user.extraCredits + creditDelta;
        if (nextCredits < 0) {
          throw new Error("เครดิตคงเหลือไม่พอสำหรับการหัก");
        }
        updates.extraCredits = nextCredits;
      }

      if (expiryDeltaDays !== 0) {
        const baseExpiry = user.subscriptionExpiresAt ?? now;
        const shifted = new Date(baseExpiry.getTime() + expiryDeltaDays * 24 * 60 * 60 * 1000);
        updates.subscriptionExpiresAt = shifted;
        updates.subscriptionStatus = shifted.getTime() > now.getTime() ? "active" : "expired";
      }

      await tx.user.update({
        where: { id: user.id },
        data: updates,
      });

      await tx.entitlementLog.create({
        data: {
          userId: user.id,
          action: "manual_adjust",
          creditsDelta: creditDelta,
          expiryDeltaDays,
          note: note ?? "Manual admin adjustment",
        },
      });

      if (creditDelta !== 0) {
        await tx.creditLedger.create({
          data: {
            userId: user.id,
            sourceType: "manual",
            amount: Math.abs(creditDelta),
            direction: creditDelta > 0 ? "plus" : "minus",
            note: note ?? "Manual admin adjustment",
            createdBy: reviewerEmail,
          },
        });
      }

      return { userId: user.id };
    });

    return NextResponse.json({ ok: true, ...result });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal Server Error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

