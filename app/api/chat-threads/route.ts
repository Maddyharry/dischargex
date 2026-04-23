import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
  answerSource?: "internal" | "mixed" | "external";
};

type Thread = {
  id: string;
  title: string;
  messages: ChatMessage[];
};

const CHAT_THREADS_KEY_PREFIX = "chat_threads_v1:";
const MAX_THREADS = 40;
const MAX_MESSAGES_PER_THREAD = 120;
const MAX_CONTENT_LENGTH = 12_000;

function isMissingTableError(err: unknown) {
  const msg = String((err as { message?: string })?.message || "").toLowerCase();
  return msg.includes("does not exist in the current database") || msg.includes("invalid `");
}

function sanitizeThreads(raw: unknown): Thread[] {
  if (!Array.isArray(raw)) return [];
  const out: Thread[] = [];
  for (const t of raw) {
    if (!t || typeof t !== "object") continue;
    const obj = t as Record<string, unknown>;
    const id = String(obj.id || "").trim();
    const title = String(obj.title || "").trim() || "แชทใหม่";
    if (!id) continue;
    const rawMessages = Array.isArray(obj.messages) ? obj.messages : [];
    const messages: ChatMessage[] = [];
    for (const m of rawMessages) {
      if (!m || typeof m !== "object") continue;
      const mo = m as Record<string, unknown>;
      const role = mo.role === "assistant" ? "assistant" : mo.role === "user" ? "user" : null;
      if (!role) continue;
      const content = String(mo.content || "").slice(0, MAX_CONTENT_LENGTH);
      const answerSource =
        mo.answerSource === "internal" || mo.answerSource === "mixed" || mo.answerSource === "external"
          ? mo.answerSource
          : undefined;
      messages.push({
        role,
        content,
        ...(answerSource ? { answerSource } : {}),
      });
      if (messages.length >= MAX_MESSAGES_PER_THREAD) break;
    }
    out.push({
      id: id.slice(0, 80),
      title: title.slice(0, 120),
      messages,
    });
    if (out.length >= MAX_THREADS) break;
  }
  return out;
}

export async function GET() {
  const session = await getServerSession(authOptions);
  const email = session?.user?.email;
  if (!email) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  try {
    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });
    if (!user) return NextResponse.json({ ok: true, threads: [], activeId: null });
    const key = `${CHAT_THREADS_KEY_PREFIX}${user.id}`;
    const row = await prisma.appSetting.findUnique({ where: { key } });
    if (!row?.value) return NextResponse.json({ ok: true, threads: [], activeId: null });
    try {
      const parsed = JSON.parse(row.value) as { threads?: unknown; activeId?: unknown };
      const threads = sanitizeThreads(parsed.threads);
      const activeIdRaw = String(parsed.activeId || "").trim();
      const activeId = threads.some((t) => t.id === activeIdRaw) ? activeIdRaw : threads[0]?.id || null;
      return NextResponse.json({ ok: true, threads, activeId });
    } catch {
      return NextResponse.json({ ok: true, threads: [], activeId: null });
    }
  } catch (error) {
    if (isMissingTableError(error)) {
      return NextResponse.json({ ok: true, threads: [], activeId: null });
    }
    return NextResponse.json({ ok: false, error: "โหลดประวัติแชทไม่สำเร็จ" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  const email = session?.user?.email;
  if (!email) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  try {
    const body = (await req.json()) as { threads?: unknown; activeId?: unknown };
    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });
    if (!user) return NextResponse.json({ ok: false, error: "ไม่พบผู้ใช้" }, { status: 404 });

    const threads = sanitizeThreads(body.threads);
    const activeIdRaw = String(body.activeId || "").trim();
    const activeId = threads.some((t) => t.id === activeIdRaw) ? activeIdRaw : threads[0]?.id || null;
    const key = `${CHAT_THREADS_KEY_PREFIX}${user.id}`;
    const payload = JSON.stringify({ threads, activeId });

    await prisma.appSetting.upsert({
      where: { key },
      create: { key, value: payload },
      update: { value: payload },
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (isMissingTableError(error)) {
      return NextResponse.json({ ok: true });
    }
    return NextResponse.json({ ok: false, error: "บันทึกแชทไม่สำเร็จ" }, { status: 500 });
  }
}

