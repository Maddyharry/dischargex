import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createApiToken, listApiTokens } from "@/lib/api-token";

export const runtime = "nodejs";

async function requireUserId() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return null;
  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { id: true },
  });
  return user?.id ?? null;
}

export async function GET() {
  const userId = await requireUserId();
  if (!userId) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  const tokens = await listApiTokens(userId);
  return NextResponse.json({ ok: true, tokens });
}

export async function POST(req: Request) {
  const userId = await requireUserId();
  if (!userId) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const body = (await req.json().catch(() => ({}))) as { label?: string };
  const created = await createApiToken(userId, body.label);

  return NextResponse.json({
    ok: true,
    token: created.rawToken,
    id: created.id,
    label: created.label,
    createdAt: created.createdAt,
    warning: "เก็บ token นี้ไว้ให้ดี ระบบจะไม่แสดงค่านี้ให้เห็นอีกครั้ง",
  });
}
