import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getReferralDashboard } from "@/lib/referral";

export const runtime = "nodejs";
const PRIVATE_NO_STORE = { "Cache-Control": "private, no-store, max-age=0" };

export async function GET() {
  try {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401, headers: PRIVATE_NO_STORE });
  }

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { id: true },
  });
  if (!user) {
    return NextResponse.json({ ok: false, error: "User not found" }, { status: 404, headers: PRIVATE_NO_STORE });
  }

  const referral = await getReferralDashboard(user.id);

  const alreadyClaimed = await prisma.referral.findUnique({
    where: { referredUserId: user.id },
    select: { id: true },
  });

  const ledgers = await prisma.creditLedger.findMany({
    where: { userId: user.id, sourceType: "referral" },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: {
      id: true,
      amount: true,
      direction: true,
      createdAt: true,
    },
  });

  type LedgerRow = (typeof ledgers)[number];
  return NextResponse.json({
    ok: true,
    referral,
    alreadyClaimed: Boolean(alreadyClaimed),
    ledger: ledgers.map((l: LedgerRow) => ({
      ...l,
      createdAt: l.createdAt.toISOString(),
    })),
  }, { headers: PRIVATE_NO_STORE });
  } catch {
    return NextResponse.json({ ok: false, error: "โหลดข้อมูลแนะนำเพื่อนไม่สำเร็จ" }, { status: 500, headers: PRIVATE_NO_STORE });
  }
}
