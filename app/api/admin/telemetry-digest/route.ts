import { NextResponse } from "next/server";
import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

function isAdmin(session: unknown) {
  return (session as { user?: { role?: string } } | null)?.user?.role === "admin";
}

function toCsv(rows: Array<{ event: string; count: number }>) {
  const header = "event,count";
  const lines = rows.map((r) => `"${r.event.replace(/"/g, '""')}",${r.count}`);
  return [header, ...lines].join("\n");
}

function parsePeriodDays(req: NextRequest) {
  const params = new URL(req.url).searchParams;
  const range = String(params.get("range") || "").toLowerCase();
  if (range === "1wk") return 7;
  if (range === "1mo") return 30;
  if (range === "3mo") return 90;
  if (range === "year") return 365;
  const raw = Number(params.get("days") || "30");
  if (!Number.isFinite(raw)) return 30;
  return Math.min(365, Math.max(1, Math.floor(raw)));
}

function normalizePath(raw: unknown) {
  const path = String(raw || "/").trim();
  if (!path.startsWith("/")) return "/";
  return path.length > 180 ? path.slice(0, 180) : path;
}

function dayDiff(start: Date, end: Date) {
  return Math.max(0, Math.floor((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000)));
}

function toCohortBucket(days: number) {
  if (days <= 0) return "D0";
  if (days <= 3) return "D1-3";
  if (days <= 7) return "D4-7";
  if (days <= 14) return "D8-14";
  return "D15+";
}

type AssistantModeBucket = "coding" | "opd_demo" | "unknown";

function bucketAssistantMode(raw: unknown): AssistantModeBucket {
  if (raw === "opd_demo") return "opd_demo";
  if (raw === "coding") return "coding";
  return "unknown";
}

type TelemetryPayload = {
  assistantMode?: string;
  promptVariant?: string;
  blockKey?: string;
  strategy?: string;
  diagnosisKey?: string;
  path?: string;
  visitorId?: string;
  sessionId?: string;
  durationMs?: number;
  ctaKey?: string;
  abTest?: string;
  abVariant?: string;
  simpleDirectQuestion?: boolean;
  compactTargetApplied?: boolean;
  replyMetrics?: {
    charCount?: number;
    lineCount?: number;
    bulletCount?: number;
    headingCount?: number;
    approxWordCount?: number;
    lengthBucket?: "short" | "medium" | "long";
  };
};

function emptySpecialistChatModeRow() {
  return {
    replies: 0,
    helpful: 0,
    notHelpful: 0,
    tokenCostThb: 0,
    rejectReasons: {} as Record<string, number>,
  };
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!isAdmin(session)) return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  const format = new URL(req.url).searchParams.get("format");
  const periodDays = parsePeriodDays(req);
  const since = new Date(Date.now() - periodDays * 24 * 60 * 60 * 1000);
  const adminUsers = await prisma.user.findMany({
    where: { role: "admin" },
    select: { id: true },
  });
  const adminUserIdSet = new Set(adminUsers.map((u) => u.id));
  const rows = await prisma.feedback.findMany({
    where: { type: "telemetry", createdAt: { gte: since } },
    orderBy: { createdAt: "desc" },
    take: 15000,
    select: { message: true, payload: true, createdAt: true, userId: true },
  });
  const filteredRows = rows.filter((row) => !row.userId || !adminUserIdSet.has(row.userId));
  const tokenRows = await prisma.tokenUsageLedger.findMany({
    where: { createdAt: { gte: since } },
    select: { source: true, estimatedCostThb: true, userId: true, payload: true },
    take: 15000,
  });
  const filteredTokenRows = tokenRows.filter((row) => !row.userId || !adminUserIdSet.has(row.userId));
  const approvedPayments = await prisma.paymentRequest.findMany({
    where: {
      createdAt: { gte: since },
      OR: [{ status: "approved" }, { entitlementAppliedAt: { not: null } }],
      userId: { not: null },
    },
    select: { userId: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  });
  const filteredApprovedPayments = approvedPayments.filter((p) => !p.userId || !adminUserIdSet.has(p.userId));
  const recentUsers = await prisma.user.findMany({
    where: { createdAt: { gte: since }, role: { not: "admin" } },
    select: { id: true, plan: true },
  });
  const usageUsers = await prisma.usageLog.findMany({
    where: { createdAt: { gte: since } },
    select: { userId: true },
    distinct: ["userId"],
  });
  const filteredUsageUsers = usageUsers.filter((x) => !adminUserIdSet.has(x.userId));

  const countByEvent = new Map<string, number>();
  const variantStats: Record<string, { count: number }> = {};
  const rejectReasons: Record<string, number> = {};
  const editedBlockCounts: Record<string, number> = {};
  const strategyUsage: Record<string, number> = {};
  const ctaClicks: Record<string, number> = {};
  const ctaClickUsersByKey = new Map<string, Set<string>>();
  const ctaFirstClickAtByKeyUser = new Map<string, Date>();
  const abAssignedByVariant: Record<string, number> = {};
  const abSignupClicksByVariant: Record<string, number> = {};
  const diagnosisBehavior: Record<string, { edit: number; apply: number; undo: number; requestMore: number }> = {};
  const decisionFunnel = {
    strategy_changed: 0,
    request_more_alternatives: 0,
    apply_principal_alternative: 0,
    undo_principal_alternative: 0,
  };
  let helpful = 0;
  let notHelpful = 0;
  const pageViewByPath = new Map<string, number>();
  const pageLeaveByPath = new Map<string, { totalMs: number; count: number }>();
  const visitorSetByPath = new Map<string, Set<string>>();
  const sessionPageSets = new Map<string, Set<string>>();
  const pricingViewUserIds = new Set<string>();
  const chatReplyByUser = new Map<string, Date[]>();
  const pricingViewByUser = new Map<string, Date[]>();
  const specialistChatByMode: Record<AssistantModeBucket, ReturnType<typeof emptySpecialistChatModeRow>> = {
    coding: emptySpecialistChatModeRow(),
    opd_demo: emptySpecialistChatModeRow(),
    unknown: emptySpecialistChatModeRow(),
  };
  const specialistReplyMetrics = {
    count: 0,
    simpleDirectQuestionCount: 0,
    compactTargetAppliedCount: 0,
    charCountSum: 0,
    lineCountSum: 0,
    bulletCountSum: 0,
    headingCountSum: 0,
    approxWordCountSum: 0,
    lengthBuckets: { short: 0, medium: 0, long: 0 } as Record<"short" | "medium" | "long", number>,
  };
  const specialistReplyMetricsByMode: Record<
    AssistantModeBucket,
    {
      count: number;
      simpleDirectQuestionCount: number;
      compactTargetAppliedCount: number;
      charCountSum: number;
      lineCountSum: number;
      bulletCountSum: number;
      headingCountSum: number;
      approxWordCountSum: number;
      lengthBuckets: Record<"short" | "medium" | "long", number>;
    }
  > = {
    coding: {
      count: 0,
      simpleDirectQuestionCount: 0,
      compactTargetAppliedCount: 0,
      charCountSum: 0,
      lineCountSum: 0,
      bulletCountSum: 0,
      headingCountSum: 0,
      approxWordCountSum: 0,
      lengthBuckets: { short: 0, medium: 0, long: 0 },
    },
    opd_demo: {
      count: 0,
      simpleDirectQuestionCount: 0,
      compactTargetAppliedCount: 0,
      charCountSum: 0,
      lineCountSum: 0,
      bulletCountSum: 0,
      headingCountSum: 0,
      approxWordCountSum: 0,
      lengthBuckets: { short: 0, medium: 0, long: 0 },
    },
    unknown: {
      count: 0,
      simpleDirectQuestionCount: 0,
      compactTargetAppliedCount: 0,
      charCountSum: 0,
      lineCountSum: 0,
      bulletCountSum: 0,
      headingCountSum: 0,
      approxWordCountSum: 0,
      lengthBuckets: { short: 0, medium: 0, long: 0 },
    },
  };

  for (const row of filteredRows) {
    countByEvent.set(row.message, (countByEvent.get(row.message) || 0) + 1);
    let p: TelemetryPayload | null = null;
    try {
      p = row.payload ? (JSON.parse(row.payload) as TelemetryPayload) : null;
    } catch {
      p = null;
    }
    const modeKey = bucketAssistantMode(p?.assistantMode);

    if (row.message === "specialist_chat_feedback:helpful") {
      helpful += 1;
      specialistChatByMode[modeKey].helpful += 1;
    }
    if (row.message.startsWith("specialist_chat_feedback:not_helpful")) {
      notHelpful += 1;
      const parts = row.message.split(":");
      const reason = parts[2] || "unspecified";
      rejectReasons[reason] = (rejectReasons[reason] || 0) + 1;
      specialistChatByMode[modeKey].notHelpful += 1;
      const rr = specialistChatByMode[modeKey].rejectReasons;
      rr[reason] = (rr[reason] || 0) + 1;
    }
    if (row.message === "summary:strategy_changed") {
      decisionFunnel.strategy_changed += 1;
    } else if (row.message === "summary:request_more_alternatives") {
      decisionFunnel.request_more_alternatives += 1;
    } else if (row.message === "summary:apply_principal_alternative") {
      decisionFunnel.apply_principal_alternative += 1;
    } else if (row.message === "summary:undo_principal_alternative") {
      decisionFunnel.undo_principal_alternative += 1;
    }
    if (row.message === "chat:specialist_chat_reply") {
      specialistChatByMode[modeKey].replies += 1;
      const m = p?.replyMetrics;
      const lengthBucket = m?.lengthBucket === "short" || m?.lengthBucket === "medium" || m?.lengthBucket === "long" ? m.lengthBucket : null;
      specialistReplyMetrics.count += 1;
      specialistReplyMetricsByMode[modeKey].count += 1;
      if (p?.simpleDirectQuestion) {
        specialistReplyMetrics.simpleDirectQuestionCount += 1;
        specialistReplyMetricsByMode[modeKey].simpleDirectQuestionCount += 1;
      }
      if (p?.compactTargetApplied) {
        specialistReplyMetrics.compactTargetAppliedCount += 1;
        specialistReplyMetricsByMode[modeKey].compactTargetAppliedCount += 1;
      }
      if (m) {
        specialistReplyMetrics.charCountSum += Number(m.charCount || 0);
        specialistReplyMetrics.lineCountSum += Number(m.lineCount || 0);
        specialistReplyMetrics.bulletCountSum += Number(m.bulletCount || 0);
        specialistReplyMetrics.headingCountSum += Number(m.headingCount || 0);
        specialistReplyMetrics.approxWordCountSum += Number(m.approxWordCount || 0);
        specialistReplyMetricsByMode[modeKey].charCountSum += Number(m.charCount || 0);
        specialistReplyMetricsByMode[modeKey].lineCountSum += Number(m.lineCount || 0);
        specialistReplyMetricsByMode[modeKey].bulletCountSum += Number(m.bulletCount || 0);
        specialistReplyMetricsByMode[modeKey].headingCountSum += Number(m.headingCount || 0);
        specialistReplyMetricsByMode[modeKey].approxWordCountSum += Number(m.approxWordCount || 0);
      }
      if (lengthBucket) {
        specialistReplyMetrics.lengthBuckets[lengthBucket] += 1;
        specialistReplyMetricsByMode[modeKey].lengthBuckets[lengthBucket] += 1;
      }
      if (row.userId) {
        const bucket = chatReplyByUser.get(row.userId) || [];
        bucket.push(row.createdAt);
        chatReplyByUser.set(row.userId, bucket);
      }
    }

    const v = p?.promptVariant;
    if (v) {
      variantStats[v] = variantStats[v] || { count: 0 };
      variantStats[v].count += 1;
    }
    if (row.message === "summary:block_edited" && p?.blockKey) {
      editedBlockCounts[p.blockKey] = (editedBlockCounts[p.blockKey] || 0) + 1;
    }
    if (p?.strategy) {
      strategyUsage[p.strategy] = (strategyUsage[p.strategy] || 0) + 1;
    }
    if (row.message === "web:cta_click" && p?.ctaKey) {
      ctaClicks[p.ctaKey] = (ctaClicks[p.ctaKey] || 0) + 1;
      if (row.userId) {
        if (!ctaClickUsersByKey.has(p.ctaKey)) ctaClickUsersByKey.set(p.ctaKey, new Set<string>());
        ctaClickUsersByKey.get(p.ctaKey)!.add(row.userId);
        const mapKey = `${p.ctaKey}::${row.userId}`;
        const existing = ctaFirstClickAtByKeyUser.get(mapKey);
        if (!existing || row.createdAt.getTime() < existing.getTime()) {
          ctaFirstClickAtByKeyUser.set(mapKey, row.createdAt);
        }
      }
      const clickVariant = String(p.abVariant || "");
      if (
        clickVariant &&
        (p.ctaKey === "landing_hero_signup" || p.ctaKey === "landing_bottom_signup")
      ) {
        abSignupClicksByVariant[clickVariant] = (abSignupClicksByVariant[clickVariant] || 0) + 1;
      }
    }
    if (row.message === "web:ab_variant_assigned") {
      const variant = String(p?.abVariant || "");
      if (variant) {
        abAssignedByVariant[variant] = (abAssignedByVariant[variant] || 0) + 1;
      }
    }
    const dx = String(p?.diagnosisKey || "").trim();
    if (dx) {
      diagnosisBehavior[dx] = diagnosisBehavior[dx] || { edit: 0, apply: 0, undo: 0, requestMore: 0 };
      if (row.message === "summary:block_edited") diagnosisBehavior[dx].edit += 1;
      if (row.message === "summary:apply_principal_alternative") diagnosisBehavior[dx].apply += 1;
      if (row.message === "summary:undo_principal_alternative") diagnosisBehavior[dx].undo += 1;
      if (row.message === "summary:request_more_alternatives") diagnosisBehavior[dx].requestMore += 1;
    }
    if (row.message === "web:page_view") {
      const path = normalizePath(p?.path);
      pageViewByPath.set(path, (pageViewByPath.get(path) || 0) + 1);
      const visitorId = String(p?.visitorId || "");
      if (visitorId) {
        if (!visitorSetByPath.has(path)) visitorSetByPath.set(path, new Set<string>());
        visitorSetByPath.get(path)!.add(visitorId);
      }
      const sessionId = String(p?.sessionId || "");
      if (sessionId) {
        if (!sessionPageSets.has(sessionId)) sessionPageSets.set(sessionId, new Set<string>());
        sessionPageSets.get(sessionId)!.add(path);
      }
      if (path.startsWith("/pricing") && row.userId) {
        pricingViewUserIds.add(row.userId);
        const pBucket = pricingViewByUser.get(row.userId) || [];
        pBucket.push(row.createdAt);
        pricingViewByUser.set(row.userId, pBucket);
      }
    }
    if (row.message === "web:page_leave") {
      const path = normalizePath(p?.path);
      const durationMs = Number(p?.durationMs || 0);
      if (Number.isFinite(durationMs) && durationMs >= 0) {
        const bucket = pageLeaveByPath.get(path) || { totalMs: 0, count: 0 };
        bucket.totalMs += durationMs;
        bucket.count += 1;
        pageLeaveByPath.set(path, bucket);
      }
    }
  }

  for (const row of filteredTokenRows) {
    if (row.source !== "specialist_chat") continue;
    let tkMode: AssistantModeBucket = "unknown";
    try {
      if (row.payload) {
        const tp = JSON.parse(row.payload) as { assistantMode?: string };
        tkMode = bucketAssistantMode(tp?.assistantMode);
      }
    } catch {
      tkMode = "unknown";
    }
    specialistChatByMode[tkMode].tokenCostThb += Number(row.estimatedCostThb || 0);
  }

  const events = [...countByEvent.entries()]
    .map(([event, count]) => ({ event, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 30);
  const totalRated = helpful + notHelpful;
  const acceptanceRate = totalRated > 0 ? helpful / totalRated : null;
  const tokenCostBySource = filteredTokenRows.reduce<Record<string, number>>((acc, row) => {
    acc[row.source] = (acc[row.source] || 0) + Number(row.estimatedCostThb || 0);
    return acc;
  }, {});
  const tokenCostTotal = Object.values(tokenCostBySource).reduce((sum, n) => sum + n, 0);
  const diagnosisBehaviorRows = Object.entries(diagnosisBehavior)
    .map(([diagnosis, v]) => ({
      diagnosis,
      edit: v.edit,
      apply: v.apply,
      undo: v.undo,
      requestMore: v.requestMore,
      totalActions: v.edit + v.apply + v.undo + v.requestMore,
    }))
    .sort((a, b) => b.totalActions - a.totalActions)
    .slice(0, 20);
  const suggestedPromptTweaks = [
    decisionFunnel.undo_principal_alternative > decisionFunnel.apply_principal_alternative * 0.6
      ? "Undo สูงเมื่อเทียบกับ Apply: ลดความ aggressive ของ what-if และเพิ่มเงื่อนไข evidence ก่อนเสนอ"
      : null,
    decisionFunnel.request_more_alternatives > decisionFunnel.apply_principal_alternative
      ? "ผู้ใช้กดขอทางเลือกเพิ่มบ่อย: ขยายคุณภาพ principal_candidates รอบแรกให้ครอบคลุมกว่าเดิม"
      : null,
    (editedBlockCounts.principal_dx || 0) > (editedBlockCounts.comorbidity || 0) * 1.3
      ? "principal_dx ถูกแก้บ่อย: เพิ่มกฎเลือก principal ที่เน้น admission reason + resource use มากขึ้น"
      : null,
  ].filter(Boolean);
  const topPages = [...pageViewByPath.entries()]
    .map(([path, views]) => {
      const leave = pageLeaveByPath.get(path);
      const avgDurationSec = leave && leave.count > 0 ? leave.totalMs / leave.count / 1000 : 0;
      return {
        path,
        views,
        uniqueVisitors: visitorSetByPath.get(path)?.size || 0,
        avgDurationSec: Number(avgDurationSec.toFixed(1)),
      };
    })
    .sort((a, b) => b.views - a.views)
    .slice(0, 15);
  const topCtaClicks = Object.entries(ctaClicks)
    .map(([ctaKey, count]) => ({ ctaKey, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 20);
  const abLanding = Object.entries(abAssignedByVariant)
    .map(([variant, assigned]) => {
      const signupClicks = abSignupClicksByVariant[variant] || 0;
      return {
        variant,
        assigned,
        signupClicks,
        signupCtr: assigned > 0 ? signupClicks / assigned : null,
      };
    })
    .sort((a, b) => b.assigned - a.assigned);
  const landing = topPages.find((x) => x.path === "/") || { path: "/", views: 0, uniqueVisitors: 0, avgDurationSec: 0 };
  const pricing = topPages.find((x) => x.path === "/pricing") || {
    path: "/pricing",
    views: 0,
    uniqueVisitors: 0,
    avgDurationSec: 0,
  };
  const chatPage = topPages.find((x) => x.path === "/chat") || {
    path: "/chat",
    views: 0,
    uniqueVisitors: 0,
    avgDurationSec: 0,
  };
  let landingSessions = 0;
  let landingToPricingSessions = 0;
  for (const pages of sessionPageSets.values()) {
    if (pages.has("/")) {
      landingSessions += 1;
      if (pages.has("/pricing")) landingToPricingSessions += 1;
    }
  }
  const purchaserUserIds = new Set(filteredApprovedPayments.map((p) => String(p.userId || "")));
  purchaserUserIds.delete("");
  const firstPurchaseByUser = new Map<string, Date>();
  for (const payment of filteredApprovedPayments) {
    const userId = String(payment.userId || "");
    if (!userId) continue;
    const existing = firstPurchaseByUser.get(userId);
    if (!existing || payment.createdAt.getTime() < existing.getTime()) {
      firstPurchaseByUser.set(userId, payment.createdAt);
    }
  }
  let pricingViewAndPurchaseUsers = 0;
  for (const userId of purchaserUserIds) {
    if (pricingViewUserIds.has(userId)) pricingViewAndPurchaseUsers += 1;
  }
  const purchases = filteredApprovedPayments.length;
  const uniquePurchasers = purchaserUserIds.size;
  let usersWithChatBeforePurchase = 0;
  let totalChatBeforePurchase = 0;
  for (const payment of filteredApprovedPayments) {
    const userId = String(payment.userId || "");
    if (!userId) continue;
    const chatTimes = chatReplyByUser.get(userId) || [];
    const beforeCount = chatTimes.filter((dt) => dt.getTime() <= payment.createdAt.getTime()).length;
    if (beforeCount > 0) {
      usersWithChatBeforePurchase += 1;
      totalChatBeforePurchase += beforeCount;
    }
  }
  const trialSignups = recentUsers.length;
  const usageUserSet = new Set(filteredUsageUsers.map((x) => x.userId));
  const trialActiveUsers = recentUsers.filter((u) => u.plan === "trial" && usageUserSet.has(u.id)).length;
  const pricingViewUsers = pricingViewUserIds.size;
  const pricingViewToPurchaseRate = pricingViewUsers > 0 ? pricingViewAndPurchaseUsers / pricingViewUsers : null;
  const chatBeforePurchaseRate = uniquePurchasers > 0 ? usersWithChatBeforePurchase / uniquePurchasers : null;
  const avgChatBeforePurchase = usersWithChatBeforePurchase > 0 ? totalChatBeforePurchase / usersWithChatBeforePurchase : 0;
  const cohortChatToPurchase: Record<string, number> = {};
  const cohortPricingToPurchase: Record<string, number> = {};
  for (const payment of filteredApprovedPayments) {
    const userId = String(payment.userId || "");
    if (!userId) continue;
    const firstChat = (chatReplyByUser.get(userId) || []).sort((a, b) => a.getTime() - b.getTime())[0] || null;
    const firstPricingView = (pricingViewByUser.get(userId) || []).sort((a, b) => a.getTime() - b.getTime())[0] || null;
    if (firstChat) {
      const bucket = toCohortBucket(dayDiff(firstChat, payment.createdAt));
      cohortChatToPurchase[bucket] = (cohortChatToPurchase[bucket] || 0) + 1;
    }
    if (firstPricingView) {
      const bucket = toCohortBucket(dayDiff(firstPricingView, payment.createdAt));
      cohortPricingToPurchase[bucket] = (cohortPricingToPurchase[bucket] || 0) + 1;
    }
  }
  const ctaConversionRows = Array.from(ctaClickUsersByKey.entries())
    .map(([ctaKey, userSet]) => {
      const users = Array.from(userSet);
      let purchasers = 0;
      for (const userId of users) {
        const firstPurchaseAt = firstPurchaseByUser.get(userId);
        const firstClickAt = ctaFirstClickAtByKeyUser.get(`${ctaKey}::${userId}`);
        if (firstPurchaseAt && firstClickAt && firstPurchaseAt.getTime() >= firstClickAt.getTime()) {
          purchasers += 1;
        }
      }
      return {
        ctaKey,
        clickUsers: users.length,
        purchasers,
        purchaseRate: users.length > 0 ? purchasers / users.length : null,
      };
    })
    .sort((a, b) => (b.purchaseRate || 0) - (a.purchaseRate || 0))
    .slice(0, 12);
  const chatUsers = new Set(Array.from(chatReplyByUser.keys()));
  const pricingUsersSet = new Set(Array.from(pricingViewByUser.keys()));
  let chatFirstPurchasers = 0;
  let pricingFirstPurchasers = 0;
  let unknownEntryPurchasers = 0;
  for (const userId of purchaserUserIds) {
    const firstChat = (chatReplyByUser.get(userId) || []).sort((a, b) => a.getTime() - b.getTime())[0] || null;
    const firstPricing = (pricingViewByUser.get(userId) || []).sort((a, b) => a.getTime() - b.getTime())[0] || null;
    if (firstChat && (!firstPricing || firstChat.getTime() <= firstPricing.getTime())) {
      chatFirstPurchasers += 1;
    } else if (firstPricing) {
      pricingFirstPurchasers += 1;
    } else {
      unknownEntryPurchasers += 1;
    }
  }
  const conversionDropoff = [
    {
      step: "landing_sessions",
      value: landingSessions,
      fromPrevRate: null as number | null,
    },
    {
      step: "landing_to_pricing_sessions",
      value: landingToPricingSessions,
      fromPrevRate: landingSessions > 0 ? landingToPricingSessions / landingSessions : null,
    },
    {
      step: "pricing_view_users",
      value: pricingViewUsers,
      fromPrevRate: landingToPricingSessions > 0 ? pricingViewUsers / landingToPricingSessions : null,
    },
    {
      step: "unique_purchasers",
      value: uniquePurchasers,
      fromPrevRate: pricingViewUsers > 0 ? uniquePurchasers / pricingViewUsers : null,
    },
  ];

  if (format === "csv") {
    const csv = toCsv(events);
    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="telemetry-digest-${periodDays}d.csv"`,
      },
    });
  }

  function specialistModeSnapshot(row: ReturnType<typeof emptySpecialistChatModeRow>) {
    const rated = row.helpful + row.notHelpful;
    return {
      replies: row.replies,
      helpful: row.helpful,
      notHelpful: row.notHelpful,
      acceptanceRate: rated > 0 ? row.helpful / rated : null,
      tokenCostThb: Number(row.tokenCostThb.toFixed(4)),
      rejectReasons: row.rejectReasons,
    };
  }

  function summarizeReplyMetrics(row: {
    count: number;
    simpleDirectQuestionCount: number;
    compactTargetAppliedCount: number;
    charCountSum: number;
    lineCountSum: number;
    bulletCountSum: number;
    headingCountSum: number;
    approxWordCountSum: number;
    lengthBuckets: Record<"short" | "medium" | "long", number>;
  }) {
    const c = Math.max(1, row.count);
    return {
      count: row.count,
      simpleDirectQuestionCount: row.simpleDirectQuestionCount,
      compactTargetAppliedCount: row.compactTargetAppliedCount,
      simpleDirectQuestionRate: row.count > 0 ? row.simpleDirectQuestionCount / row.count : null,
      compactTargetAppliedRate: row.count > 0 ? row.compactTargetAppliedCount / row.count : null,
      avgChars: row.count > 0 ? Number((row.charCountSum / c).toFixed(1)) : 0,
      avgLines: row.count > 0 ? Number((row.lineCountSum / c).toFixed(1)) : 0,
      avgBullets: row.count > 0 ? Number((row.bulletCountSum / c).toFixed(1)) : 0,
      avgHeadings: row.count > 0 ? Number((row.headingCountSum / c).toFixed(2)) : 0,
      avgWordsApprox: row.count > 0 ? Number((row.approxWordCountSum / c).toFixed(1)) : 0,
      lengthBuckets: row.lengthBuckets,
    };
  }

  return NextResponse.json({
    ok: true,
    periodDays,
    totalTelemetry: filteredRows.length,
    excludedAdminTelemetry: rows.length - filteredRows.length,
    topEvents: events,
    specialistChatByMode: {
      coding: specialistModeSnapshot(specialistChatByMode.coding),
      opd_demo: specialistModeSnapshot(specialistChatByMode.opd_demo),
      unknown: specialistModeSnapshot(specialistChatByMode.unknown),
    },
    specialistReplyMetrics: summarizeReplyMetrics(specialistReplyMetrics),
    specialistReplyMetricsByMode: {
      coding: summarizeReplyMetrics(specialistReplyMetricsByMode.coding),
      opd_demo: summarizeReplyMetrics(specialistReplyMetricsByMode.opd_demo),
      unknown: summarizeReplyMetrics(specialistReplyMetricsByMode.unknown),
    },
    feedback: {
      helpful,
      notHelpful,
      acceptanceRate,
    },
    promptVariants: variantStats,
    rejectReasons,
    editedBlockCounts,
    strategyUsage,
    topCtaClicks,
    decisionFunnel,
    diagnosisBehaviorRows,
    suggestedPromptTweaks,
    tokenCostBySource,
    tokenCostTotal,
    webAnalytics: {
      topPages,
      landing,
      pricing,
      chat: chatPage,
      funnel: {
        landingSessions,
        landingToPricingSessions,
        landingToPricingRate: landingSessions > 0 ? landingToPricingSessions / landingSessions : null,
        pricingViewUsers,
        pricingViewAndPurchaseUsers,
        pricingViewToPurchaseRate,
      },
      business: {
        trialSignups,
        trialActiveUsers,
        purchases,
        uniquePurchasers,
        usersWithChatBeforePurchase,
        chatBeforePurchaseRate,
        avgChatBeforePurchase: Number(avgChatBeforePurchase.toFixed(2)),
      },
      cohorts: {
        chatToPurchase: cohortChatToPurchase,
        pricingToPurchase: cohortPricingToPurchase,
      },
      abLanding,
      conversionInsights: {
        dropoff: conversionDropoff,
        ctaToPurchase: ctaConversionRows,
        entryPath: {
          chatFirstPurchasers,
          pricingFirstPurchasers,
          unknownEntryPurchasers,
          chatUserToPurchaseRate: chatUsers.size > 0 ? chatFirstPurchasers / chatUsers.size : null,
          pricingUserToPurchaseRate: pricingUsersSet.size > 0 ? pricingFirstPurchasers / pricingUsersSet.size : null,
        },
      },
    },
  });
}

