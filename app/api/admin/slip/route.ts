import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

function isAdmin(session: unknown) {
  return (session as { user?: { role?: string } } | null)?.user?.role === "admin";
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!isAdmin(session)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const id = new URL(req.url).searchParams.get("id")?.trim();
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  const row = await prisma.paymentRequest.findUnique({
    where: { id },
    select: { slipData: true },
  });

  if (!row?.slipData) {
    return NextResponse.json({ error: "Slip not found" }, { status: 404 });
  }

  const match = row.slipData.match(/^data:([^;]+);base64,([\s\S]+)$/);
  if (!match) {
    return NextResponse.json({ error: "Invalid slip data" }, { status: 500 });
  }

  const contentType = match[1];
  const buf = Buffer.from(match[2], "base64");

  return new NextResponse(buf, {
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "private, max-age=3600",
    },
  });
}
