import { NextResponse } from "next/server";
import { hash } from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import crypto from "crypto";

const emailSchema = z.string().trim().toLowerCase().email();

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      email?: string;
      password?: string;
      name?: string;
    };
    const emailInput = body.email?.trim();
    const password = body.password;
    const name = body.name?.trim() || null;
    if (!emailInput || !password) {
      return NextResponse.json(
        { ok: false, error: "กรุณาระบุอีเมลและรหัสผ่าน" },
        { status: 400 }
      );
    }
    const parsed = emailSchema.safeParse(emailInput);
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: "รูปแบบอีเมลไม่ถูกต้อง กรุณาใช้อีเมลจริง" },
        { status: 400 }
      );
    }
    const email = parsed.data;
    if (password.length < 6) {
      return NextResponse.json(
        { ok: false, error: "รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร" },
        { status: 400 }
      );
    }
    const existing = await prisma.user.findUnique({
      where: { email },
      select: { id: true, emailVerified: true },
    });
    if (existing) {
      return NextResponse.json(
        { ok: false, error: "อีเมลนี้ลงทะเบียนแล้ว กรุณาเข้าสู่ระบบหรือใช้ลืมรหัสผ่าน" },
        { status: 400 }
      );
    }
    const passwordHash = await hash(password, 10);
    const verifyToken = crypto.randomBytes(32).toString("hex");

    const user = await prisma.user.create({
      data: {
        email,
        name: name || email.split("@")[0],
        passwordHash,
        emailVerifyToken: verifyToken,
        plan: "trial",
        role: "user",
      },
    });

    const origin = req.headers.get("origin") || req.headers.get("referer")?.replace(/\/[^/]*$/, "") || "";
    const verifyUrl = `${origin}/api/auth/verify-email?token=${verifyToken}`;

    if (process.env.RESEND_API_KEY) {
      try {
        await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: process.env.EMAIL_FROM || "DischargeX <noreply@dischargex.com>",
            to: [email],
            subject: "ยืนยันอีเมล DischargeX",
            html: `<p>สวัสดีครับ</p><p>กรุณาคลิกลิงก์ด้านล่างเพื่อยืนยันอีเมลของคุณ:</p><p><a href="${verifyUrl}">${verifyUrl}</a></p><p>ลิงก์นี้ใช้ได้ครั้งเดียว</p>`,
          }),
        });
      } catch (emailErr) {
        console.error("Send verify email error:", emailErr);
      }
    }

    const response: Record<string, unknown> = {
      ok: true,
      message: "สมัครสมาชิกสำเร็จ กรุณาตรวจสอบอีเมลเพื่อยืนยันก่อนเข้าสู่ระบบ",
      needVerify: true,
    };
    if (!process.env.RESEND_API_KEY) {
      response.verifyUrl = verifyUrl;
    }
    return NextResponse.json(response);
  } catch (e) {
    console.error("Register error:", e);
    return NextResponse.json(
      { ok: false, error: "เกิดข้อผิดพลาด กรุณาลองใหม่" },
      { status: 500 }
    );
  }
}
