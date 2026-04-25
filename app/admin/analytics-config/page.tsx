"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type CheckItem = {
  key: "gaMeasurementId" | "googleAdsId" | "googleSiteVerification";
  configured: boolean;
  maskedValue: string | null;
};

type AnalyticsConfigResponse = {
  ok: boolean;
  error?: string;
  checks?: CheckItem[];
  summary?: {
    trackingEnabled: boolean;
    conversionEnabled: boolean;
    siteVerificationEnabled: boolean;
    warningCount: number;
  };
  warningMessages?: string[];
};

function toLabel(key: CheckItem["key"]) {
  if (key === "gaMeasurementId") return "GA Measurement ID";
  if (key === "googleAdsId") return "Google Ads ID";
  return "Google Site Verification";
}

export default function AdminAnalyticsConfigPage() {
  const [data, setData] = useState<AnalyticsConfigResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastCheckedAt, setLastCheckedAt] = useState<Date | null>(null);

  async function loadConfig(options?: { silent?: boolean }) {
    const silent = Boolean(options?.silent);
    if (silent) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/analytics-config");
      const json = (await res.json()) as AnalyticsConfigResponse;
      if (!res.ok || !json.ok) throw new Error(json.error || "โหลดสถานะไม่สำเร็จ");
      setData(json);
      setLastCheckedAt(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : "โหลดสถานะไม่สำเร็จ");
    } finally {
      if (silent) setRefreshing(false);
      else setLoading(false);
    }
  }

  useEffect(() => {
    void loadConfig();
  }, []);

  const checks = useMemo(() => data?.checks || [], [data]);
  const warnings = useMemo(() => data?.warningMessages || [], [data]);

  return (
    <main className="min-h-screen bg-[#081120] text-slate-100">
      <div className="mx-auto max-w-3xl space-y-6 px-4 py-8">
        <header className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold text-white">Analytics Config Health</h1>
            <p className="mt-1 text-sm text-slate-400">
              ตรวจความพร้อม env สำหรับ GA, Google Ads และ Search Console แบบไม่แสดงค่าจริง
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void loadConfig({ silent: true })}
              disabled={loading || refreshing}
              className="rounded-xl border border-cyan-700 bg-cyan-900/30 px-3 py-2 text-xs font-medium text-cyan-200 hover:bg-cyan-800/40 disabled:opacity-60"
            >
              {refreshing ? "Refreshing..." : "Refresh"}
            </button>
            <Link
              href="/admin"
              className="rounded-xl border border-slate-700 bg-slate-900/80 px-3 py-2 text-xs font-medium text-slate-200 hover:bg-slate-800"
            >
              กลับ Admin
            </Link>
          </div>
        </header>

        {loading ? <div className="text-sm text-slate-300">กำลังโหลด...</div> : null}
        {lastCheckedAt ? (
          <div className="text-xs text-slate-500">Last checked: {lastCheckedAt.toLocaleString("th-TH")}</div>
        ) : null}
        {error ? (
          <div className="rounded-xl border border-red-900/60 bg-red-950/40 px-4 py-3 text-sm text-red-200">{error}</div>
        ) : null}

        {data?.summary ? (
          <section className="grid gap-3 sm:grid-cols-4">
            <StatCard label="Tracking" ok={data.summary.trackingEnabled} />
            <StatCard label="Conversion" ok={data.summary.conversionEnabled} />
            <StatCard label="Site Verify" ok={data.summary.siteVerificationEnabled} />
            <div className="rounded-xl border border-slate-700/80 bg-slate-950/70 px-4 py-3">
              <div className="text-xs text-slate-500">Warnings</div>
              <div className="mt-1 text-lg font-semibold text-amber-300">{data.summary.warningCount}</div>
            </div>
          </section>
        ) : null}

        <section className="rounded-2xl border border-slate-700/80 bg-slate-950/60 p-4">
          <h2 className="text-sm font-semibold text-white">Environment Checks</h2>
          {checks.length ? (
            <div className="mt-3 grid gap-2">
              {checks.map((item) => (
                <div
                  key={item.key}
                  className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-900/80 px-3 py-2 text-sm"
                >
                  <div>
                    <div className="text-slate-200">{toLabel(item.key)}</div>
                    <div className="text-xs text-slate-500">{item.maskedValue || "not configured"}</div>
                  </div>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      item.configured
                        ? "border border-emerald-700/60 bg-emerald-900/30 text-emerald-300"
                        : "border border-rose-700/60 bg-rose-900/30 text-rose-300"
                    }`}
                  >
                    {item.configured ? "configured" : "missing"}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-2 text-sm text-slate-500">ไม่มีข้อมูล</p>
          )}
        </section>

        <section className="rounded-2xl border border-amber-700/50 bg-amber-950/20 p-4">
          <h2 className="text-sm font-semibold text-amber-100">Warnings</h2>
          {warnings.length ? (
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-amber-200">
              {warnings.map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-sm text-emerald-300">ไม่มี warning — พร้อมใช้งาน</p>
          )}
        </section>
      </div>
    </main>
  );
}

function StatCard({ label, ok }: { label: string; ok: boolean }) {
  return (
    <div className="rounded-xl border border-slate-700/80 bg-slate-950/70 px-4 py-3">
      <div className="text-xs text-slate-500">{label}</div>
      <div className={`mt-1 text-lg font-semibold ${ok ? "text-emerald-300" : "text-rose-300"}`}>
        {ok ? "OK" : "Missing"}
      </div>
    </div>
  );
}
