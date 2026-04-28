import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAiSalesKitDeliveryFile, isAiSalesKitPaidStatus } from "@/lib/ai-sales-kit";

export const runtime = "nodejs";

type RouteParams = {
  params: Promise<{ token: string }>;
};

export async function GET(_req: NextRequest, { params }: RouteParams) {
  const { token } = await params;
  const cleanToken = token?.trim();
  if (!cleanToken) {
    return NextResponse.json({ ok: false, error: "Missing download token" }, { status: 400 });
  }

  const order = await prisma.aiSalesKitOrder.findUnique({
    where: { downloadToken: cleanToken },
    select: {
      id: true,
      packageId: true,
      status: true,
      customerEmail: true,
    },
  });

  if (!order || !isAiSalesKitPaidStatus(order.status)) {
    return NextResponse.json({ ok: false, error: "Download not available" }, { status: 404 });
  }

  const file = getAiSalesKitDeliveryFile(order.packageId);
  const bytes = await file.bytes();

  await prisma.aiSalesKitOrder.update({
    where: { id: order.id },
    data: { deliveredAt: new Date() },
  });

  return new NextResponse(bytes, {
    headers: {
      "Content-Type": file.contentType,
      "Content-Disposition": `attachment; filename="${file.filename}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
