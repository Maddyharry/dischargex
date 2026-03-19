import { NextResponse } from "next/server";
import { hash } from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

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
      select: { id: true },
    });
    if (existing) {
      return NextResponse.json(
        { ok: false, error: "อีเมลนี้ลงทะเบียนแล้ว กรุณาเข้าสู่ระบบหรือใช้ลืมรหัสผ่าน" },
        { status: 400 }
      );
    }
    const passwordHash = await hash(password, 10);
    await prisma.user.create({
      data: {
        email,
        name: name || email.split("@")[0],
        passwordHash,
        plan: "trial",
        role: "user",
      },
    });
    return NextResponse.json({ ok: true, message: "สมัครสมาชิกสำเร็จ กรุณาเข้าสู่ระบบ" });
  } catch (e) {
    console.error("Register error:", e);
    return NextResponse.json(
      { ok: false, error: "เกิดข้อผิดพลาด กรุณาลองใหม่" },
      { status: 500 }
    );
  }
}
