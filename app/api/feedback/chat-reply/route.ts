import { NextRequest, NextResponse } from "next/server";
import { openai } from "@/lib/openai";
import { getChatbotKnowledge } from "@/lib/chatbot-settings";

export const runtime = "nodejs";

type HistoryItem = { role: "user" | "assistant"; content: string };

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

export async function POST(req: NextRequest) {
  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ ok: false, error: "บริการแชทยังไม่พร้อม" }, { status: 503 });
  }

  try {
    const body = await req.json();
    const { message, history = [] } = body as { message?: string; history?: HistoryItem[] };

    if (!message || typeof message !== "string" || message.trim().length === 0) {
      return NextResponse.json({ ok: false, error: "ไม่มีข้อความ" }, { status: 400 });
    }

    const trimmedMessage = message.trim();
    const validHistory = Array.isArray(history)
      ? (history as HistoryItem[])
          .filter((h) => h && (h.role === "user" || h.role === "assistant") && typeof h.content === "string")
          .slice(-10)
          .map((h) => ({ role: h.role, content: String(h.content).slice(0, 2000) }))
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
      trimmedMessage +
      "\n\nบอทตอบ (ภาษาไทย สุภาพ อ่านง่าย มีเว้นบรรทัดระหว่างประเด็นสำคัญ 1 บรรทัด; ไม่ต้องขึ้นต้นด้วยคำว่า 'สั้นๆนะ'; ถ้าไม่เกี่ยวกับการใช้งาน/แพ็กเกจ/แจ้งข้อผิดพลาด ให้ปฏิเสธแบบสุภาพแล้วชวนกลับมาหัวข้อที่รับเท่านั้น):";

    const resp = await openai.responses.create({
      model,
      input: prompt,
      max_output_tokens: 800,
    });

    const replyRaw =
      (resp as { output_text?: string }).output_text?.trim() ||
      "ขออภัย ตอนนี้ตอบไม่ได้ กรุณาลองใหม่หรือแจ้งทีมงานครับ";
    const reply = normalizeReply(replyRaw);

    return NextResponse.json({ ok: true, reply });
  } catch (e) {
    console.error("Feedback chat-reply error:", e);
    const errMsg = e instanceof Error ? e.message : "สร้างคำตอบไม่สำเร็จ";
    return NextResponse.json(
      { ok: false, error: errMsg || "สร้างคำตอบไม่สำเร็จ กรุณาลองใหม่" },
      { status: 500 }
    );
  }
}
