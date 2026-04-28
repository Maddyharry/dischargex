import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  AI_SALES_KIT_PACKAGES,
  createAiSalesKitOrderId,
  createAiSalesKitDownloadToken,
  createOpnPromptPayCharge,
  normalizeAiSalesKitPackage,
} from "@/lib/ai-sales-kit";

export const runtime = "nodejs";

type CheckoutBody = {
  packageId?: string;
  productId?: string;
  name?: string;
  email?: string;
  lineId?: string;
  lineUserId?: string;
  phone?: string;
  source?: string;
  utmCampaign?: string;
  utmAd?: string;
};

function sanitizeText(value: unknown, maxLength = 180) {
  return String(value || "").trim().slice(0, maxLength);
}

function isEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as CheckoutBody;
    const packageInfo = normalizeAiSalesKitPackage(body.packageId || body.productId);
    if (!packageInfo) {
      return NextResponse.json({ ok: false, error: "กรุณาเลือกแพ็กสินค้า" }, { status: 400 });
    }
    const packageId = packageInfo.id;

    const customerEmail = sanitizeText(body.email).toLowerCase();
    const customerName = sanitizeText(body.name || "AI Sales Kit Customer");
    const lineUserId = sanitizeText(body.lineId || body.lineUserId);
    if (!customerEmail && !lineUserId) {
      return NextResponse.json(
        { ok: false, error: "กรุณาระบุอีเมลหรือ LINE user id เพื่อส่งไฟล์หลังชำระเงิน" },
        { status: 400 },
      );
    }
    if (customerEmail && !isEmail(customerEmail)) {
      return NextResponse.json({ ok: false, error: "รูปแบบอีเมลไม่ถูกต้อง" }, { status: 400 });
    }

    const metadata = {
      packageId,
      source: sanitizeText(body.source || "web"),
      utmCampaign: sanitizeText(body.utmCampaign),
      utmAd: sanitizeText(body.utmAd),
    };

    const order = await prisma.aiSalesKitOrder.create({
      data: {
        id: createAiSalesKitOrderId(),
        packageId,
        amountThb: packageInfo.priceThb,
        customerEmail: customerEmail || "",
        customerLineId: lineUserId || null,
        status: "created",
        paymentProvider: "opn",
        downloadToken: createAiSalesKitDownloadToken(),
        sourceCampaign: metadata.utmCampaign || null,
        sourceAd: metadata.utmAd || null,
      },
    });

    const charge = await createOpnPromptPayCharge({
      orderId: order.id,
      amountThb: packageInfo.priceThb,
      packageId,
      customerEmail: customerEmail || undefined,
    });

    await prisma.aiSalesKitOrder.update({
      where: { id: order.id },
      data: {
        opnChargeId: charge.chargeId,
        opnSourceId: charge.sourceId || null,
        qrImageUrl: charge.qrImageUrl,
        qrText: charge.qrText,
        status: "qr_created",
      },
    });

    return NextResponse.json({
      ok: true,
      orderId: order.id,
      amount: packageInfo.priceThb,
      package: {
        id: packageInfo.id,
        label: packageInfo.label,
        priceThb: packageInfo.priceThb,
      },
      qrImageUrl: charge.qrImageUrl,
      paymentUrl: null,
      statusUrl: `/api/ai-sales-kit/status/${order.id}`,
    });
  } catch (error) {
    console.error("AI Sales Kit checkout error:", error);
    const message = error instanceof Error ? error.message : "เกิดข้อผิดพลาดในการสร้าง QR";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
