import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { openai } from "@/lib/openai";
import { getChatbotKnowledge } from "@/lib/chatbot-settings";
import { prisma } from "@/lib/prisma";
import { deidentify } from "@/lib/deidentify";
import { deterministicSupportReply } from "@/lib/support-intents";

export const runtime = "nodejs";

type HistoryItem = { role: "user" | "assistant"; content: string };

const ADMIN_ACTIVE_WINDOW_MS = 30 * 60 * 1000; // 30 minutes
const AI_UNAVAILABLE_REPLY =
  "ขออภัยครับ ขณะนี้บริการ AI ขัดข้องชั่วคราว ทีมงานกำลังตรวจสอบและแก้ไข กรุณาลองใหม่ภายหลัง หากยังพบปัญหา แจ้งเวลาและข้อความผิดพลาดได้ทางแชท โดยไม่ส่งข้อมูลผู้ป่วยครับ";

async function adminRecentlyReplied(userId: string): Promise<boolean> {
  const since = new Date(Date.now() - ADMIN_ACTIVE_WINDOW_MS);
  const row = await prisma.feedback.findFirst({
    where: {
      userId,
      type: "chat",
      createdAt: { gte: since },
      payload: { contains: '"source":"admin"' },
    },
    select: { id: true },
  });
  return row !== null;
}

function normalizeReply(text: string): string {
  let out = text.trim();
  out = out.replace(/^สั้นๆนะ[\s:,-]*/i, "");
  if (!out.includes("\n")) {
    const lines = out
      .split(/(?<=[.!?])\s+/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (lines.length > 1) out = lines.join("\n\n");
  }
  return out;
}

function billingHelpReply(message: string): string | null {
  const normalized = message.toLocaleLowerCase("th-TH");
  const billingContext = /แพ็ก|แพค|แพตเกจ|ต่ออายุ|subscription|billing/i.test(normalized);
  const action = /ยกเลิก|ลด|เปลี่ยน|ปรับ|cancel|downgrade|change|renew/i.test(normalized);
  const explicitSubscriptionAction = /cancel\s+(?:my\s+)?subscription|subscription\s+cancellation|downgrade\s+(?:my\s+)?subscription/i.test(normalized);
  const asksBillingChange = (billingContext && action) || explicitSubscriptionAction;
  if (!asksBillingChange) return null;

  return "จัดการแพ็กเกจได้ด้วยตนเองตามวิธีที่ต้องการครับ\n\n" +
    "• ลดแพ็กเกจหรือเปลี่ยนแพ็กเกจ: ไปที่ /app/profile → Billing → เปลี่ยนแพ็กเกจ การเปลี่ยนแปลงจะมีผลในรอบชำระถัดไป\n\n" +
    "• ยกเลิกการต่ออายุ: ใช้ปุ่มจัดการ/ยกเลิกในส่วน Billing ของแอป หากมีแผนเปลี่ยนแพ็กเกจที่ตั้งไว้ ระบบจะจัดการกำหนดการนั้นจากปุ่มนี้ด้วย สิทธิ์ที่ชำระแล้วคงอยู่จนสิ้นสุดรอบปัจจุบัน\n\n" +
    "ผมยังไม่ได้ดำเนินการเปลี่ยนแปลงหรือยกเลิกแพ็กเกจให้ หากไม่พบตัวเลือกดังกล่าว โปรดติดต่อทีมงานผ่านแชทโดยไม่ส่งข้อมูลผู้ป่วยครับ";
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { message, history = [] } = body as { message?: string; history?: HistoryItem[] };

    if (!message || typeof message !== "string" || message.trim().length === 0) {
      return NextResponse.json({ ok: false, error: "ไม่มีข้อความ" }, { status: 400 });
    }

    const knownProductReply = deterministicSupportReply(message.trim());
    if (knownProductReply) return NextResponse.json({ ok: true, reply: knownProductReply, ...(knownProductReply === AI_UNAVAILABLE_REPLY ? { degraded: true } : {}) });

    const knownBillingReply = billingHelpReply(message.trim());
    if (knownBillingReply) return NextResponse.json({ ok: true, reply: knownBillingReply });

    if (/\b429\b|no credits remaining|insufficient[_\s-]quota|platform\.openai\.com\/(?:settings\/organization\/|account\/)?billing/i.test(message)) {
      return NextResponse.json({ ok: true, reply: AI_UNAVAILABLE_REPLY, degraded: true });
    }

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ ok: true, reply: AI_UNAVAILABLE_REPLY, degraded: true });
    }

    const session = await getServerSession(authOptions);
    const userId = session?.user?.email
      ? (await prisma.user.findUnique({ where: { email: session.user.email! }, select: { id: true } }))?.id ?? null
      : null;

    if (userId && (await adminRecentlyReplied(userId))) {
      return NextResponse.json({
        ok: true,
        reply: "ขณะนี้แอดมินกำลังดูแลคุณอยู่ครับ หากมีคำถามเพิ่มเติม สามารถพิมพ์ได้เลย แอดมินจะตอบกลับโดยเร็ว",
        suppressed: true,
      });
    }

    const trimmedMessage = message.trim();
    const deidentifiedMessage = deidentify(trimmedMessage);
    const validHistory = Array.isArray(history)
      ? (history as HistoryItem[])
          .filter((h) => h && (h.role === "user" || h.role === "assistant") && typeof h.content === "string")
          .slice(-10)
          .map((h) => ({ role: h.role, content: deidentify(String(h.content).slice(0, 2000)) }))
      : [];

    const model = process.env.OPENAI_CHAT_MODEL || "gpt-5-mini";
    const knowledge = await getChatbotKnowledge();

    let prompt = `[คำสั่งสำหรับบอท]\n${knowledge}\n\n`;
    if (validHistory.length > 0) {
      prompt += "[บทสนทนาก่อนหน้า]\n";
      for (const h of validHistory) {
        prompt += (h.role === "user" ? "ลูกค้า: " : "บอท: ") + h.content + "\n";
      }
      prompt += "\n";
    }
    prompt +=
      "[ข้อความล่าสุดจากลูกค้า]\nลูกค้า: " +
      deidentifiedMessage +
      "\n\nบอทตอบ (ภาษาไทย สุภาพ อ่านง่าย มีเว้นบรรทัดระหว่างประเด็นสำคัญ 1 บรรทัด; ไม่ต้องขึ้นต้นด้วยคำว่า 'สั้นๆนะ'; ถ้าไม่เกี่ยวกับการใช้งาน/แพ็กเกจ/แจ้งข้อผิดพลาด ให้ปฏิเสธแบบสุภาพแล้วชวนกลับมาหัวข้อที่รับเท่านั้น):";

    // Redact at the final outbound boundary, including database-backed knowledge and history.
    prompt = deidentify(prompt);

    const resp = await openai.responses.create({
      model,
      input: prompt,
      store: false,
      max_output_tokens: 1200,
    });

    const response = resp as { output_text?: string; status?: string; incomplete_details?: { reason?: string } | null };
    if (response.status === "incomplete" || response.incomplete_details?.reason) {
      return NextResponse.json({ ok: true, reply: AI_UNAVAILABLE_REPLY, degraded: true });
    }
    const replyRaw = response.output_text?.trim() || "";
    if (replyRaw.length < 40) {
      return NextResponse.json({ ok: true, reply: AI_UNAVAILABLE_REPLY, degraded: true });
    }
    const reply = deidentify(normalizeReply(replyRaw));

    return NextResponse.json({ ok: true, reply });
  } catch {
    console.error("Feedback chat-reply failed: AI_UNAVAILABLE_REPLY");
    return NextResponse.json({ ok: true, reply: AI_UNAVAILABLE_REPLY, degraded: true });
  }
}
