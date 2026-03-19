import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

function isAdmin(session: unknown) {
  return (session as { user?: { role?: string } } | null)?.user?.role === "admin";
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!isAdmin(session)) return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });

  const body = (await req.json()) as { feedbackId?: string; reply?: string };
  const feedbackId = body.feedbackId?.trim();
  const reply = body.reply?.trim();
  if (!feedbackId || !reply) {
    return NextResponse.json({ ok: false, error: "feedbackId and reply are required" }, { status: 400 });
  }

  const target = await prisma.feedback.findUnique({
    where: { id: feedbackId },
    select: { id: true, userId: true, type: true },
  });
  if (!target || !target.userId || target.type !== "chat") {
    return NextResponse.json({ ok: false, error: "Target chat not found" }, { status: 404 });
  }

  await prisma.feedback.create({
    data: {
      userId: target.userId,
      type: "chat",
      message: reply,
      payload: JSON.stringify({ isBot: true, source: "admin" }),
      category: "other",
      shortSummary: reply.slice(0, 180),
      aiScore: 0,
      aiSuggestedCredit: 0,
      status: "pending",
    },
  });

  return NextResponse.json({ ok: true });
}
