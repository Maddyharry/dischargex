import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

function isAdmin(session: unknown) {
  return (session as { user?: { role?: string } } | null)?.user?.role === "admin";
}

type QueueItem = {
  id: string;
  kind: "reject_feedback" | "low_confidence_summary";
  createdAt: Date;
  userId: string | null;
  message: string;
  detail: string;
};

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!isAdmin(session)) return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });

  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const telemetry = await prisma.feedback.findMany({
    where: { type: "telemetry", createdAt: { gte: since } },
    orderBy: { createdAt: "desc" },
    take: 2000,
    select: { id: true, userId: true, message: true, payload: true, createdAt: true },
  });

  const queue: QueueItem[] = [];
  for (const row of telemetry) {
    if (row.message.startsWith("specialist_chat_feedback:not_helpful")) {
      const reason = row.message.split(":")[2] || "unspecified";
      queue.push({
        id: row.id,
        kind: "reject_feedback",
        createdAt: row.createdAt,
        userId: row.userId,
        message: "Specialist chat rejected",
        detail: `reason=${reason}`,
      });
      continue;
    }
    if (row.message === "summary:summary_generated" || row.message === "summary:summary_recalc") {
      try {
        const payload = row.payload ? (JSON.parse(row.payload) as { diagnosisConfidence?: string }) : null;
        if (payload?.diagnosisConfidence === "Low") {
          queue.push({
            id: row.id,
            kind: "low_confidence_summary",
            createdAt: row.createdAt,
            userId: row.userId,
            message: "Low confidence summary",
            detail: "diagnosisConfidence=Low",
          });
        }
      } catch {
        // ignore
      }
    }
  }

  return NextResponse.json({
    ok: true,
    periodDays: 7,
    total: queue.length,
    items: queue.slice(0, 200),
  });
}

export async function PATCH(req: Request) {
  const session = await getServerSession(authOptions);
  if (!isAdmin(session)) return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  const body = (await req.json()) as { id?: string; action?: "reviewed" | "reject" };
  if (!body.id || !body.action) {
    return NextResponse.json({ ok: false, error: "Missing id/action" }, { status: 400 });
  }
  const status = body.action === "reviewed" ? "implemented" : "rejected";
  await prisma.feedback.update({
    where: { id: body.id },
    data: {
      status,
      reviewedAt: new Date(),
      adminNote: body.action === "reviewed" ? "Reviewed in queue" : "Rejected in queue",
    },
  });
  return NextResponse.json({ ok: true, status });
}
