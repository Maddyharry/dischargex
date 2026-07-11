import { NextResponse } from "next/server";
import { compare } from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { createApiToken } from "@/lib/api-token";
import { consumeRateLimit, getRequestIdentity } from "@/lib/request-rate-limit";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { email?: string; password?: string };
  const email = body.email?.trim().toLowerCase();
  const password = body.password;

  if (!email || !password) {
    return NextResponse.json({ ok: false, error: "กรุณากรอกอีเมลและรหัสผ่าน" }, { status: 400 });
  }

  // ป้องกัน brute-force: จำกัดทั้งต่อ IP และต่ออีเมลที่พยายามล็อกอิน
  const ipIdentity = getRequestIdentity(null, req.headers.get("x-forwarded-for"), req.headers.get("user-agent"));
  const ipRate = consumeRateLimit(`automator-login:${ipIdentity}`, 10, 60_000);
  if (!ipRate.allowed) {
    return NextResponse.json(
      { ok: false, error: "พยายามล็อกอินถี่เกินไป กรุณารอสักครู่" },
      { status: 429, headers: { "Retry-After": String(ipRate.retryAfterSec) } }
    );
  }
  const emailRate = consumeRateLimit(`automator-login-email:${email}`, 5, 60_000);
  if (!emailRate.allowed) {
    return NextResponse.json(
      { ok: false, error: "พยายามล็อกอินถี่เกินไป กรุณารอสักครู่" },
      { status: 429, headers: { "Retry-After": String(emailRate.retryAfterSec) } }
    );
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
