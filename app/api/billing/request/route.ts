import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { addPayment } from "@/lib/payments-store";
import {
  calculateUpgradeFinalAmount,
  classifyPaidPlanChange,
  getAddonPrice,
  getPeriodBounds,
  getPlanDefinition,
  isPaidPlan,
  normalizePlanId,
  type PaymentType,
} from "@/lib/billing-rules";
import { THAI_PROVINCES, validateBirthDateBE, validateThaiPhone } from "@/lib/thai-input";
import { notifyUser } from "@/lib/notifications";
import { writeFile, mkdir } from "fs/promises";
import path from "path";

export const runtime = "nodejs";

function sanitizeSlipFileName(name: string): string {
  return name.replace(/[^a-zA-Z0-9.-]/g, "_") || "slip";
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    const form = await req.formData();

    const fullName = String(form.get("fullName") || "").trim();
    const birthDate = String(form.get("birthDate") || "").trim();
    const hospitalName = String(form.get("hospitalName") || "").trim();
    const province = String(form.get("province") || "").trim();
    const phone = String(form.get("phone") || "").trim();
    let planRequestedRaw = String(form.get("planRequested") || "").trim();
    const addCreditsRaw = form.get("addCredits");
    const addCredits = addCreditsRaw != null && addCreditsRaw !== "" ? parseInt(String(addCreditsRaw), 10) : null;
    const isAddCredits = addCredits != null && addCredits > 0;
    if (isAddCredits) planRequestedRaw = "add_credits";
    const slip = form.get("slip");

    const contactEmail = session?.user?.email || String(form.get("contactEmail") || "").trim();

    if (!session?.user?.email) {
      return NextResponse.json(
        { ok: false, error: "กรุณาเข้าสู่ระบบก่อน (Google หรือ Facebook) จึงจะส่งคำขอเปิดแพ็กเกจได้" },
        { status: 401 }
      );
    }

    if (!fullName || !birthDate || !hospitalName || !province || !phone || !planRequestedRaw || !slip) {
      return NextResponse.json({ ok: false, error: "กรุณากรอกข้อมูลให้ครบ" }, { status: 400 });
    }

    const birthErr = validateBirthDateBE(birthDate);
    if (birthErr) {
      return NextResponse.json({ ok: false, error: birthErr }, { status: 400 });
    }
    const phoneV = validateThaiPhone(phone);
    if (!phoneV.ok) {
      return NextResponse.json({ ok: false, error: phoneV.error }, { status: 400 });
    }
    if (!THAI_PROVINCES.includes(province)) {
      return NextResponse.json({ ok: false, error: "จังหวัดไม่ถูกต้อง" }, { status: 400 });
    }

    if (!(slip instanceof File)) {
      return NextResponse.json({ ok: false, error: "ไฟล์สลิปไม่ถูกต้อง" }, { status: 400 });
    }
    if (!slip.type.startsWith("image/")) {
      return NextResponse.json({ ok: false, error: "สลิปต้องเป็นไฟล์รูปภาพ" }, { status: 400 });
    }
    const MAX_SLIP_BYTES = 5 * 1024 * 1024; // 5MB
    if (slip.size > MAX_SLIP_BYTES) {
      return NextResponse.json(
        { ok: false, error: "ไฟล์สลิปใหญ่เกินไป (สูงสุด 5MB) กรุณาลดขนาดรูปแล้วลองใหม่" },
        { status: 400 }
      );
    }

    const dbUser = await prisma.user.findUnique({
      where: { email: contactEmail },
      select: {
        id: true,
        createdAt: true,
        plan: true,
        extraCredits: true,
        subscriptionStatus: true,
        subscriptionExpiresAt: true,
        periodStartedAt: true,
      },
    });
    const now = new Date();
    const currentPlanId = normalizePlanId(dbUser?.plan ?? "trial");
    const targetPlanId = isAddCredits ? null : normalizePlanId(planRequestedRaw);
    const targetPlan = targetPlanId ? getPlanDefinition(targetPlanId) : null;
    const periodStart = dbUser?.periodStartedAt ?? dbUser?.createdAt ?? now;
    const { end: periodEnd } = getPeriodBounds(periodStart, currentPlanId);
    const activeSubscription =
      (dbUser?.subscriptionStatus === "active" || dbUser?.subscriptionStatus === "pending_change") &&
      (dbUser?.subscriptionExpiresAt ?? periodEnd).getTime() > now.getTime();

    let paymentType: PaymentType;
    let quotedAmount: number | null = null;
    let finalAmount: number | null = null;
    const fromPlanId: string | null = currentPlanId;
    let toPlanId: string | null = targetPlanId;

    if (isAddCredits) {
      paymentType = "addon";
      const addonPrice = getAddonPrice(addCredits!);
      if (!addonPrice) {
        return NextResponse.json({ ok: false, error: "แพ็กเกจเครดิตเพิ่มไม่ถูกต้อง" }, { status: 400 });
      }
      if (!activeSubscription || !isPaidPlan(currentPlanId)) {
        return NextResponse.json(
          { ok: false, error: "ซื้อเครดิตเพิ่มได้เฉพาะบัญชีที่มี subscription แบบชำระเงินและยัง active" },
          { status: 400 }
        );
      }
      quotedAmount = addonPrice;
      finalAmount = addonPrice;
      toPlanId = null;
    } else {
      if (!targetPlan) {
        return NextResponse.json({ ok: false, error: "แผนที่เลือกไม่ถูกต้อง" }, { status: 400 });
      }
      quotedAmount = targetPlan.priceThb;

      paymentType = classifyPaidPlanChange({
        currentPlanId,
        targetPlanId,
        activeSubscription,
      });

      if (paymentType === "new" || paymentType === "renewal") {
        finalAmount = targetPlan.priceThb;
      } else if (paymentType === "upgrade") {
        const expiryDate = dbUser?.subscriptionExpiresAt ?? periodEnd;
        const remainingDays = Math.max(
          0,
          Math.ceil((expiryDate.getTime() - now.getTime()) / (24 * 60 * 60 * 1000))
        );
        const quote = calculateUpgradeFinalAmount({
          currentPlanId,
          targetPlanId,
          remainingDays,
        });
        finalAmount = quote.finalAmount;
      } else {
        // Downgrade is scheduled for next cycle, but user still pays the next plan price.
        finalAmount = targetPlan.priceThb;
      }
    }

    const id = `req_${Date.now()}`;
    const slipFileName = slip.name || "uploaded-slip";
    const safeName = sanitizeSlipFileName(slipFileName);
    const savedFileName = `${id}_${safeName}`;

    const dir = path.join(process.cwd(), "public", "uploads", "slips");
    await mkdir(dir, { recursive: true });
    const buf = Buffer.from(await slip.arrayBuffer());
    await writeFile(path.join(dir, savedFileName), buf);

    await addPayment({
      id,
      fullName,
      birthDate,
      hospitalName,
      province,
      phone: phoneV.normalized,
      contactEmail,
      planRequested: planRequestedRaw,
      slipFileName: savedFileName,
      addCredits: isAddCredits ? addCredits! : null,
      paymentType,
      fromPlanId,
      toPlanId,
      quotedAmount,
      finalAmount,
    });

    await prisma.user.updateMany({
      where: { email: contactEmail },
      data: {
        ...(fullName && { name: fullName }),
        ...(birthDate && { birthDate }),
        ...(phoneV.normalized && { phone: phoneV.normalized }),
        ...(hospitalName && { hospitalName }),
        ...(province && { province }),
      },
    });

    const userId =
      dbUser?.id ??
      (
        await prisma.user.findUnique({
          where: { email: contactEmail },
          select: { id: true },
        })
      )?.id ??
      null;

    if (userId) {
      const title = "ส่งคำขอชำระเงินแล้ว";
      const amountText = finalAmount != null ? `${finalAmount.toLocaleString("th-TH")} บาท` : "-";
      const message = isAddCredits
        ? `ได้รับคำขอซื้อเครดิตเพิ่ม ${addCredits} เครดิต (ยอดโอน ${amountText}) รอตรวจสลิป`
        : `ได้รับคำขอ ${paymentType} ไปแพ็กเกจ ${toPlanId ?? planRequestedRaw} (ยอดโอน ${amountText}) รอตรวจสลิป`;
      await notifyUser({
        userId,
        type: "billing",
        title,
        message,
        meta: { paymentRequestId: id, paymentType, toPlanId, finalAmount, addCredits },
      });
    }

    return NextResponse.json({ ok: true, redirectUrl: "/pricing?status=success" });
  } catch (err: unknown) {
    return NextResponse.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : "Internal Server Error",
      },
      { status: 500 }
    );
  }
}

