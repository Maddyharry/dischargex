import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { listPaymentsByEmail } from "@/lib/payments-store";

export const runtime = "nodejs";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  const requests = await listPaymentsByEmail(session.user.email);
  type Req = (typeof requests)[number];
  return NextResponse.json({
    ok: true,
    requests: requests.map((r: Req) => ({
      id: r.id,
      type: r.type,
      planRequested: r.planRequested,
      fromPlanId: r.fromPlanId,
      toPlanId: r.toPlanId,
      addCredits: r.addCredits,
      quotedAmount: r.quotedAmount,
      finalAmount: r.finalAmount,
      status: r.status,
      adminNote: r.adminNote,
      rejectionReason: r.rejectionReason,
      reviewedAt: r.reviewedAt,
      createdAt: r.createdAt,
    })),
  });
}
