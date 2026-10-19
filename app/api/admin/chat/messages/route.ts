import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type ChatPayload = {
  isBot?: boolean;
  source?: "user" | "ai" | "admin";
  readByAdmin?: boolean;
};

function isAdmin(session: unknown) {
  return (session as { user?: { role?: string } } | null)?.user?.role === "admin";
}

function parsePayload(payload: string | null): ChatPayload {
  if (!payload) return {};
  try {
    return JSON.parse(payload) as ChatPayload;
  } catch {
    return {};
  }
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!isAdmin(session)) {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }

  const userId = new URL(req.url).searchParams.get("userId")?.trim();
  if (!userId) return NextResponse.json({ ok: false, error: "Missing userId" }, { status: 400 });

  const rows = await prisma.feedback.findMany({
    where: { type: "chat", userId },
    orderBy: { createdAt: "asc" },
    take: 500,
    select: { id: true, message: true, payload: true, createdAt: true },
  });

  const toMarkRead: Array<{ id: string; payload: string }> = [];
  const messages = rows.map((r) => {
    const p = parsePayload(r.payload);
    const source = p.source ?? (p.isBot ? "ai" : "user");
    if (source === "user" && p.readByAdmin !== true) {
      toMarkRead.push({ id: r.id, payload: JSON.stringify({ ...p, source: "user", readByAdmin: true }) });
    }
    return {
      id: r.id,
      message: r.message,
      createdAt: r.createdAt.toISOString(),
      source,
      isBot: source !== "user",
    };
  });

  if (toMarkRead.length > 0) {
    await Promise.all(
      toMarkRead.map((m) =>
        prisma.feedback.update({
          where: { id: m.id },
          data: { payload: m.payload },
        })
      )
    );
  }

  return NextResponse.json({ ok: true, messages });
}

const MAX_EDITABLE_MESSAGE_LENGTH = 10_000;

export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!isAdmin(session)) {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ ok: false, error: "Invalid JSON body" }, { status: 400 });
  }
  const input = body as { messageId?: unknown; message?: unknown };
  const messageId = typeof input.messageId === "string" ? input.messageId.trim() : "";
  const message = typeof input.message === "string" ? input.message : "";
  if (!messageId || !message.trim()) {
    return NextResponse.json({ ok: false, error: "messageId and message are required" }, { status: 400 });
  }
  if (message.length > MAX_EDITABLE_MESSAGE_LENGTH) {
    return NextResponse.json({ ok: false, error: "Message is too long" }, { status: 413 });
  }

  const existing = await prisma.feedback.findUnique({
    where: { id: messageId },
    select: { id: true, type: true, message: true, payload: true },
  });
  if (!existing || existing.type !== "chat" || parsePayload(existing.payload).source !== "admin") {
    return NextResponse.json({ ok: false, error: "Editable admin message not found" }, { status: 404 });
  }

  const updated = await prisma.feedback.updateMany({
    where: { id: existing.id, type: "chat", payload: existing.payload },
    data: { message, shortSummary: message.slice(0, 180) },
  });
  if (updated.count !== 1) {
    return NextResponse.json({ ok: false, error: "Message changed; reload and try again" }, { status: 409 });
  }

  return NextResponse.json({
    ok: true,
    message: { id: existing.id, message },
  });
}
