import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { feedbackFingerprint, similarityScore } from "@/lib/text-similarity";
import { sendAdminAlertEmail } from "@/lib/admin-alert";

export const runtime = "nodejs";

async function alertIfRejectSpike() {
  const windowHours = Number(process.env.REJECT_SPIKE_WINDOW_HOURS || "24");
  const minCount = Number(process.env.REJECT_SPIKE_MIN_COUNT || "20");
  const ratioThreshold = Number(process.env.REJECT_SPIKE_RATIO || "0.35");
  if (!Number.isFinite(windowHours) || !Number.isFinite(minCount) || !Number.isFinite(ratioThreshold)) return;

  const since = new Date(Date.now() - Math.max(1, windowHours) * 60 * 60 * 1000);
  const rows = await prisma.feedback.findMany({
    where: {
      type: "telemetry",
      message: { in: ["specialist_chat_feedback:helpful", "specialist_chat_feedback:not_helpful"] },
      createdAt: { gte: since },
    },
    select: { message: true },
  });
  const total = rows.length;
  if (total < Math.max(1, Math.floor(minCount))) return;
  const rejected = rows.filter((r) => r.message === "specialist_chat_feedback:not_helpful").length;
  const ratio = rejected / total;
  if (ratio < ratioThreshold) return;

  await sendAdminAlertEmail({
    subject: "DischargeX Alert: Chat reject spike",
    lines: [
      `Window: last ${windowHours} hours`,
      `Total feedback: ${total}`,
      `Not helpful: ${rejected}`,
      `Reject ratio: ${(ratio * 100).toFixed(1)}%`,
      "ตรวจ prompt variant, knowledge quality, และ intent drift ใน admin insights",
    ],
  });
}

function scoreFeedback(message: string, payloadStr: string | null): { score: number; suggestedCredit: number } {
  const text = message.trim();
  let score = 0;
  if (text.length >= 30) score += 2;
  if (text.length >= 80) score += 2;
  if (/(หน้า|feature|เมนู|ปุ่ม|screen|page|api|error|bug)/i.test(text)) score += 2;
  if (/(ขั้นตอน|ทำซ้ำ|reproduce|กระทบ|ผลกระทบ|expected|actual)/i.test(text)) score += 2;
  if (payloadStr && payloadStr.length > 20) score += 2;
  score = Math.max(0, Math.min(10, score));

  const suggestedCredit = score <= 3 ? 0 : score <= 6 ? 2 : score <= 8 ? 5 : 10;
  return { score, suggestedCredit };
}

// POST: ส่งข้อความแชท หรือแจ้งข้อผิดพลาด (รองรับทั้งที่ล็อกอินและไม่ล็อกอิน)
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const userId = session?.user?.email
      ? (await prisma.user.findUnique({ where: { email: session.user.email! }, select: { id: true } }))?.id ?? null
      : null;

    const body = await req.json();
    const { type, message, payload } = body as { type?: string; message?: string; payload?: string };

    if (!type || !message || typeof message !== "string") {
      return NextResponse.json({ ok: false, error: "ต้องระบุ type และ message" }, { status: 400 });
    }
    if (!["chat", "error_report", "telemetry"].includes(type)) {
      return NextResponse.json({ ok: false, error: "type ต้องเป็น chat, error_report หรือ telemetry" }, { status: 400 });
    }
    if (message.trim().length === 0) {
      return NextResponse.json({ ok: false, error: "กรุณาใส่ข้อความ" }, { status: 400 });
    }

    // จำกัดขนาด payload (เช่น screenshot ไม่เกิน 2MB เมื่อ encode เป็น base64)
    const payloadStr = payload != null ? String(payload) : null;
    if (payloadStr && payloadStr.length > 3_000_000) {
      return NextResponse.json({ ok: false, error: "ไฟล์แนบใหญ่เกินไป" }, { status: 400 });
    }

    const { score, suggestedCredit } = scoreFeedback(message, payloadStr);
    const clientIp =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      req.headers.get("x-real-ip") ||
      null;
    const clientUserAgent = req.headers.get("user-agent") || null;

    let status: string = "pending";
    let duplicateOfId: string | null = null;
    let duplicateScore: number | null = null;
    const fingerprint = feedbackFingerprint(message, payloadStr);

    if (type === "error_report") {
      const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const candidates = await prisma.feedback.findMany({
        where: {
          type: "error_report",
          createdAt: { gte: since },
          ...(userId
            ? { userId }
            : clientIp
            ? { clientIp }
            : {}),
        },
        orderBy: { createdAt: "desc" },
        take: 30,
        select: { id: true, message: true, fingerprint: true },
      });

      type Candidate = (typeof candidates)[number];
      const direct = candidates.find((c: Candidate) => c.fingerprint && c.fingerprint === fingerprint);
      if (direct) {
        status = "duplicate";
        duplicateOfId = direct.id;
        duplicateScore = 1;
      } else {
        let best: { id: string; score: number } | null = null;
        for (const c of candidates) {
          const s = similarityScore(message, c.message);
          if (!best || s > best.score) best = { id: c.id, score: s };
        }
        if (best && best.score >= 0.86) {
          status = "duplicate";
          duplicateOfId = best.id;
          duplicateScore = Math.round(best.score * 1000) / 1000;
        }
      }
    }

    const feedback = await prisma.feedback.create({
      data: {
        userId: userId ?? undefined,
        type,
        message: message.trim(),
        payload: payloadStr ?? undefined,
        category: type === "error_report" ? "bug" : "other",
        shortSummary: message.trim().slice(0, 180),
        aiScore: type === "error_report" ? score : 0,
        aiSuggestedCredit: type === "error_report" ? suggestedCredit : 0,
        status,
        fingerprint,
        duplicateOfId: duplicateOfId ?? undefined,
        duplicateScore: duplicateScore ?? undefined,
        clientIp: clientIp ?? undefined,
        clientUserAgent: clientUserAgent ?? undefined,
      },
    });

    if (type === "error_report") {
      await sendAdminAlertEmail({
        subject: "DischargeX: New error report",
        lines: [
          `Feedback ID: ${feedback.id}`,
          `User ID: ${userId ?? "-"}`,
          `Score: ${score}/10`,
          `Suggested credit: ${suggestedCredit}`,
          `Status: ${status}`,
          `Message: ${message.trim().slice(0, 500)}`,
        ],
      });
    }
    if (type === "telemetry" && message.trim() === "specialist_chat_feedback:not_helpful") {
      await alertIfRejectSpike();
    }

    return NextResponse.json({ ok: true, id: feedback.id });
  } catch (e) {
    console.error("Feedback POST error:", e);
    return NextResponse.json({ ok: false, error: "ส่งข้อมูลไม่สำเร็จ" }, { status: 500 });
  }
}

// GET: ดึงประวัติแชทของ user (เฉพาะ type=chat, เรียงจากใหม่ไปเก่า)
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const userId = session?.user?.email
      ? (await prisma.user.findUnique({ where: { email: session.user.email! }, select: { id: true } }))?.id ?? null
      : null;

    const { searchParams } = new URL(req.url);
    const type = searchParams.get("type") ?? "chat";

    if (type !== "chat") {
      return NextResponse.json({ ok: false, error: "GET รองรับเฉพาะ type=chat" }, { status: 400 });
    }

    // ไม่ล็อกอินก็ไม่โหลดประวัติ (หรือจะให้โหลดจาก deviceId ก็ได้)
    const list = userId
      ? await prisma.feedback.findMany({
          where: { userId, type: "chat" },
          orderBy: { createdAt: "desc" },
          take: 50,
          select: { id: true, message: true, createdAt: true, payload: true },
        })
      : [];

    const messages = list
      .reverse()
      .map((m) => {
        let isBot = false;
        try {
          const payload = m.payload ? (JSON.parse(m.payload) as { isBot?: boolean }) : null;
          isBot = payload?.isBot === true;
        } catch {
          isBot = false;
        }
        return { id: m.id, message: m.message, createdAt: m.createdAt, isBot };
      });

    return NextResponse.json({ ok: true, messages });
  } catch (e) {
    console.error("Feedback GET error:", e);
    return NextResponse.json({ ok: false, error: "โหลดประวัติไม่สำเร็จ" }, { status: 500 });
  }
}
