import { NextResponse } from "next/server";
import { hash } from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import crypto from "crypto";
import { sendAdminAlertEmail } from "@/lib/admin-alert";
import { getTrustedAppOrigin } from "@/lib/app-origin";
import { claimReferralCode } from "@/lib/referral";

const emailSchema = z.string().trim().toLowerCase().email();

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      email?: string;
      password?: string;
      name?: string;
      referralCode?: string;
    };
    const emailInput = body.email?.trim();
    const password = body.password;
    const name = body.name?.trim() || null;
    if (body.referralCode !== undefined && typeof body.referralCode !== "string") {
      return NextResponse.json({ ok: false, error: "รหัสแนะนำเพื่อนไม่ถูกต้อง" }, { status: 400 });
    }
    const referralCode = body.referralCode?.trim() ?? "";
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
    if (referralCode && !/^[A-Za-z0-9]{2,32}$/.test(referralCode)) {
      return NextResponse.json({ ok: false, error: "รหัสแนะนำเพื่อนไม่ถูกต้อง" }, { status: 400 });
    }
    const appOrigin = getTrustedAppOrigin(req);
    if (!appOrigin) {
      return NextResponse.json(
        { ok: false, error: "ระบบยังไม่ได้ตั้งค่า APP_ORIGIN/NEXTAUTH_URL สำหรับลิงก์ยืนยันอีเมล" },
        { status: 500 }
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

    let user: { id: string };
    try {
      user = await prisma.$transaction(async (tx) => {
        const created = await tx.user.create({
          data: {
            email,
            name: name || email.split("@")[0],
            passwordHash,
            emailVerifyToken: verifyToken,
            plan: "trial",
            role: "user",
          },
        });
        if (referralCode) {
          const clientIp = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || null;
          await claimReferralCode({
            referredUserId: created.id,
            referralCode,
            claimedIp: clientIp,
            claimedUserAgent: req.headers.get("user-agent"),
            db: tx,
          });
        }
        return created;
      });
    } catch (error) {
      if (error instanceof Error && ["รหัสแนะนำเพื่อนไม่ถูกต้อง", "ไม่พบรหัสแนะนำเพื่อน", "ไม่สามารถใช้รหัสของตัวเองได้", "บัญชีนี้ถูกผูก referral แล้ว"].includes(error.message)) {
        return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
      }
      throw error;
    }
    const verifyUrl = `${appOrigin}/api/auth/verify-email?token=${verifyToken}`;

    await sendAdminAlertEmail({
      subject: "DischargeX: New user signup",
      lines: [
        `Email: ${email}`,
        `Name: ${name || "-"}`,
        `User ID: ${user.id}`,
        `Plan: trial`,
      ],
    });

    const emailFrom = process.env.EMAIL_FROM?.trim();
    if (process.env.RESEND_API_KEY) {
      if (!emailFrom) {
        return NextResponse.json(
          { ok: false, error: "ตั้งค่า EMAIL_FROM ไม่ครบในระบบ" },
          { status: 500 }
        );
      }
      try {
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
            html: `<p>สวัสดีครับ</p><p>กรุณาคลิกลิงก์ด้านล่างเพื่อยืนยันอีเมลของคุณ:</p><p><a href="${verifyUrl}">${verifyUrl}</a></p><p>ลิงก์นี้ใช้ได้ครั้งเดียว</p>`,
          }),
        });
        if (!resendRes.ok) {
          const resendErrText = await resendRes.text();
          let resendDetail = resendErrText;
          try {
            const parsed = JSON.parse(resendErrText) as {
              message?: string;
              error?: string;
              name?: string;
            };
            resendDetail = parsed.message || parsed.error || parsed.name || resendErrText;
          } catch {}
          throw new Error(`Resend API failed (${resendRes.status}): ${resendDetail}`);
        }
      } catch (emailErr) {
        console.error("Send verify email error:", emailErr);
        const emailErrMsg = emailErr instanceof Error ? emailErr.message : String(emailErr);
        try {
          await prisma.user.delete({ where: { id: user.id } });
        } catch (cleanupErr) {
          console.error("Cleanup user after email failure error:", cleanupErr);
        }
        return NextResponse.json(
          { ok: false, error: `ส่งอีเมลยืนยันไม่สำเร็จ: ${emailErrMsg}` },
          { status: 502 }
        );
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
