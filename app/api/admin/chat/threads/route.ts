import { NextResponse } from "next/server";
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

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!isAdmin(session)) {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }

  const rows = await prisma.feedback.findMany({
    where: { type: "chat", userId: { not: null } },
    orderBy: { createdAt: "desc" },
    take: 1200,
    select: {
      id: true,
      userId: true,
      message: true,
      payload: true,
      createdAt: true,
      user: { select: { email: true, name: true } },
    },
  });

  const map = new Map<
    string,
    {
      userId: string;
      userEmail: string | null;
      userName: string | null;
      lastMessage: string;
      lastAt: string;
      unreadForAdmin: number;
    }
  >();

  for (const r of rows) {
    if (!r.userId) continue;
    const p = parsePayload(r.payload);
    const source = p.source ?? (p.isBot ? "ai" : "user");
    const isUnreadForAdmin = source === "user" && p.readByAdmin !== true;

    const thread = map.get(r.userId);
    if (!thread) {
      map.set(r.userId, {
        userId: r.userId,
        userEmail: r.user?.email ?? null,
        userName: r.user?.name ?? null,
        lastMessage: r.message,
        lastAt: r.createdAt.toISOString(),
        unreadForAdmin: isUnreadForAdmin ? 1 : 0,
      });
      continue;
    }
    if (isUnreadForAdmin) thread.unreadForAdmin += 1;
  }

  const threads = [...map.values()].sort((a, b) => +new Date(b.lastAt) - +new Date(a.lastAt));
  return NextResponse.json({ ok: true, threads });
}
