import { NextResponse } from "next/server";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";

const RESET_EXPIRY_HOURS = 1;

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { email?: string };
    const email = body.email?.trim();
    if (!email) {
      return NextResponse.json(
        { ok: false, error: "กรุณาระบุอีเมล" },
        { status: 400 }
      );
    }
    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, passwordHash: true },
    });
    if (!user?.passwordHash) {
      return NextResponse.json({
        ok: true,
        message: "ถ้าอีเมลนี้ลงทะเบียนด้วยอีเมล/รหัสผ่านแล้ว เราได้ส่งลิงก์รีเซ็ตรหัสผ่านไปที่อีเมลของคุณ",
      });
    }
    const token = crypto.randomBytes(32).toString("hex");
    const expires = new Date(Date.now() + RESET_EXPIRY_HOURS * 60 * 60 * 1000);
    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordResetToken: token,
        passwordResetExpires: expires,
      },
    });
    const baseUrl = process.env.NEXTAUTH_URL || "https://dischargex-beta.vercel.app";
    const resetLink = `${baseUrl}/reset-password?token=${token}`;

    if (process.env.RESEND_API_KEY) {
      try {
        const res = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
          },
          body: JSON.stringify({
            from: process.env.EMAIL_FROM || "DischargeX <noreply@dischargex.com>",
            to: email,
            subject: "รีเซ็ตรหัสผ่าน DischargeX",
            html: `<p>คลิกลิงก์ด้านล่างเพื่อตั้งรหัสผ่านใหม่ (ใช้ได้ ${RESET_EXPIRY_HOURS} ชั่วโมง):</p><p><a href="${resetLink}">${resetLink}</a></p>`,
          }),
        });
        if (!res.ok) throw new Error(await res.text());
      } catch (err) {
        console.error("Send email error:", err);
        return NextResponse.json({
          ok: true,
          message: "ไม่สามารถส่งอีเมลได้ในขณะนี้ กรุณาติดต่อแอดมิน",
          resetLink: process.env.NODE_ENV === "development" ? resetLink : undefined,
        });
      }
    }

    return NextResponse.json({
      ok: true,
      message: "ถ้าอีเมลนี้ลงทะเบียนด้วยอีเมล/รหัสผ่านแล้ว เราได้ส่งลิงก์รีเซ็ตรหัสผ่านไปที่อีเมลของคุณ",
      resetLink: process.env.NODE_ENV === "development" ? resetLink : undefined,
    });
  } catch (e) {
    console.error("Forgot password error:", e);
    return NextResponse.json(
      { ok: false, error: "เกิดข้อผิดพลาด กรุณาลองใหม่" },
      { status: 500 }
    );
  }
}
