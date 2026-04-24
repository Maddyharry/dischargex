import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { openai } from "@/lib/openai";
import { z } from "zod";

export const runtime = "nodejs";

function isAdmin(session: unknown) {
  return (session as { user?: { role?: string } } | null)?.user?.role === "admin";
}

const bodySchema = z.object({
  question: z.string().trim().min(1).max(4000),
  /** Snapshot จาก GET /api/admin/telemetry-digest — ส่งจากแดชบอร์ดเพื่อให้ AI ตีความตรงกับตัวเลขบนหน้า */
  digest: z.record(z.string(), z.unknown()).optional(),
});

const MAX_DIGEST_CHARS = 48_000;

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!isAdmin(session)) {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }
  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ ok: false, error: "ยังไม่ได้ตั้ง OPENAI_API_KEY" }, { status: 503 });
  }

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "ข้อมูลไม่ถูกต้อง" }, { status: 400 });
  }

  const { question, digest } = parsed.data;
  const digestBlock =
    digest && Object.keys(digest).length > 0
      ? JSON.stringify(digest).slice(0, MAX_DIGEST_CHARS)
      : null;

  const system = [
    "You are a senior product + growth analyst for DischargeX: a Thai hospital IPD tool for charge summaries (สรุปชาร์จ), AI chat, and Stripe subscriptions.",
    "You ONLY receive aggregate telemetry / funnel JSON from the admin dashboard (no patient identifiers).",
    "Answer in Thai unless the user explicitly asks English.",
    "Be concrete: name which pages or flows (/pricing, /chat, /app, landing CTAs, onboarding, trial limits) and what to change.",
    "Tie recommendations to numbers in DIGEST_JSON when present (rates, counts, drop-offs, token cost, helpful vs not helpful).",
    "If DIGEST_JSON is missing or sparse, say what data is missing and still give 2–3 general SaaS growth hypotheses for this product.",
    "Do not invent statistics: if a metric is not in the JSON, do not claim a value.",
    "Format: short intro, then bullet list of prioritized actions (max 7), then 'สิ่งที่ควรวัดต่อ' (metrics to track next week).",
    "Focus on: conversion to paid, trial-to-paid, friction on pricing/checkout, chat quality (acceptance), and cost vs usage.",
  ].join(" ");

  const userContent = [
    "DIGEST_JSON (aggregate, admin-only):",
    digestBlock || "(empty)",
    "",
    "QUESTION:",
    question,
  ].join("\n");

  const model = process.env.OPENAI_ADMIN_TELEMETRY_MODEL || process.env.OPENAI_CHAT_MODEL || "gpt-4o-mini";

  try {
    const resp = await openai.responses.create({
      model,
      input: [
        { role: "system", content: system },
        { role: "user", content: userContent },
      ],
      max_output_tokens: 1600,
    });
    const text = "output_text" in resp ? String(resp.output_text || "").trim() : "";
    const reply = text || "ยังสรุปผลไม่ได้ กรุณาลองใหม่หรือย่อคำถาม";
    return NextResponse.json({ ok: true, reply, model });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "model_error";
    console.error("telemetry-copilot:", e);
    return NextResponse.json({ ok: false, error: msg }, { status: 502 });
  }
}
