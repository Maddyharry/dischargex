import { NextResponse } from "next/server";
import { hash } from "bcryptjs";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { token?: string; password?: string };
    const token = body.token?.trim();
    const password = body.password;
    if (!token || !password) {
      return NextResponse.json(
        { ok: false, error: "กรุณาระบุ token และรหัสผ่านใหม่" },
        { status: 400 }
      );
    }
    if (password.length < 6) {
      return NextResponse.json(
        { ok: false, error: "รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร" },
        { status: 400 }
      );
    }
    const user = await prisma.user.findFirst({
      where: {
        passwordResetToken: token,
        passwordResetExpires: { gt: new Date() },
      },
      select: { id: true },
    });
    if (!user) {
      return NextResponse.json(
        { ok: false, error: "ลิงก์หมดอายุหรือไม่ถูกต้อง กรุณาขอลิงก์ใหม่" },
        { status: 400 }
      );
    }
    const passwordHash = await hash(password, 10);
    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        passwordResetToken: null,
        passwordResetExpires: null,
      },
    });
    return NextResponse.json({ ok: true, message: "ตั้งรหัสผ่านใหม่เรียบร้อย กรุณาเข้าสู่ระบบ" });
  } catch (e) {
    console.error("Reset password error:", e);
    return NextResponse.json(
      { ok: false, error: "เกิดข้อผิดพลาด กรุณาลองใหม่" },
      { status: 500 }
    );
  }
}
