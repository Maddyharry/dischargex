import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  daysLeftUntil,
  getCreditCycleBounds,
  getPeriodBounds,
  getPlanDefinition,
  isPaidPlan,
  normalizePlanId,
} from "@/lib/billing-rules";

export const runtime = "nodejs";

function isAdmin(session: unknown) {
  return (session as { user?: { role?: string } } | null)?.user?.role === "admin";
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!isAdmin(session)) {
      return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
    }

    const now = new Date();
    const users = await prisma.user.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        email: true,
        name: true,
        plan: true,
        role: true,
        totalGenerations: true,
        createdAt: true,
        periodStartedAt: true,
        subscriptionExpiresAt: true,
        _count: { select: { deviceSessions: true } },
      },
    });

    const list = await Promise.all(
      users.map(async (u) => {
        const normalizedPlanId = normalizePlanId(u.plan);
        const planTotal = getPlanDefinition(normalizedPlanId).creditsPerCycle;
        const periodStartDate = u.periodStartedAt ?? u.createdAt;
        const { start: periodStart, end: fallbackPeriodEnd } = getPeriodBounds(periodStartDate, normalizedPlanId);
        const periodEnd = u.subscriptionExpiresAt ?? fallbackPeriodEnd;
        const isExpired = now.getTime() > periodEnd.getTime();
        const { cycleStart, cycleEnd } = getCreditCycleBounds(periodStart, normalizedPlanId, now);
        const cycleWindowEnd = cycleEnd.getTime() > periodEnd.getTime() ? periodEnd : cycleEnd;
        const usedInPeriod = isExpired
          ? 0
          : (await prisma.usageLog.aggregate({
              _sum: { baseCreditsUsed: true },
              where: {
                userId: u.id,
                createdAt: { gte: cycleStart, lte: cycleWindowEnd },
              },
            }))._sum.baseCreditsUsed ?? 0;
        const daysLeft = isExpired ? 0 : daysLeftUntil(periodEnd, now);
        return {
          id: u.id,
          email: u.email,
          name: u.name,
          plan: u.plan,
          role: u.role,
          totalGenerations: u.totalGenerations,
          usageCount: usedInPeriod,
          planTotal,
          daysLeftInMonth: daysLeft,
          deviceCount: u._count.deviceSessions,
          createdAt: u.createdAt.toISOString(),
        };
      })
    );

    return NextResponse.json({ ok: true, users: list });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "โหลดรายการไม่สำเร็จ";
    return NextResponse.json({ ok: false, error: String(message) }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  const session = await getServerSession(authOptions);
  if (!isAdmin(session)) {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = (await req.json()) as { userId: string; plan?: string; role?: string };
    const { userId, plan, role } = body;

    if (!userId) {
      return NextResponse.json({ ok: false, error: "Missing userId" }, { status: 400 });
    }

    const data: {
      plan?: string;
      role?: string;
      subscriptionStatus?: string;
      periodStartedAt?: Date | null;
      subscriptionExpiresAt?: Date | null;
      currentCreditCycleStart?: Date | null;
      currentCreditCycleEnd?: Date | null;
      nextCreditRefreshAt?: Date | null;
      nextPlanId?: string | null;
      nextPlanEffectiveDate?: Date | null;
    } = {};
    if (
      typeof plan === "string" &&
      [
        "trial",
        "basic",
        "standard",
        "pro",
        "basic_monthly",
        "basic_yearly",
        "standard_monthly",
        "standard_yearly",
        "pro_monthly",
        "pro_yearly",
      ].includes(plan)
    ) {
      data.plan = plan;
      // Keep subscription fields consistent when admin changes plan manually.
      const normalized = normalizePlanId(plan);
      const now = new Date();
      if (!isPaidPlan(normalized) || normalized === "trial") {
        data.subscriptionStatus = "trial";
        data.periodStartedAt = null;
        data.subscriptionExpiresAt = null;
        data.currentCreditCycleStart = null;
        data.currentCreditCycleEnd = null;
        data.nextCreditRefreshAt = null;
        data.nextPlanId = null;
        data.nextPlanEffectiveDate = null;
      } else {
        const periodStartedAt = now;
        const { end: expiresAt } = getPeriodBounds(periodStartedAt, normalized);
        const { cycleStart, cycleEnd } = getCreditCycleBounds(periodStartedAt, normalized, now);
        const cycleEndLimited = cycleEnd.getTime() > expiresAt.getTime() ? expiresAt : cycleEnd;
        data.subscriptionStatus = "active";
        data.periodStartedAt = periodStartedAt;
        data.subscriptionExpiresAt = expiresAt;
        data.currentCreditCycleStart = cycleStart;
        data.currentCreditCycleEnd = cycleEndLimited;
        data.nextCreditRefreshAt =
          cycleEndLimited.getTime() < expiresAt.getTime() ? cycleEndLimited : null;
        data.nextPlanId = null;
        data.nextPlanEffectiveDate = null;
      }
    }
    if (typeof role === "string" && ["user", "admin"].includes(role)) {
      data.role = role;
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ ok: false, error: "No valid plan or role to update" }, { status: 400 });
    }

    const user = await prisma.user.update({
      where: { id: userId },
      data,
    });

    return NextResponse.json({ ok: true, user: { id: user.id, plan: user.plan, role: user.role } });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal Server Error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  const session = await getServerSession(authOptions);
  if (!isAdmin(session)) {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = (await req.json()) as { userId: string };
    const { userId } = body;
    if (!userId) {
      return NextResponse.json({ ok: false, error: "Missing userId" }, { status: 400 });
    }

    const email = (session as { user?: { email?: string } })?.user?.email;
    if (email) {
      const me = await prisma.user.findUnique({
        where: { email },
        select: { id: true },
      });
      if (me?.id === userId) {
        return NextResponse.json(
          { ok: false, error: "ไม่สามารถลบบัญชีของตัวเองได้" },
          { status: 400 }
        );
      }
    }

    await prisma.user.delete({
      where: { id: userId },
    });
    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal Server Error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
