import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { claimReferralCode } from "@/lib/referral";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
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

    const body = (await req.json()) as { referralCode?: string };
    const referralCode = String(body.referralCode || "").trim();
    if (!referralCode) {
      return NextResponse.json({ ok: false, error: "กรุณากรอกรหัสแนะนำเพื่อน" }, { status: 400 });
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

    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "บันทึก referral ไม่สำเร็จ" },
      { status: 400 }
    );
  }
}
