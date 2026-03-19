import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { openai } from "@/lib/openai";

function isAdmin(session: unknown) {
  return (session as { user?: { role?: string } } | null)?.user?.role === "admin";
}

function normalizeForGrouping(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function topReadableTopics(messages: string[], topN = 6): Array<{ text: string; count: number }> {
  const groups = new Map<string, { count: number; sample: string }>();
  for (const raw of messages) {
    const text = raw.trim();
    if (!text) continue;
    const key = normalizeForGrouping(text);
    if (!key) continue;
    const existing = groups.get(key);
    if (!existing) {
      groups.set(key, { count: 1, sample: text });
    } else {
      const betterSample = text.length < existing.sample.length ? text : existing.sample;
      groups.set(key, { count: existing.count + 1, sample: betterSample });
    }
  }
  return [...groups.values()]
    .sort((a, b) => b.count - a.count)
    .slice(0, topN)
    .map((v) => ({ text: v.sample.slice(0, 180), count: v.count }));
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
  const chatTopics = topReadableTopics(chatMessages);
  const errorTopics = topReadableTopics(errorMessages);

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
          "สรุปจากข้อมูลต่อไปนี้เป็นภาษาไทยอ่านง่าย โดยให้มี 2 หัวข้อ: (1) คำถามที่ผู้ใช้ถามบ่อย (2) ข้อผิดพลาดที่เจอบ่อย พร้อมข้อเสนอแนะปรับปรุง chatbot แบบสั้นๆ 3 ข้อ จัดรูปแบบเป็น bullet:\n\n" +
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
    topChatTopics: chatTopics,
    topErrorTopics: errorTopics,
    aiSummary,
  });
}
