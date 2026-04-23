import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sendAdminAlertEmail } from "@/lib/admin-alert";

export const runtime = "nodejs";

function isAdmin(session: unknown) {
  return (session as { user?: { role?: string } } | null)?.user?.role === "admin";
}

export async function POST() {
  const session = await getServerSession(authOptions);
  if (!isAdmin(session)) return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const rows = await prisma.feedback.findMany({
    where: { type: "telemetry", createdAt: { gte: since } },
    select: { message: true, payload: true },
  });

  const rejectCount = rows.filter((r) => r.message.startsWith("specialist_chat_feedback:not_helpful")).length;
  const lowConfidence = rows.filter((r) => {
    if (!(r.message === "summary:summary_generated" || r.message === "summary:summary_recalc")) return false;
    try {
      const payload = r.payload ? (JSON.parse(r.payload) as { diagnosisConfidence?: string }) : null;
      return payload?.diagnosisConfidence === "Low";
    } catch {
      return false;
    }
  }).length;

  await sendAdminAlertEmail({
    subject: "DischargeX: Human-in-the-loop review digest (24h)",
    lines: [
      `Pending reject feedback: ${rejectCount}`,
      `Pending low-confidence summaries: ${lowConfidence}`,
      `Total review candidates: ${rejectCount + lowConfidence}`,
      "Open /admin/review-queue to review and decide.",
    ],
  });

  return NextResponse.json({ ok: true, rejectCount, lowConfidence });
}
