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

  const body = (await req.json()) as { userId?: string; reply?: string };
  const userId = body.userId?.trim();
  const reply = body.reply?.trim();
  if (!userId || !reply) {
    return NextResponse.json({ ok: false, error: "userId and reply are required" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
  if (!user) return NextResponse.json({ ok: false, error: "User not found" }, { status: 404 });

  await prisma.feedback.create({
    data: {
      userId,
      type: "chat",
      message: reply,
      payload: JSON.stringify({ isBot: true, source: "admin", readByUser: false }),
      category: "other",
      shortSummary: reply.slice(0, 180),
      aiScore: 0,
      aiSuggestedCredit: 0,
      status: "pending",
    },
  });

  await prisma.notification.create({
    data: {
      userId,
      type: "feedback",
      title: "มีข้อความใหม่จากแอดมิน",
      message: reply.length > 120 ? `${reply.slice(0, 120)}...` : reply,
      meta: JSON.stringify({ source: "admin_chat" }),
    },
  });

  return NextResponse.json({ ok: true });
}
