"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

type SpecialistChatModeStats = {
  replies: number;
  helpful: number;
  notHelpful: number;
  acceptanceRate: number | null;
  tokenCostThb: number;
  rejectReasons: Record<string, number>;
};

const SPECIALIST_CHAT_MODE_KEYS = ["coding", "opd_demo", "unknown"] as const;

function specialistChatModeDisplayLabel(key: (typeof SPECIALIST_CHAT_MODE_KEYS)[number]) {
  if (key === "coding") return "Coding (สรุปชาร์จ)";
  if (key === "opd_demo") return "OPD demo";
  return "ไม่ระบุโหมด";
}

type Digest = {
  ok: boolean;
  periodDays: number;
  totalTelemetry: number;
  excludedAdminTelemetry?: number;
  topEvents: Array<{ event: string; count: number }>;
  feedback: { helpful: number; notHelpful: number; acceptanceRate: number | null };
  promptVariants: Record<string, { count: number }>;
  rejectReasons?: Record<string, number>;
  editedBlockCounts?: Record<string, number>;
  strategyUsage?: Record<string, number>;
  topCtaClicks?: Array<{ ctaKey: string; count: number }>;
  decisionFunnel?: {
    strategy_changed: number;
    request_more_alternatives: number;
    apply_principal_alternative: number;
    undo_principal_alternative: number;
  };
  diagnosisBehaviorRows?: Array<{
    diagnosis: string;
    edit: number;
    apply: number;
    undo: number;
    requestMore: number;
    totalActions: number;
  }>;
  suggestedPromptTweaks?: string[];
  tokenCostBySource?: Record<string, number>;
  tokenCostTotal?: number;
  specialistChatByMode?: {
    coding: SpecialistChatModeStats;
    opd_demo: SpecialistChatModeStats;
    unknown: SpecialistChatModeStats;
  };
  webAnalytics?: {
    topPages: Array<{ path: string; views: number; uniqueVisitors: number; avgDurationSec: number }>;
    landing: { path: string; views: number; uniqueVisitors: number; avgDurationSec: number };
    pricing: { path: string; views: number; uniqueVisitors: number; avgDurationSec: number };
    chat: { path: string; views: number; uniqueVisitors: number; avgDurationSec: number };
    funnel: {
      landingSessions: number;
      landingToPricingSessions: number;
      landingToPricingRate: number | null;
      pricingViewUsers: number;
      pricingViewAndPurchaseUsers: number;
      pricingViewToPurchaseRate: number | null;
    };
    business: {
      trialSignups: number;
      trialActiveUsers: number;
      purchases: number;
      uniquePurchasers: number;
      usersWithChatBeforePurchase: number;
      chatBeforePurchaseRate: number | null;
      avgChatBeforePurchase: number;
    };
    cohorts: {
      chatToPurchase: Record<string, number>;
      pricingToPurchase: Record<string, number>;
    };
    abLanding: Array<{ variant: string; assigned: number; signupClicks: number; signupCtr: number | null }>;
    conversionInsights?: {
      dropoff: Array<{ step: string; value: number; fromPrevRate: number | null }>;
      ctaToPurchase: Array<{ ctaKey: string; clickUsers: number; purchasers: number; purchaseRate: number | null }>;
      entryPath: {
        chatFirstPurchasers: number;
        pricingFirstPurchasers: number;
        unknownEntryPurchasers: number;
        chatUserToPurchaseRate: number | null;
        pricingUserToPurchaseRate: number | null;
      };
    };
  };
};

type AutoImproveRun = {
  generatedAt: string;
  periodDays: number;
  helpful: number;
  notHelpful: number;
  acceptanceRate: number;
  tokenCostThb: number;
  topRejectReasons: Array<{ reason: string; count: number }>;
  modeBreakdown?: Array<{
    mode: string;
    helpful: number;
    notHelpful: number;
    acceptanceRate: number | null;
  }>;
  suggestedActions: string[];
};

export default function AdminTelemetryPage() {
  const [data, setData] = useState<Digest | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [autoRun, setAutoRun] = useState<AutoImproveRun | null>(null);
  const [autoBusy, setAutoBusy] = useState(false);
  const [copilotQuestion, setCopilotQuestion] = useState("");
  const [copilotReply, setCopilotReply] = useState<string | null>(null);
  const [copilotLoading, setCopilotLoading] = useState(false);
  const [copilotError, setCopilotError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/admin/telemetry-digest");
        const json = (await res.json()) as Digest & { error?: string };
        if (!res.ok || !json.ok) throw new Error(json.error || "โหลด telemetry ไม่สำเร็จ");
        setData(json);
      } catch (err) {
        setError(err instanceof Error ? err.message : "โหลด telemetry ไม่สำเร็จ");
      } finally {
        setLoading(false);
      }
    }
    void load();
    fetch("/api/admin/telemetry-digest/auto-improve")
      .then((r) => r.json() as Promise<{ ok?: boolean; lastRun?: AutoImproveRun | null }>)
      .then((d) => {
        if (d.ok && d.lastRun) setAutoRun(d.lastRun);
      })
      .catch(() => undefined);
  }, []);

  async function runAutoImproveNow() {
    setAutoBusy(true);
    try {
      const res = await fetch("/api/admin/telemetry-digest/auto-improve", { method: "POST" });
      const data = (await res.json()) as { ok?: boolean; run?: AutoImproveRun };
      if (res.ok && data.ok && data.run) {
        setAutoRun(data.run);
      }
    } finally {
      setAutoBusy(false);
    }
  }

  const variantRows = useMemo(
    () =>
      Object.entries(data?.promptVariants || {})
        .map(([variant, v]) => ({ variant, count: v.count }))
        .sort((a, b) => b.count - a.count),
    [data]
  );
  const rejectRows = useMemo(
    () =>
      Object.entries(data?.rejectReasons || {})
        .map(([reason, count]) => ({ reason, count }))
        .sort((a, b) => b.count - a.count),
    [data]
  );
  const tokenCostRows = useMemo(
    () =>
      Object.entries(data?.tokenCostBySource || {})
        .map(([source, amount]) => ({ source, amount }))
        .sort((a, b) => b.amount - a.amount),
    [data]
  );
  const editedBlockRows = useMemo(
    () =>
      Object.entries(data?.editedBlockCounts || {})
        .map(([blockKey, count]) => ({ blockKey, count }))
        .sort((a, b) => b.count - a.count),
    [data]
  );
  const strategyRows = useMemo(
    () =>
      Object.entries(data?.strategyUsage || {})
        .map(([strategy, count]) => ({ strategy, count }))
        .sort((a, b) => b.count - a.count),
    [data]
  );
  const ctaRows = useMemo(() => data?.topCtaClicks || [], [data]);
  const cohortChatRows = useMemo(
    () => Object.entries(data?.webAnalytics?.cohorts?.chatToPurchase || {}).sort((a, b) => a[0].localeCompare(b[0])),
    [data]
  );
  const cohortPricingRows = useMemo(
    () => Object.entries(data?.webAnalytics?.cohorts?.pricingToPurchase || {}).sort((a, b) => a[0].localeCompare(b[0])),
    [data]
  );
  const diagnosisRows = useMemo(() => data?.diagnosisBehaviorRows || [], [data]);
  const abLandingRows = useMemo(() => data?.webAnalytics?.abLanding || [], [data]);
  const conversionDropoffRows = useMemo(() => data?.webAnalytics?.conversionInsights?.dropoff || [], [data]);
  const ctaToPurchaseRows = useMemo(() => data?.webAnalytics?.conversionInsights?.ctaToPurchase || [], [data]);
  const entryPath = useMemo(() => data?.webAnalytics?.conversionInsights?.entryPath || null, [data]);

  const specialistRepliesByModeBars = useMemo(() => {
    const m = data?.specialistChatByMode;
    if (!m) return [];
    return SPECIALIST_CHAT_MODE_KEYS.map((key) => ({
      label: specialistChatModeDisplayLabel(key),
      value: m[key].replies,
    }));
  }, [data]);

  const specialistTokenByModeBars = useMemo(() => {
    const m = data?.specialistChatByMode;
    if (!m) return [];
    return SPECIALIST_CHAT_MODE_KEYS.map((key) => ({
      label: specialistChatModeDisplayLabel(key),
      value: m[key].tokenCostThb,
    }));
  }, [data]);

  const specialistRatedByModeBars = useMemo(() => {
    const m = data?.specialistChatByMode;
    if (!m) return [];
    return SPECIALIST_CHAT_MODE_KEYS.flatMap((key) => {
      const row = m[key];
      const base = specialistChatModeDisplayLabel(key);
      return [
        { label: `${base} · helpful`, value: row.helpful },
        { label: `${base} · not helpful`, value: row.notHelpful },
      ];
    });
  }, [data]);

  const funnelViewSteps = useMemo(() => {
    if (!data?.webAnalytics) return [];
    const w = data.webAnalytics;
    return [
      { label: "Landing views", value: w.landing.views },
      { label: "Pricing views", value: w.pricing.views },
      { label: "Chat page views", value: w.chat.views },
      { label: "Purchases", value: w.business.purchases },
    ];
  }, [data]);

  const topEventBars = useMemo(
    () => (data?.topEvents || []).map((e) => ({ label: e.event, value: e.count })),
    [data]
  );

  const askTelemetryCopilot = useCallback(async () => {
    if (!data || !copilotQuestion.trim()) return;
    setCopilotLoading(true);
    setCopilotError(null);
    try {
      const res = await fetch("/api/admin/telemetry-copilot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: copilotQuestion.trim(),
          digest: { ...data },
        }),
      });
      const j = (await res.json()) as { ok?: boolean; reply?: string; error?: string };
      if (!res.ok || !j.ok) throw new Error(j.error || "คำขอล้มเหลว");
      setCopilotReply(typeof j.reply === "string" ? j.reply : "");
    } catch (e) {
      setCopilotError(e instanceof Error ? e.message : "เกิดข้อผิดพลาด");
      setCopilotReply(null);
    } finally {
      setCopilotLoading(false);
    }
  }, [data, copilotQuestion]);

  return (
    <main className="min-h-screen bg-[#081120] text-slate-100">
      <div className="mx-auto max-w-4xl space-y-6 px-4 py-8">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold text-white">Telemetry Dashboard</h1>
            <p className="mt-1 text-sm text-slate-400">
              สรุปช่วงล่าสุดเพื่อดู acceptance และพฤติกรรม — มีแผนภูมิแถบด้านล่างช่วยอ่านเทียบสัดส่วน
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => void runAutoImproveNow()}
              disabled={autoBusy}
              className="rounded-xl border border-cyan-600 bg-cyan-600/20 px-3 py-2 text-xs font-medium text-cyan-200 hover:bg-cyan-600/30 disabled:opacity-60"
            >
              {autoBusy ? "กำลังรัน..." : "รัน AI auto-improve 7 วัน"}
            </button>
            <a
              href="/api/admin/telemetry-digest?format=csv"
              className="rounded-xl border border-emerald-600 bg-emerald-600/20 px-3 py-2 text-xs font-medium text-emerald-200 hover:bg-emerald-600/30"
            >
              Export CSV
            </a>
            <Link
              href="/admin"
              className="rounded-xl border border-slate-700 bg-slate-900/80 px-3 py-2 text-xs font-medium text-slate-200 hover:bg-slate-800"
            >
              กลับ Admin
            </Link>
          </div>
        </header>

        {loading ? <div className="text-sm text-slate-300">กำลังโหลด...</div> : null}
        {error ? (
          <div className="rounded-xl border border-red-900/60 bg-red-950/40 px-4 py-3 text-sm text-red-200">{error}</div>
        ) : null}

        {data ? (
          <>
            <section className="grid gap-3 sm:grid-cols-4">
              <StatCard label={`Events (${data.periodDays} วัน)`} value={String(data.totalTelemetry)} />
              <StatCard label="Admin events excluded" value={String(data.excludedAdminTelemetry || 0)} />
              <StatCard label="Helpful" value={String(data.feedback.helpful)} />
              <StatCard label="Not helpful" value={String(data.feedback.notHelpful)} />
              <StatCard
                label="Acceptance rate"
                value={data.feedback.acceptanceRate == null ? "-" : `${(data.feedback.acceptanceRate * 100).toFixed(1)}%`}
              />
              <StatCard label="Token Cost (THB)" value={(data.tokenCostTotal || 0).toFixed(2)} />
            </section>

            <section className="rounded-2xl border border-violet-600/50 bg-gradient-to-br from-violet-950/40 to-slate-950/60 p-4">
              <h2 className="text-sm font-semibold text-violet-100">ผู้ช่วยวิเคราะห์ Telemetry (เฉพาะแอดมิน)</h2>
              <p className="mt-1 text-xs leading-relaxed text-slate-400">
                ส่ง digest ชุดเดียวกับที่แสดงบนหน้านี้ไปให้โมเดล (รวมสถิติแชทแยกโหมด Coding / OPD) — ถามเรื่องจุดควรพัฒนาเว็บ / conversion / ให้ลูกค้าพร้อมจ่าย ไม่ใช่แชททั่วไปของผู้ใช้ปลายทาง
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {[
                  "จากตัวเลขนี้ ควรปรับหน้าเว็บหรือ flow ไหนก่อนเพื่อให้คนพร้อมจ่ายมากขึ้น?",
                  "ช่วงนี้คอขวดอยู่ที่ funnel ขั้นไหน และควรทดสอบอะไรก่อน?",
                  "ถ้าต้องเลือก 3 งาน dev สำหรับสัปดาห์หน้า จะเลือกอะไรและเพราะอะไร?",
                ].map((q) => (
                  <button
                    key={q}
                    type="button"
                    onClick={() => setCopilotQuestion(q)}
                    className="max-w-full rounded-full border border-violet-500/35 bg-violet-950/50 px-3 py-1.5 text-left text-[11px] text-violet-100 hover:border-violet-400/50 hover:bg-violet-900/40"
                  >
                    {q}
                  </button>
                ))}
              </div>
              <textarea
                value={copilotQuestion}
                onChange={(e) => setCopilotQuestion(e.target.value)}
                rows={3}
                placeholder="ถามเชิง growth / product จากข้อมูลบนหน้านี้..."
                className="mt-3 w-full resize-y rounded-xl border border-slate-600 bg-slate-950/80 px-3 py-2 text-sm text-slate-100 outline-none placeholder:text-slate-600 focus:border-violet-500"
              />
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  disabled={copilotLoading || !copilotQuestion.trim()}
                  onClick={() => void askTelemetryCopilot()}
                  className="rounded-xl border border-violet-500/60 bg-violet-600/30 px-4 py-2 text-sm font-medium text-violet-50 hover:bg-violet-600/45 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {copilotLoading ? "กำลังวิเคราะห์..." : "วิเคราะห์"}
                </button>
                <span className="text-[11px] text-slate-500">ใช้ OPENAI_API_KEY · โมเดล OPENAI_ADMIN_TELEMETRY_MODEL หรือ OPENAI_CHAT_MODEL</span>
              </div>
              {copilotError ? (
                <div className="mt-3 rounded-lg border border-red-800/50 bg-red-950/40 px-3 py-2 text-sm text-red-200">{copilotError}</div>
              ) : null}
              {copilotReply ? (
                <div className="mt-3 rounded-xl border border-slate-700/80 bg-slate-950/80 px-3 py-3 text-sm leading-relaxed text-slate-200 whitespace-pre-wrap">
                  {copilotReply}
                </div>
              ) : null}
            </section>

            <section className="rounded-2xl border border-slate-600/80 bg-slate-900/40 p-4">
              <h2 className="text-sm font-semibold text-white">รู้ว่าควรปรับอะไร — อ่านยังไง</h2>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-relaxed text-slate-300">
                <li>
                  <span className="font-medium text-slate-200">Acceptance rate ต่ำ / not helpful สูง</span> → ไล่ที่ Top
                  reject reasons + prompt variant และดูแยกโหมด Coding vs OPD (ด้านล่าง) แล้วปรับ prompt หรือ UX คำตอบ
                </li>
                <li>
                  <span className="font-medium text-slate-200">Landing → Pricing หรือ Pricing → Purchase ต่ำ</span> →
                  โฟกัสหน้าแรก ราคา ข้อความ CTA และ friction ก่อนชำระ
                </li>
                <li>
                  <span className="font-medium text-slate-200">Token cost พุ่ง</span> → ดูแยกตาม source ว่าเป็นแชทหรือ
                  สรุปชาร์จ แล้วเทียบกับยอดขาย/จำนวนผู้ใช้
                </li>
                <li>
                  <span className="font-medium text-slate-200">ทำซ้ำทุกสัปดาห์</span> — Export CSV เก็บ snapshot แล้วเทียบ
                  กับสัปดาห์ก่อน จะเห็นว่าอะไรเปลี่ยนจริง
                </li>
              </ul>
            </section>

            <section className="grid gap-4 lg:grid-cols-2">
              <HorizontalBarChart title="ปริมาณเข้าชม & ซื้อ (แนว funnel)" rows={funnelViewSteps} maxItems={8} />
              <HorizontalBarChart title="Top telemetry events" rows={topEventBars} maxItems={10} />
              <HorizontalBarChart
                title="Token cost ตาม source (THB)"
                rows={tokenCostRows.map((r) => ({ label: r.source, value: r.amount }))}
                maxItems={10}
                formatValue={(n) => `${n.toFixed(2)} ฿`}
              />
              <HorizontalBarChart title="Reject reasons (จำนวน)" rows={rejectRows.map((r) => ({ label: r.reason, value: r.count }))} maxItems={10} />
              <HorizontalBarChart
                title="Feedback แชท (helpful vs not helpful)"
                rows={[
                  { label: "Helpful", value: data.feedback.helpful },
                  { label: "Not helpful", value: data.feedback.notHelpful },
                ]}
                maxItems={2}
                caption="แถบเปรียบเทียบสัดส่วนระหว่างสองค่านี้เท่านั้น"
              />
            </section>

            {data.specialistChatByMode ? (
              <section className="rounded-2xl border border-emerald-700/50 bg-emerald-950/25 p-4">
                <h2 className="text-sm font-semibold text-emerald-100">แชทผู้เชี่ยวชาญแยกตามโหมด (Coding vs OPD)</h2>
                <p className="mt-1 text-xs leading-relaxed text-slate-400">
                  นับจาก <code className="text-emerald-200/90">assistantMode</code> ใน telemetry ตอนตอบแชทและตอนให้คะแนน — แถว &quot;ไม่ระบุโหมด&quot; มักเป็นข้อมูลเก่าก่อนมีการส่งโหมดในคะแนน
                </p>
                <div className="mt-3 grid gap-3 sm:grid-cols-3">
                  {SPECIALIST_CHAT_MODE_KEYS.map((key) => {
                    const row = data.specialistChatByMode![key];
                    return (
                      <div key={key} className="rounded-xl border border-slate-700/80 bg-slate-950/60 px-3 py-3 text-sm">
                        <div className="font-medium text-emerald-100">{specialistChatModeDisplayLabel(key)}</div>
                        <div className="mt-2 space-y-1 text-xs text-slate-300">
                          <div className="flex justify-between gap-2">
                            <span>ตอบกลับ (ครั้ง)</span>
                            <span className="text-slate-100">{row.replies}</span>
                          </div>
                          <div className="flex justify-between gap-2">
                            <span>Acceptance</span>
                            <span className="text-slate-100">
                              {row.acceptanceRate == null ? "—" : `${(row.acceptanceRate * 100).toFixed(1)}%`}
                            </span>
                          </div>
                          <div className="flex justify-between gap-2">
                            <span>helpful / not</span>
                            <span className="text-slate-100">
                              {row.helpful} / {row.notHelpful}
                            </span>
                          </div>
                          <div className="flex justify-between gap-2">
                            <span>Token แชท (฿)</span>
                            <span className="text-slate-100">{row.tokenCostThb.toFixed(2)}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="mt-4 grid gap-4 lg:grid-cols-2">
                  <HorizontalBarChart title="จำนวนตอบแชท (replies) ตามโหมด" rows={specialistRepliesByModeBars} maxItems={3} />
                  <HorizontalBarChart
                    title="Token specialist_chat (THB) ตามโหมด"
                    rows={specialistTokenByModeBars}
                    maxItems={3}
                    formatValue={(n) => `${n.toFixed(2)} ฿`}
                  />
                  <HorizontalBarChart
                    title="คะแนน helpful / not helpful แยกโหมด"
                    rows={specialistRatedByModeBars}
                    maxItems={6}
                    caption="แต่ละคู่แถบเปรียบเทียบ helpful กับ not helpful ภายในโหมดนั้นเท่านั้น"
                  />
                </div>
              </section>
            ) : null}

            <section className="grid gap-3 sm:grid-cols-3">
              <StatCard label="Landing views" value={String(data.webAnalytics?.landing.views || 0)} />
              <StatCard label="Pricing views" value={String(data.webAnalytics?.pricing.views || 0)} />
              <StatCard label="Purchases" value={String(data.webAnalytics?.business.purchases || 0)} />
              <StatCard
                label="Landing -> Pricing"
                value={
                  data.webAnalytics?.funnel.landingToPricingRate == null
                    ? "-"
                    : `${(data.webAnalytics.funnel.landingToPricingRate * 100).toFixed(1)}%`
                }
              />
              <StatCard
                label="Pricing -> Purchase (user)"
                value={
                  data.webAnalytics?.funnel.pricingViewToPurchaseRate == null
                    ? "-"
                    : `${(data.webAnalytics.funnel.pricingViewToPurchaseRate * 100).toFixed(1)}%`
                }
              />
              <StatCard
                label="Chat before purchase"
                value={
                  data.webAnalytics?.business.chatBeforePurchaseRate == null
                    ? "-"
                    : `${(data.webAnalytics.business.chatBeforePurchaseRate * 100).toFixed(1)}%`
                }
              />
            </section>

            <section className="rounded-2xl border border-cyan-700/60 bg-cyan-950/30 p-4">
              <h2 className="text-sm font-semibold text-cyan-100">AI Auto-Improve (ทุก 7 วัน)</h2>
              {autoRun ? (
                <div className="mt-2 space-y-1 text-sm text-slate-200">
                  <div>Last run: {new Date(autoRun.generatedAt).toLocaleString("th-TH")}</div>
                  <div>Acceptance: {(autoRun.acceptanceRate * 100).toFixed(1)}%</div>
                  <div>Token cost: {autoRun.tokenCostThb.toFixed(2)} THB</div>
                  <div className="text-xs text-slate-300">
                    Suggestions: {autoRun.suggestedActions.length ? autoRun.suggestedActions.join(" | ") : "ไม่มี"}
                  </div>
                  {autoRun.modeBreakdown?.length ? (
                    <div className="mt-3 grid gap-2 sm:grid-cols-2">
                      {autoRun.modeBreakdown.map((row) => (
                        <div key={row.mode} className="rounded-lg border border-cyan-900/60 bg-slate-950/40 px-3 py-2 text-xs">
                          <div className="font-medium text-cyan-100">{row.mode}</div>
                          <div className="mt-1 text-slate-300">helpful {row.helpful} / not helpful {row.notHelpful}</div>
                          <div className="text-slate-400">
                            acceptance {row.acceptanceRate == null ? "-" : `${(row.acceptanceRate * 100).toFixed(1)}%`}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
              ) : (
                <p className="mt-2 text-sm text-slate-400">ยังไม่เคยรัน auto-improve</p>
              )}
            </section>

            <section className="rounded-2xl border border-slate-700/80 bg-slate-950/60 p-4">
              <h2 className="text-sm font-semibold text-white">Web Usage & Conversion</h2>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                <div className="rounded-lg border border-slate-800 bg-slate-900/80 px-3 py-2 text-sm">
                  <span className="text-slate-300">Landing avg dwell</span>
                  <span className="float-right text-cyan-300">
                    {(data.webAnalytics?.landing.avgDurationSec || 0).toFixed(1)}s
                  </span>
                </div>
                <div className="rounded-lg border border-slate-800 bg-slate-900/80 px-3 py-2 text-sm">
                  <span className="text-slate-300">Pricing avg dwell</span>
                  <span className="float-right text-cyan-300">
                    {(data.webAnalytics?.pricing.avgDurationSec || 0).toFixed(1)}s
                  </span>
                </div>
                <div className="rounded-lg border border-slate-800 bg-slate-900/80 px-3 py-2 text-sm">
                  <span className="text-slate-300">Trial signups</span>
                  <span className="float-right text-emerald-300">{data.webAnalytics?.business.trialSignups || 0}</span>
                </div>
                <div className="rounded-lg border border-slate-800 bg-slate-900/80 px-3 py-2 text-sm">
                  <span className="text-slate-300">Trial active users</span>
                  <span className="float-right text-emerald-300">{data.webAnalytics?.business.trialActiveUsers || 0}</span>
                </div>
                <div className="rounded-lg border border-slate-800 bg-slate-900/80 px-3 py-2 text-sm">
                  <span className="text-slate-300">Users with chat before purchase</span>
                  <span className="float-right text-indigo-300">
                    {data.webAnalytics?.business.usersWithChatBeforePurchase || 0}
                  </span>
                </div>
                <div className="rounded-lg border border-slate-800 bg-slate-900/80 px-3 py-2 text-sm">
                  <span className="text-slate-300">Avg chat before purchase</span>
                  <span className="float-right text-indigo-300">
                    {(data.webAnalytics?.business.avgChatBeforePurchase || 0).toFixed(2)}
                  </span>
                </div>
              </div>
              <h3 className="mt-4 text-xs font-semibold uppercase tracking-wide text-slate-400">Top Pages</h3>
              {data.webAnalytics?.topPages?.length ? (
                <div className="mt-2 space-y-2">
                  {data.webAnalytics.topPages.slice(0, 8).map((p) => (
                    <div
                      key={p.path}
                      className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-2 rounded-lg border border-slate-800 bg-slate-900/80 px-3 py-2 text-sm"
                    >
                      <span className="truncate text-slate-200">{p.path}</span>
                      <span className="text-cyan-300">view {p.views}</span>
                      <span className="text-emerald-300">uu {p.uniqueVisitors}</span>
                      <span className="text-slate-400">{p.avgDurationSec.toFixed(1)}s</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-2 text-sm text-slate-500">ยังไม่มี web analytics เพียงพอ</p>
              )}
            </section>

            <section className="rounded-2xl border border-indigo-700/70 bg-indigo-950/20 p-4">
              <h2 className="text-sm font-semibold text-white">Conversion Insights (Actionable)</h2>
              <h3 className="mt-3 text-xs font-semibold uppercase tracking-wide text-slate-300">Drop-off by step</h3>
              {conversionDropoffRows.length ? (
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  {conversionDropoffRows.map((row) => (
                    <div key={row.step} className="rounded-lg border border-indigo-900/60 bg-slate-900/80 px-3 py-2 text-sm">
                      <div className="text-slate-300">{row.step}</div>
                      <div className="mt-1 flex items-center justify-between text-xs">
                        <span className="text-indigo-300">count {row.value}</span>
                        <span className="text-emerald-300">
                          {row.fromPrevRate == null ? "-" : `${(row.fromPrevRate * 100).toFixed(1)}% from prev`}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-2 text-sm text-slate-500">ยังไม่มีข้อมูล drop-off</p>
              )}

              <h3 className="mt-4 text-xs font-semibold uppercase tracking-wide text-slate-300">Top CTA to purchase (user-based)</h3>
              {ctaToPurchaseRows.length ? (
                <div className="mt-2 space-y-2">
                  {ctaToPurchaseRows.slice(0, 8).map((row) => (
                    <div
                      key={row.ctaKey}
                      className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-2 rounded-lg border border-slate-800 bg-slate-900/80 px-3 py-2 text-sm"
                    >
                      <span className="truncate text-slate-200">{row.ctaKey}</span>
                      <span className="text-cyan-300">users {row.clickUsers}</span>
                      <span className="text-emerald-300">buyers {row.purchasers}</span>
                      <span className="text-indigo-300">
                        {row.purchaseRate == null ? "-" : `${(row.purchaseRate * 100).toFixed(1)}%`}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-2 text-sm text-slate-500">ยังไม่มีข้อมูล CTA -&gt; purchase</p>
              )}

              <h3 className="mt-4 text-xs font-semibold uppercase tracking-wide text-slate-300">Entry path (Purchaser cohort)</h3>
              {entryPath ? (
                <div className="mt-2 grid gap-2 sm:grid-cols-3">
                  <div className="rounded-lg border border-slate-800 bg-slate-900/80 px-3 py-2 text-sm">
                    <div className="text-slate-300">Chat-first purchasers</div>
                    <div className="mt-1 text-indigo-300">{entryPath.chatFirstPurchasers}</div>
                  </div>
                  <div className="rounded-lg border border-slate-800 bg-slate-900/80 px-3 py-2 text-sm">
                    <div className="text-slate-300">Pricing-first purchasers</div>
                    <div className="mt-1 text-indigo-300">{entryPath.pricingFirstPurchasers}</div>
                  </div>
                  <div className="rounded-lg border border-slate-800 bg-slate-900/80 px-3 py-2 text-sm">
                    <div className="text-slate-300">Unknown entry purchasers</div>
                    <div className="mt-1 text-indigo-300">{entryPath.unknownEntryPurchasers}</div>
                  </div>
                  <div className="rounded-lg border border-slate-800 bg-slate-900/80 px-3 py-2 text-sm">
                    <div className="text-slate-300">Chat users -&gt; purchase</div>
                    <div className="mt-1 text-emerald-300">
                      {entryPath.chatUserToPurchaseRate == null ? "-" : `${(entryPath.chatUserToPurchaseRate * 100).toFixed(1)}%`}
                    </div>
                  </div>
                  <div className="rounded-lg border border-slate-800 bg-slate-900/80 px-3 py-2 text-sm">
                    <div className="text-slate-300">Pricing users -&gt; purchase</div>
                    <div className="mt-1 text-emerald-300">
                      {entryPath.pricingUserToPurchaseRate == null
                        ? "-"
                        : `${(entryPath.pricingUserToPurchaseRate * 100).toFixed(1)}%`}
                    </div>
                  </div>
                </div>
              ) : (
                <p className="mt-2 text-sm text-slate-500">ยังไม่มีข้อมูล entry path</p>
              )}
            </section>

            <section className="rounded-2xl border border-slate-700/80 bg-slate-950/60 p-4">
              <h2 className="text-sm font-semibold text-white">Top Events</h2>
              {data.topEvents.length ? (
                <div className="mt-3 space-y-2">
                  {data.topEvents.map((e) => (
                    <div
                      key={e.event}
                      className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-900/80 px-3 py-2 text-sm"
                    >
                      <span className="text-slate-200">{e.event}</span>
                      <span className="text-cyan-300">{e.count}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-2 text-sm text-slate-500">ยังไม่มีข้อมูล</p>
              )}
            </section>

            <section className="rounded-2xl border border-slate-700/80 bg-slate-950/60 p-4">
              <h2 className="text-sm font-semibold text-white">Top CTA Clicks</h2>
              {ctaRows.length ? (
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  {ctaRows.map((r) => (
                    <div key={r.ctaKey} className="rounded-lg border border-slate-800 bg-slate-900/80 px-3 py-2 text-sm">
                      <span className="text-slate-300">{r.ctaKey}</span>
                      <span className="float-right text-cyan-300">{r.count}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-2 text-sm text-slate-500">ยังไม่มีข้อมูล CTA click</p>
              )}
            </section>

            <section className="rounded-2xl border border-slate-700/80 bg-slate-950/60 p-4">
              <h2 className="text-sm font-semibold text-white">Conversion Cohorts</h2>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <div className="rounded-lg border border-slate-800 bg-slate-900/80 p-3">
                  <div className="text-xs text-slate-400">Chat -&gt; Purchase</div>
                  {cohortChatRows.length ? (
                    <div className="mt-2 space-y-1 text-sm">
                      {cohortChatRows.map(([bucket, count]) => (
                        <div key={bucket} className="flex items-center justify-between">
                          <span className="text-slate-300">{bucket}</span>
                          <span className="text-cyan-300">{count}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="mt-2 text-sm text-slate-500">ยังไม่มี cohort</div>
                  )}
                </div>
                <div className="rounded-lg border border-slate-800 bg-slate-900/80 p-3">
                  <div className="text-xs text-slate-400">Pricing View -&gt; Purchase</div>
                  {cohortPricingRows.length ? (
                    <div className="mt-2 space-y-1 text-sm">
                      {cohortPricingRows.map(([bucket, count]) => (
                        <div key={bucket} className="flex items-center justify-between">
                          <span className="text-slate-300">{bucket}</span>
                          <span className="text-emerald-300">{count}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="mt-2 text-sm text-slate-500">ยังไม่มี cohort</div>
                  )}
                </div>
              </div>
            </section>

            <section className="rounded-2xl border border-slate-700/80 bg-slate-950/60 p-4">
              <h2 className="text-sm font-semibold text-white">Landing A/B CTA</h2>
              {abLandingRows.length ? (
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  {abLandingRows.map((row) => (
                    <div key={row.variant} className="rounded-lg border border-slate-800 bg-slate-900/80 px-3 py-2 text-sm">
                      <div className="text-slate-200">Variant {row.variant}</div>
                      <div className="mt-1 text-xs text-slate-400">
                        assigned {row.assigned} · signup clicks {row.signupClicks} · CTR{" "}
                        {row.signupCtr == null ? "-" : `${(row.signupCtr * 100).toFixed(1)}%`}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-2 text-sm text-slate-500">ยังไม่มีข้อมูล A/B</p>
              )}
            </section>

            <section className="rounded-2xl border border-slate-700/80 bg-slate-950/60 p-4">
              <h2 className="text-sm font-semibold text-white">Prompt Variant Usage</h2>
              {variantRows.length ? (
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  {variantRows.map((v) => (
                    <div key={v.variant} className="rounded-lg border border-slate-800 bg-slate-900/80 px-3 py-2 text-sm">
                      <span className="text-slate-300">Variant {v.variant}</span>
                      <span className="float-right text-indigo-300">{v.count}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-2 text-sm text-slate-500">ยังไม่มีข้อมูล variant</p>
              )}
            </section>

            <section className="rounded-2xl border border-slate-700/80 bg-slate-950/60 p-4">
              <h2 className="text-sm font-semibold text-white">Top Reject Reasons</h2>
              {rejectRows.length ? (
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  {rejectRows.map((r) => (
                    <div key={r.reason} className="rounded-lg border border-slate-800 bg-slate-900/80 px-3 py-2 text-sm">
                      <span className="text-slate-300">{r.reason}</span>
                      <span className="float-right text-rose-300">{r.count}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-2 text-sm text-slate-500">ยังไม่มีข้อมูล reject reason</p>
              )}
            </section>

            <section className="rounded-2xl border border-slate-700/80 bg-slate-950/60 p-4">
              <h2 className="text-sm font-semibold text-white">Token Cost by Source (7 วัน)</h2>
              {tokenCostRows.length ? (
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  {tokenCostRows.map((r) => (
                    <div key={r.source} className="rounded-lg border border-slate-800 bg-slate-900/80 px-3 py-2 text-sm">
                      <span className="text-slate-300">{r.source}</span>
                      <span className="float-right text-emerald-300">{r.amount.toFixed(2)} THB</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-2 text-sm text-slate-500">ยังไม่มีข้อมูล token cost</p>
              )}
            </section>

            <section className="rounded-2xl border border-slate-700/80 bg-slate-950/60 p-4">
              <h2 className="text-sm font-semibold text-white">Top Edited Diagnosis Blocks</h2>
              {editedBlockRows.length ? (
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  {editedBlockRows.map((r) => (
                    <div key={r.blockKey} className="rounded-lg border border-slate-800 bg-slate-900/80 px-3 py-2 text-sm">
                      <span className="text-slate-300">{r.blockKey}</span>
                      <span className="float-right text-cyan-300">{r.count}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-2 text-sm text-slate-500">ยังไม่มีข้อมูลแก้ไขบล็อก</p>
              )}
            </section>

            <section className="rounded-2xl border border-slate-700/80 bg-slate-950/60 p-4">
              <h2 className="text-sm font-semibold text-white">Summary Decision Funnel (7 วัน)</h2>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                <div className="rounded-lg border border-slate-800 bg-slate-900/80 px-3 py-2 text-sm">
                  <span className="text-slate-300">strategy changed</span>
                  <span className="float-right text-indigo-300">{data.decisionFunnel?.strategy_changed || 0}</span>
                </div>
                <div className="rounded-lg border border-slate-800 bg-slate-900/80 px-3 py-2 text-sm">
                  <span className="text-slate-300">request more alternatives</span>
                  <span className="float-right text-indigo-300">
                    {data.decisionFunnel?.request_more_alternatives || 0}
                  </span>
                </div>
                <div className="rounded-lg border border-slate-800 bg-slate-900/80 px-3 py-2 text-sm">
                  <span className="text-slate-300">apply principal alternative</span>
                  <span className="float-right text-emerald-300">
                    {data.decisionFunnel?.apply_principal_alternative || 0}
                  </span>
                </div>
                <div className="rounded-lg border border-slate-800 bg-slate-900/80 px-3 py-2 text-sm">
                  <span className="text-slate-300">undo principal alternative</span>
                  <span className="float-right text-rose-300">
                    {data.decisionFunnel?.undo_principal_alternative || 0}
                  </span>
                </div>
              </div>
              <h3 className="mt-4 text-xs font-semibold uppercase tracking-wide text-slate-400">Strategy usage</h3>
              {strategyRows.length ? (
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  {strategyRows.map((s) => (
                    <div key={s.strategy} className="rounded-lg border border-slate-800 bg-slate-900/80 px-3 py-2 text-sm">
                      <span className="text-slate-300">{s.strategy}</span>
                      <span className="float-right text-cyan-300">{s.count}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-2 text-sm text-slate-500">ยังไม่มีข้อมูล strategy</p>
              )}
              <h3 className="mt-4 text-xs font-semibold uppercase tracking-wide text-slate-400">Suggested prompt tweaks</h3>
              {data.suggestedPromptTweaks?.length ? (
                <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-300">
                  {data.suggestedPromptTweaks.map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
              ) : (
                <p className="mt-2 text-sm text-slate-500">ยังไม่มีข้อเสนอแนะอัตโนมัติ</p>
              )}
            </section>

            <section className="rounded-2xl border border-slate-700/80 bg-slate-950/60 p-4">
              <h2 className="text-sm font-semibold text-white">Diagnosis Behavior Patterns (7 วัน)</h2>
              {diagnosisRows.length ? (
                <div className="mt-3 space-y-2">
                  {diagnosisRows.slice(0, 12).map((r) => (
                    <div key={r.diagnosis} className="rounded-lg border border-slate-800 bg-slate-900/80 px-3 py-2 text-sm">
                      <div className="text-slate-200">{r.diagnosis}</div>
                      <div className="mt-1 text-xs text-slate-400">
                        edit {r.edit} · apply {r.apply} · undo {r.undo} · requestMore {r.requestMore}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-2 text-sm text-slate-500">ยังไม่มีข้อมูลราย diagnosis</p>
              )}
            </section>
          </>
        ) : null}
      </div>
    </main>
  );
}

function HorizontalBarChart(props: {
  title: string;
  rows: { label: string; value: number }[];
  maxItems?: number;
  formatValue?: (n: number) => string;
  caption?: string;
}) {
  const maxItems = props.maxItems ?? 10;
  const slice = props.rows.slice(0, maxItems);
  const max = Math.max(1, ...slice.map((r) => r.value));
  const fmt = props.formatValue ?? ((n: number) => String(n));
  return (
    <div className="rounded-2xl border border-slate-700/80 bg-slate-950/60 p-4">
      {props.title ? <h2 className="text-sm font-semibold text-white">{props.title}</h2> : null}
      <div className={props.title ? "mt-3 space-y-2.5" : "space-y-2.5"}>
        {slice.length ? (
          slice.map((row) => (
            <div key={row.label}>
              <div className="mb-0.5 flex items-center justify-between gap-2 text-xs">
                <span className="min-w-0 truncate text-slate-300" title={row.label}>
                  {row.label}
                </span>
                <span className="shrink-0 font-medium text-cyan-300">{fmt(row.value)}</span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-slate-800">
                <div
                  className="h-full min-w-0 rounded-full bg-gradient-to-r from-cyan-700 to-cyan-400"
                  style={{ width: `${Math.min(100, (row.value / max) * 100)}%` }}
                />
              </div>
            </div>
          ))
        ) : (
          <p className="text-sm text-slate-500">ยังไม่มีข้อมูล</p>
        )}
      </div>
      {props.caption ? <p className="mt-2 text-[11px] text-slate-500">{props.caption}</p> : null}
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-700/80 bg-slate-950/70 px-4 py-3">
      <div className="text-xs text-slate-500">{label}</div>
      <div className="mt-1 text-lg font-semibold text-slate-100">{value}</div>
    </div>
  );
}

