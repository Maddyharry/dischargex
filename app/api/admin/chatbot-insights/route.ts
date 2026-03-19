import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { openai } from "@/lib/openai";

function isAdmin(session: unknown) {
  return (session as { user?: { role?: string } } | null)?.user?.role === "admin";
}

function topKeywords(messages: string[], topN = 12): Array<{ key: string; count: number }> {
  const stop = new Set(["ครับ", "ค่ะ", "และ", "หรือ", "ที่", "ได้", "ให้", "กับ", "ของ", "ใน", "เป็น", "ไม่", "มี", "แล้ว"]);
  const counts = new Map<string, number>();
  for (const msg of messages) {
    const words = msg
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s]/gu, " ")
      .split(/\s+/)
      .filter((w) => w.length >= 3 && !stop.has(w));
    for (const w of words) counts.set(w, (counts.get(w) || 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, topN)
    .map(([key, count]) => ({ key, count }));
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!isAdmin(session)) return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });

  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const rows = await prisma.feedback.findMany({
    where: { createdAt: { gte: since } },
    orderBy: { createdAt: "desc" },
    take: 300,
    select: { type: true, message: true, createdAt: true },
  });

  const chatMessages = rows.filter((r) => r.type === "chat").map((r) => r.message);
  const errorMessages = rows.filter((r) => r.type === "error_report").map((r) => r.message);
  const chatKeywords = topKeywords(chatMessages);
  const errorKeywords = topKeywords(errorMessages);

  let aiSummary: string | null = null;
  if (process.env.OPENAI_API_KEY && rows.length > 0) {
    try {
      const sample = rows
        .slice(0, 80)
        .map((r) => `[${r.type}] ${r.message}`)
        .join("\n");
      const resp = await openai.responses.create({
        model: process.env.OPENAI_CHAT_MODEL || "gpt-5-mini",
        input:
          "สรุป 5 ประเด็นที่ผู้ใช้ถามบ่อยและ 5 ปัญหาที่เจอบ่อย จากข้อความต่อไปนี้ ตอบไทย กระชับ มีหัวข้อและ bullet:\n\n" +
          sample,
        max_output_tokens: 600,
      });
      aiSummary = (resp as { output_text?: string }).output_text?.trim() || null;
    } catch {
      aiSummary = null;
    }
  }

  return NextResponse.json({
    ok: true,
    periodDays: 30,
    total: rows.length,
    chats: chatMessages.length,
    errors: errorMessages.length,
    topChatKeywords: chatKeywords,
    topErrorKeywords: errorKeywords,
    aiSummary,
  });
}
