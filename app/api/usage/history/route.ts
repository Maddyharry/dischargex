import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const limit = Math.min(Number(searchParams.get("limit")) || 100, 200);

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { id: true, plan: true },
  });
  if (!user) {
    return NextResponse.json({ ok: false, error: "User not found" }, { status: 404 });
  }

  const isPro =
    user.plan === "pro" ||
    user.plan === "pro_monthly" ||
    user.plan === "pro_yearly";
  const logs = await prisma.usageLog.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      id: true,
      createdAt: true,
      creditsUsed: true,
      ...(isPro ? { summarySnapshot: true } : {}),
    },
  });

  return NextResponse.json({
    ok: true,
    plan: user.plan ?? "basic",
    logs: logs.map((l: { id: string; createdAt: Date; creditsUsed?: number; summarySnapshot?: string | null }) => ({
      id: l.id,
      createdAt: l.createdAt.toISOString(),
      creditsUsed: l.creditsUsed ?? 1,
      ...(isPro && "summarySnapshot" in l ? { hasSnapshot: l.summarySnapshot != null && l.summarySnapshot !== "" } : {}),
    })),
  });
}
