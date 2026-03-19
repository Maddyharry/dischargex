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
