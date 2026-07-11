import { NextResponse } from "next/server";
import { compare } from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { createApiToken } from "@/lib/api-token";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { email?: string; password?: string };
  const email = body.email?.trim().toLowerCase();
  const password = body.password;

  if (!email || !password) {
    return NextResponse.json({ ok: false, error: "กรุณากรอกอีเมลและรหัสผ่าน" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, name: true, plan: true, passwordHash: true, emailVerified: true },
  });

  if (!user?.passwordHash) {
    return NextResponse.json(
      { ok: false, error: "ไม่พบบัญชีนี้ หรือบัญชีนี้ล็อกอินด้วย Google เท่านั้น (ตั้งรหัสผ่านที่หน้าเว็บก่อน)" },
      { status: 401 }
    );
  }

  const passwordOk = await compare(password, user.passwordHash);
  if (!passwordOk) {
    return NextResponse.json({ ok: false, error: "อีเมลหรือรหัสผ่านไม่ถูกต้อง" }, { status: 401 });
  }

  if (!user.emailVerified) {
    return NextResponse.json({ ok: false, error: "กรุณายืนยันอีเมลก่อนใช้งาน Automator" }, { status: 403 });
  }

  const created = await createApiToken(user.id, "Automator login");

  return NextResponse.json({
    ok: true,
    token: created.rawToken,
    name: user.name,
    plan: user.plan,
  });
}
