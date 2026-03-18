import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

/**
 * คืนเครดิตจาก usage log ที่เลือก
 * หมายเหตุ: 1 usage อาจใช้ 1 หรือ 2 เครดิต (long case)
 */
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if ((session?.user as { role?: string })?.role !== "admin") {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }

  let body: { userId: string; usageLogId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const { userId, usageLogId } = body;
  if (!userId || typeof userId !== "string") {
    return NextResponse.json({ ok: false, error: "ต้องระบุ userId" }, { status: 400 });
  }

  if (usageLogId != null && typeof usageLogId !== "string") {
    return NextResponse.json({ ok: false, error: "usageLogId ต้องเป็น string" }, { status: 400 });
  }

  try {
    if (usageLogId) {
      const log = await prisma.usageLog.findFirst({
        where: { id: usageLogId, userId },
        select: { id: true, creditsUsed: true },
      });
      if (!log) {
        return NextResponse.json(
          { ok: false, error: "ไม่พบรายการใช้งานนี้หรือไม่ใช่ของ user นี้" },
          { status: 404 }
        );
      }
      await prisma.usageLog.delete({ where: { id: usageLogId } });
      return NextResponse.json({
        ok: true,
        message: `คืนเครดิตแล้ว ${log.creditsUsed ?? 1} เครดิต (ลบรายการที่ระบุ)`,
      });
    }

    const latest = await prisma.usageLog.findFirst({
      where: { userId },
      orderBy: { createdAt: "desc" },
      select: { id: true, createdAt: true, creditsUsed: true },
    });
    if (!latest) {
      return NextResponse.json(
        { ok: false, error: "ไม่มีรายการใช้งานของ user นี้ในระบบ" },
        { status: 404 }
      );
    }
    await prisma.usageLog.delete({ where: { id: latest.id } });
    return NextResponse.json({
      ok: true,
      message: `คืนเครดิตแล้ว ${latest.creditsUsed ?? 1} เครดิต (ลบรายการล่าสุด)`,
      deletedAt: latest.createdAt.toISOString(),
    });
  } catch (e) {
    console.error("Admin refund-credit error:", e);
    return NextResponse.json({ ok: false, error: "ดำเนินการไม่สำเร็จ" }, { status: 500 });
  }
}
