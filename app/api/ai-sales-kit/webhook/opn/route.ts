import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { AI_SALES_KIT_PACKAGES, verifyOpnWebhookSignature } from "@/lib/ai-sales-kit";

export const runtime = "nodejs";

type OpnWebhookPayload = {
  key?: string;
  data?: {
    id?: string;
    object?: string;
    status?: string;
    paid?: boolean;
    amount?: number;
    metadata?: Record<string, string | undefined>;
  };
};

function isPaidCharge(payload: OpnWebhookPayload) {
  if (payload.key && payload.key !== "charge.complete") return false;
  const charge = payload.data;
  if (!charge) return false;
  return charge.object === "charge" && (charge.paid === true || charge.status === "successful");
}

export async function POST(req: Request) {
  const rawBody = await req.text();
  if (!verifyOpnWebhookSignature(rawBody, req.headers)) {
    return NextResponse.json({ ok: false, error: "Invalid signature" }, { status: 401 });
  }

  let payload: OpnWebhookPayload;
  try {
    payload = JSON.parse(rawBody) as OpnWebhookPayload;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  if (!isPaidCharge(payload)) {
    return NextResponse.json({ ok: true, ignored: true });
  }

  const charge = payload.data!;
  const orderId = charge.metadata?.orderId || "";
  if (!orderId) {
    return NextResponse.json({ ok: false, error: "Missing orderId metadata" }, { status: 400 });
  }

  const order = await prisma.aiSalesKitOrder.findUnique({ where: { id: orderId } });
  if (!order) {
    return NextResponse.json({ ok: false, error: "Order not found" }, { status: 404 });
  }

  const packageInfo = AI_SALES_KIT_PACKAGES[order.packageId as keyof typeof AI_SALES_KIT_PACKAGES];
  if (!packageInfo) {
    return NextResponse.json({ ok: false, error: "Invalid package" }, { status: 400 });
  }

  const expectedAmountSatang = packageInfo.priceThb * 100;
  if (typeof charge.amount === "number" && charge.amount !== expectedAmountSatang) {
    return NextResponse.json({ ok: false, error: "Amount mismatch" }, { status: 400 });
  }

  await prisma.aiSalesKitOrder.update({
    where: { id: order.id },
    data: {
      status: "paid",
      paymentProvider: "opn",
      opnChargeId: charge.id || order.opnChargeId,
      paidAt: new Date(),
      deliveredAt: order.deliveredAt ?? new Date(),
      deliveryWebhookOk: true,
      deliveryWebhookLog: rawBody,
    },
  });

  return NextResponse.json({ ok: true });
}
