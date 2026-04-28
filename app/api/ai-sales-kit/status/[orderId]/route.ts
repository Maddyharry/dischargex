import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAiSalesKitDownloadUrl, isAiSalesKitPaidStatus } from "@/lib/ai-sales-kit";

export const runtime = "nodejs";

export async function GET(req: Request, { params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await params;
  const order = await prisma.aiSalesKitOrder.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      packageId: true,
      amountThb: true,
      customerEmail: true,
      status: true,
      paymentProvider: true,
      opnChargeId: true,
      qrImageUrl: true,
      qrText: true,
      downloadToken: true,
      paidAt: true,
      deliveredAt: true,
    },
  });
  if (!order) {
    return NextResponse.json({ ok: false, error: "Order not found" }, { status: 404 });
  }
  const origin = new URL(req.url).origin;
  return NextResponse.json({
    ok: true,
    orderId: order.id,
    packageId: order.packageId,
    amount: order.amountThb,
    customerEmail: order.customerEmail,
    status: order.status,
    paid: isAiSalesKitPaidStatus(order.status),
    paymentProvider: order.paymentProvider,
    opnChargeId: order.opnChargeId,
    qrImageUrl: order.qrImageUrl,
    qrText: order.qrText,
    downloadUrl:
      order.downloadToken && isAiSalesKitPaidStatus(order.status)
        ? getAiSalesKitDownloadUrl(origin, order.downloadToken)
        : null,
    paidAt: order.paidAt,
    deliveredAt: order.deliveredAt,
  });
}
