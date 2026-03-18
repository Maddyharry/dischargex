import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { id: true },
  });
  if (!user) return NextResponse.json({ ok: false, error: "User not found" }, { status: 404 });

  const { searchParams } = new URL(req.url);
  const limit = Math.min(Number(searchParams.get("limit")) || 50, 100);

  const rows = await prisma.notification.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      id: true,
      type: true,
      title: true,
      message: true,
      meta: true,
      readAt: true,
      createdAt: true,
    },
  });

  return NextResponse.json({
    ok: true,
    notifications: rows.map((n) => ({
      ...n,
      readAt: n.readAt?.toISOString() ?? null,
      createdAt: n.createdAt.toISOString(),
    })),
  });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { id: true },
  });
  if (!user) return NextResponse.json({ ok: false, error: "User not found" }, { status: 404 });

  const body = (await req.json()) as { ids?: string[]; all?: boolean };
  const now = new Date();

  if (body.all) {
    await prisma.notification.updateMany({
      where: { userId: user.id, readAt: null },
      data: { readAt: now },
    });
    return NextResponse.json({ ok: true });
  }

  const ids = Array.isArray(body.ids) ? body.ids.filter((x) => typeof x === "string") : [];
  if (ids.length === 0) {
    return NextResponse.json({ ok: false, error: "Missing ids" }, { status: 400 });
  }

  await prisma.notification.updateMany({
    where: { userId: user.id, id: { in: ids } },
    data: { readAt: now },
  });
  return NextResponse.json({ ok: true });
}

