import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { claimReferralCode } from "@/lib/referral";

export const runtime = "nodejs";
const PRIVATE_NO_STORE = { "Cache-Control": "private, no-store, max-age=0" };

export async function POST(req: Request) {
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

    const body = (await req.json()) as { referralCode?: unknown };
    const referralCode = typeof body.referralCode === "string" ? body.referralCode.trim() : "";
    if (!/^[A-Za-z0-9]{2,32}$/.test(referralCode)) {
      return NextResponse.json({ ok: false, error: "รหัสแนะนำเพื่อนไม่ถูกต้อง" }, { status: 400, headers: PRIVATE_NO_STORE });
    }

    const existingReferral = await prisma.referral.findUnique({
      where: { referredUserId: user.id },
      select: { id: true },
    });
    if (existingReferral) {
      return NextResponse.json({ ok: true, alreadyClaimed: true }, { headers: PRIVATE_NO_STORE });
    }

    const clientIp =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      req.headers.get("x-real-ip") ||
      null;
    const clientUserAgent = req.headers.get("user-agent") || null;

    await claimReferralCode({
      referredUserId: user.id,
      referralCode,
      claimedIp: clientIp,
      claimedUserAgent: clientUserAgent,
    });

    return NextResponse.json({ ok: true }, { headers: PRIVATE_NO_STORE });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "บันทึก referral ไม่สำเร็จ" },
      { status: 400, headers: PRIVATE_NO_STORE }
    );
  }
}
