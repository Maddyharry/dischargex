import { NextResponse } from "next/server";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";

function resolveAppOrigin(req: Request): string {
  const forwardedProto = req.headers.get("x-forwarded-proto")?.trim();
  const forwardedHost = req.headers.get("x-forwarded-host")?.trim();
  if (forwardedProto && forwardedHost) {
    return `${forwardedProto}://${forwardedHost}`;
  }

  const host = req.headers.get("host")?.trim();
  if (host) {
    const proto = host.includes("localhost") ? "http" : "https";
    return `${proto}://${host}`;
  }

  const origin = req.headers.get("origin")?.trim();
  if (origin) return origin;

  const referer = req.headers.get("referer")?.trim();
  if (referer) {
    try {
      return new URL(referer).origin;
    } catch {}
  }

  return process.env.NEXTAUTH_URL?.trim() || "";
}

function isValidEmail(value: string): boolean {
  const email = value.trim().toLowerCase();
  if (!email) return false;
  if (email.includes("..")) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { email?: string };
    const email = body.email?.trim().toLowerCase() || "";
    if (!isValidEmail(email)) {
      return NextResponse.json({ ok: false, error: "รูปแบบอีเมลไม่ถูกต้อง" }, { status: 400 });
    }

    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, emailVerified: true },
    });

    if (!user || user.emailVerified) {
      return NextResponse.json({
        ok: true,
        message:
          "หากอีเมลนี้อยู่ในระบบและยังไม่ยืนยัน เราได้ส่งอีเมลยืนยันให้เรียบร้อยแล้ว",
      });
    }

    const verifyToken = crypto.randomBytes(32).toString("hex");
    await prisma.user.update({
      where: { id: user.id },
      data: { emailVerifyToken: verifyToken },
    });

    const appOrigin = resolveAppOrigin(req);
    const verifyUrl = `${appOrigin}/api/auth/verify-email?token=${verifyToken}`;

    if (process.env.RESEND_API_KEY) {
      const emailFrom = process.env.EMAIL_FROM?.trim();
      if (!emailFrom) {
        return NextResponse.json(
          { ok: false, error: "ตั้งค่า EMAIL_FROM ไม่ครบในระบบ" },
          { status: 500 }
        );
      }
      const resendRes = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: emailFrom,
          to: [email],
          subject: "ยืนยันอีเมล DischargeX",
          html: `<p>สวัสดีครับ</p><p>นี่คือลิงก์ยืนยันอีเมลของคุณ:</p><p><a href="${verifyUrl}">${verifyUrl}</a></p><p>หากไม่พบอีเมล กรุณาตรวจสอบโฟลเดอร์ Spam/Junk/Promotions</p>`,
        }),
      });

      if (!resendRes.ok) {
        const err = await resendRes.text();
        return NextResponse.json(
          { ok: false, error: `ส่งอีเมลไม่สำเร็จ: ${err}` },
          { status: 502 }
        );
      }
    }

    const response: Record<string, unknown> = {
      ok: true,
      message:
        "หากอีเมลนี้อยู่ในระบบและยังไม่ยืนยัน เราได้ส่งอีเมลยืนยันให้เรียบร้อยแล้ว",
    };
    if (!process.env.RESEND_API_KEY) {
      response.verifyUrl = verifyUrl;
    }
    return NextResponse.json(response);
  } catch (e) {
    console.error("Resend verification error:", e);
    return NextResponse.json(
      { ok: false, error: "เกิดข้อผิดพลาด กรุณาลองใหม่" },
      { status: 500 }
    );
  }
}
