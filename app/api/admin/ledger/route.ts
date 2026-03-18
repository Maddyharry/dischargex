import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

function isAdmin(session: unknown) {
  return (session as { user?: { role?: string } } | null)?.user?.role === "admin";
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!isAdmin(session)) {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get("userId")?.trim() || "";
    const email = searchParams.get("email")?.trim() || "";
    const sourceType = searchParams.get("sourceType")?.trim() || "";
    const limit = Math.min(Number(searchParams.get("limit")) || 200, 500);

    let resolvedUserId: string | null = userId || null;
    if (!resolvedUserId && email) {
      const u = await prisma.user.findUnique({ where: { email }, select: { id: true } });
      resolvedUserId = u?.id ?? null;
    }

    const where: {
      userId?: string;
      sourceType?: string;
    } = {};
    if (resolvedUserId) where.userId = resolvedUserId;
    if (sourceType) where.sourceType = sourceType;

    const rows = await prisma.creditLedger.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: limit,
      include: { user: { select: { email: true, name: true } } },
    });

    type Row = (typeof rows)[number];
    return NextResponse.json({
      ok: true,
      ledger: rows.map((r: Row) => ({
        id: r.id,
        userId: r.userId,
        userEmail: r.user?.email ?? null,
        userName: r.user?.name ?? null,
        sourceType: r.sourceType,
        sourceId: r.sourceId,
        amount: r.amount,
        direction: r.direction,
        note: r.note,
        createdBy: r.createdBy,
        createdAt: r.createdAt.toISOString(),
      })),
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal Server Error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

