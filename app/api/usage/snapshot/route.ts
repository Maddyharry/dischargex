import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

/** ดึง snapshot ที่ผ่านการปกปิดของเจ้าของประวัติ */
export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const logId = searchParams.get("logId");
  if (!logId) {
    return NextResponse.json({ ok: false, error: "Missing logId" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { id: true },
  });
  if (!user) {
    return NextResponse.json({ ok: false, error: "User not found" }, { status: 404 });
  }
  const log = await prisma.usageLog.findFirst({
    where: { id: logId, userId: user.id },
    select: { summarySnapshot: true },
  });
  if (!log?.summarySnapshot) {
    return NextResponse.json(
      { ok: false, error: "ไม่พบข้อมูลสรุปของเคสนี้" },
      { status: 404 }
    );
  }

  return NextResponse.json({ ok: true, text: log.summarySnapshot });
}

/** ลบเฉพาะข้อความ snapshot ของเจ้าของประวัติ ไม่ลบรายการ usage ที่ใช้คำนวณโควตา */
export async function DELETE(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const logId = searchParams.get("logId");
  if (!logId) return NextResponse.json({ ok: false, error: "Missing logId" }, { status: 400 });

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { id: true, plan: true },
  });
  if (!user) return NextResponse.json({ ok: false, error: "User not found" }, { status: 404 });
  const deleted = await prisma.usageLog.updateMany({
    where: { id: logId, userId: user.id },
    data: { summarySnapshot: null },
  });
  if (deleted.count === 0) return NextResponse.json({ ok: false, error: "ไม่พบข้อมูลของเคสนี้" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
