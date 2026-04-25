"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type TrialExpiredPolicy = {
  enabled: boolean;
  chatScope: "icd10_only" | "icd10_guidance";
  allowOpdDemo: boolean;
  allowSummarize: boolean;
  forceFastModel: boolean;
};

const DEFAULT_POLICY: TrialExpiredPolicy = {
  enabled: true,
  chatScope: "icd10_only",
  allowOpdDemo: false,
  allowSummarize: false,
  forceFastModel: true,
};

export default function AdminTrialExpiredPolicyPage() {
  const [policy, setPolicy] = useState<TrialExpiredPolicy>(DEFAULT_POLICY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string>("");

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/admin/trial-expired-policy", { cache: "no-store" });
        const data = (await res.json()) as { ok?: boolean; policy?: TrialExpiredPolicy; error?: string };
        if (!cancelled && data.ok && data.policy) setPolicy(data.policy);
        if (!cancelled && !data.ok) setMessage(data.error || "โหลด policy ไม่สำเร็จ");
      } catch {
        if (!cancelled) setMessage("โหลด policy ไม่สำเร็จ");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function save() {
    setSaving(true);
    setMessage("");
    try {
      const res = await fetch("/api/admin/trial-expired-policy", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(policy),
      });
      const data = (await res.json()) as { ok?: boolean; policy?: TrialExpiredPolicy; error?: string };
      if (!res.ok || !data.ok || !data.policy) throw new Error(data.error || "บันทึกไม่สำเร็จ");
      setPolicy(data.policy);
      setMessage("บันทึก policy แล้ว");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "บันทึกไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#081120] text-slate-100">
      <div className="mx-auto max-w-3xl space-y-6 px-4 py-8">
        <header className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold text-white">Trial Expired Policy</h1>
            <p className="mt-1 text-sm text-slate-400">ตั้งค่า policy สำหรับผู้ใช้ trial ที่หมดอายุ</p>
          </div>
          <Link
            href="/admin"
            className="rounded-xl border border-slate-700 bg-slate-900/80 px-3 py-2 text-xs font-medium text-slate-200 hover:bg-slate-800"
          >
            กลับ Admin
          </Link>
        </header>

        {loading ? <div className="text-sm text-slate-300">กำลังโหลด...</div> : null}
        {message ? (
          <div className="rounded-xl border border-slate-700/80 bg-slate-950/70 px-4 py-3 text-sm text-slate-200">
            {message}
          </div>
        ) : null}

        <section className="space-y-4 rounded-2xl border border-slate-700/80 bg-slate-950/60 p-4">
          <label className="flex items-center justify-between gap-2 text-sm">
            <span>เปิดใช้ limited mode หลัง trial หมดอายุ</span>
            <input
              type="checkbox"
              checked={policy.enabled}
              onChange={(e) => setPolicy((p) => ({ ...p, enabled: e.target.checked }))}
            />
          </label>

          <label className="block text-sm">
            <span>ขอบเขตการคุยแชท</span>
            <select
              value={policy.chatScope}
              onChange={(e) =>
                setPolicy((p) => ({ ...p, chatScope: e.target.value as TrialExpiredPolicy["chatScope"] }))
              }
              className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm"
            >
              <option value="icd10_only">ICD-10 only (เข้มสุด)</option>
              <option value="icd10_guidance">ICD-10 + coding guidance</option>
            </select>
          </label>

          <label className="flex items-center justify-between gap-2 text-sm">
            <span>อนุญาต OPD mode</span>
            <input
              type="checkbox"
              checked={policy.allowOpdDemo}
              onChange={(e) => setPolicy((p) => ({ ...p, allowOpdDemo: e.target.checked }))}
            />
          </label>

          <label className="flex items-center justify-between gap-2 text-sm">
            <span>อนุญาตสรุปชาร์จ (summarize)</span>
            <input
              type="checkbox"
              checked={policy.allowSummarize}
              onChange={(e) => setPolicy((p) => ({ ...p, allowSummarize: e.target.checked }))}
            />
          </label>

          <label className="flex items-center justify-between gap-2 text-sm">
            <span>บังคับใช้ fast/cheap model</span>
            <input
              type="checkbox"
              checked={policy.forceFastModel}
              onChange={(e) => setPolicy((p) => ({ ...p, forceFastModel: e.target.checked }))}
            />
          </label>

          <div className="pt-2">
            <button
              type="button"
              onClick={() => void save()}
              disabled={saving || loading}
              className="rounded-xl border border-cyan-700 bg-cyan-900/30 px-4 py-2 text-sm font-medium text-cyan-200 hover:bg-cyan-800/40 disabled:opacity-60"
            >
              {saving ? "กำลังบันทึก..." : "บันทึก policy"}
            </button>
          </div>
        </section>
      </div>
    </main>
  );
}
