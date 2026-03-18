import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getReferralDashboard } from "@/lib/referral";

export const runtime = "nodejs";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { id: true },
  });
  if (!user) {
    return NextResponse.json({ ok: false, error: "User not found" }, { status: 404 });
  }

  const referral = await getReferralDashboard(user.id);
  const ledgers = await prisma.creditLedger.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: {
      id: true,
      sourceType: true,
      sourceId: true,
      amount: true,
      direction: true,
      note: true,
      createdAt: true,
    },
  });

  type LedgerRow = (typeof ledgers)[number];
  return NextResponse.json({
    ok: true,
    referral,
    ledger: ledgers.map((l: LedgerRow) => ({
      ...l,
      createdAt: l.createdAt.toISOString(),
    })),
  });
}
