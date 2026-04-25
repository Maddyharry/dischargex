import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getPeriodBounds, normalizePlanId } from "@/lib/billing-rules";
import { getTrialExpiredPolicy } from "@/lib/trial-expired-policy";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: {
      plan: true,
      createdAt: true,
      periodStartedAt: true,
      subscriptionExpiresAt: true,
    },
  });
  const now = new Date();
  const plan = normalizePlanId(user?.plan ?? "trial");
  const periodStartDate = user?.periodStartedAt ?? user?.createdAt ?? now;
  const periodEnd = user?.subscriptionExpiresAt ?? getPeriodBounds(periodStartDate, plan).end;
  const isExpiredTrial = plan === "trial" && now.getTime() > periodEnd.getTime();
  const policy = await getTrialExpiredPolicy();

  return NextResponse.json({
    ok: true,
    effective: {
      limited: policy.enabled && isExpiredTrial,
      chatScope: policy.chatScope,
      allowOpdDemo: policy.allowOpdDemo,
      allowSummarize: policy.allowSummarize,
      forceFastModel: policy.forceFastModel,
    },
  });
}
