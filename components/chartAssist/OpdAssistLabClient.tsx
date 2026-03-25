"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { AssistCardResult } from "@/lib/chartAssist/cardTypes";
import type { AssistMode } from "@/lib/chartAssist/cardTypes";
import type { SafetySweep } from "@/lib/chartAssist/cardTypes";
import type { CaseDocument } from "@/lib/chartAssist/caseModel";
import { deriveCaseTabLabel, timelinePlainText } from "@/lib/chartAssist/caseModel";
import {
  appendTimelineEntry,
  createLocalStorageCaseStore,
  ensureCaseInStore,
} from "@/lib/chartAssist/caseStore";
import { getRulePackMeta } from "@/lib/chartAssist/rulePackMeta";
import ReferenceDrawer from "./ReferenceDrawer";
import CardRail from "./CardRail";
import SafetyCard from "./SafetyCard";
import { OPD_ASSIST_DEMOS } from "./opdAssistDemos";

type AnalyzeOk = {
  ok: true;
  mode: AssistMode;
  safetySweep: SafetySweep;
  diseaseCards: AssistCardResult[];
  referenceIds: string[];
  rulePack: ReturnType<typeof getRulePackMeta>;
};

export default function OpdAssistLabClient() {
  const store = useMemo(() => createLocalStorageCaseStore(), []);
  const [caseIds, setCaseIds] = useState<string[]>([]);
  const [activeCaseId, setActiveCaseId] = useState<string | null>(null);
  const [caseDoc, setCaseDoc] = useState<CaseDocument | null>(null);
  const [composer, setComposer] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<AnalyzeOk | null>(null);

  const rulePackStatic = useMemo(() => getRulePackMeta(), []);

  const refreshIndex = useCallback(() => {
    setCaseIds(store.listRecentIds(12));
  }, [store]);

  useEffect(() => {
    const ids = store.listRecentIds(12);
    if (ids.length === 0) {
      const id = crypto.randomUUID();
      const doc = ensureCaseInStore(store, id);
      setCaseDoc(doc);
      setActiveCaseId(id);
      setCaseIds(store.listRecentIds(12));
      return;
    }
    const first = ids[0]!;
    setActiveCaseId(first);
    setCaseDoc(store.load(first) ?? ensureCaseInStore(store, first));
    setCaseIds(ids);
  }, [store]);

  const switchCase = (id: string) => {
    const doc = store.load(id);
    if (!doc) return;
    setActiveCaseId(id);
    setCaseDoc(doc);
    setAnalysis(null);
  };

  const newCase = () => {
    const id = crypto.randomUUID();
    const doc = ensureCaseInStore(store, id);
    setCaseDoc(doc);
    setActiveCaseId(id);
    setAnalysis(null);
    refreshIndex();
  };

  const saveDoc = (doc: CaseDocument) => {
    store.save(doc);
    setCaseDoc(doc);
    refreshIndex();
  };

  const sendToCase = () => {
    if (!caseDoc || !composer.trim()) return;
    const next = appendTimelineEntry(caseDoc, composer);
    saveDoc(next);
    setComposer("");
  };

  const runAnalyze = async (
    rawText: string,
    opts?: { source?: "analyze" | "demo"; demoKey?: string },
  ) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/opd-assist/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rawText,
          modeOverride: caseDoc?.modeOverride ?? null,
          caseId: activeCaseId ?? undefined,
          source: opts?.source ?? "analyze",
          demoKey: opts?.demoKey,
        }),
      });
      const data = (await res.json()) as AnalyzeOk | { ok: false; error?: string };
      if (!res.ok || !("ok" in data) || !data.ok) {
        setError((data as { error?: string }).error ?? "Analyze failed");
        setAnalysis(null);
        return;
      }
      setAnalysis(data);
    } catch {
      setError("Network error");
      setAnalysis(null);
    } finally {
      setLoading(false);
    }
  };

  const onAnalyze = () => {
    if (!caseDoc) return;
    const text = timelinePlainText(caseDoc.timeline);
    if (!text.trim()) {
      setError("Add timeline text first.");
      return;
    }
    void runAnalyze(text);
  };

  const loadDemo = (text: string, demoKey: string) => {
    if (!caseDoc) return;
    const next = appendTimelineEntry(caseDoc, text);
    saveDoc(next);
    void runAnalyze(timelinePlainText(next.timeline), { source: "demo", demoKey });
  };

  const modeOptions: AssistMode[] = ["OPD", "ER", "TRAUMA"];

  return (
    <main className="min-h-screen bg-zinc-50 p-4 text-zinc-900 md:p-6 dark:bg-zinc-950 dark:text-zinc-50">
      <div className="mx-auto max-w-7xl space-y-4">
        <header className="space-y-2 border-b border-zinc-200 pb-4 dark:border-zinc-800">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
            <span className="rounded bg-zinc-900 px-2 py-1 text-xs font-semibold text-white dark:bg-zinc-100 dark:text-zinc-900">
              Admin Lab
            </span>
            <span className="rounded bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-800 dark:bg-amber-900/40 dark:text-amber-200">
              Experimental
            </span>
            <span className="rounded bg-emerald-100 px-2 py-1 text-xs font-semibold text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200">
              Thai-first rules
            </span>
            </div>
            <nav className="flex flex-wrap items-center gap-2 text-xs">
              <Link
                href="/admin"
                className="rounded-lg border border-zinc-300 px-2.5 py-1 font-medium text-zinc-700 transition hover:bg-zinc-100 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800"
              >
                ← Admin
              </Link>
              <Link
                href="/admin/opd-assist-logs"
                className="rounded-lg border border-zinc-300 px-2.5 py-1 font-medium text-zinc-700 transition hover:bg-zinc-100 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800"
              >
                บันทึกการทดสอบ
              </Link>
            </nav>
          </div>
          <p className="text-[11px] font-mono text-zinc-500 dark:text-zinc-500">
            /admin/opd-assist-lab
          </p>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Structured thinking and reference recall tool. Final clinical judgment remains with the
            physician.
          </p>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-zinc-500 dark:text-zinc-500">
            <span>
              Rule version: <strong className="text-zinc-800 dark:text-zinc-200">v{rulePackStatic.ruleVersion}</strong>
            </span>
            <span>
              Last reviewed:{" "}
              <strong className="text-zinc-800 dark:text-zinc-200">{rulePackStatic.reviewedAt}</strong>
            </span>
            <span>
              Review mode:{" "}
              <strong className="text-zinc-800 dark:text-zinc-200">{rulePackStatic.reviewMode}</strong>
            </span>
          </div>
        </header>

        <div className="flex flex-wrap items-center gap-2 border-b border-zinc-200 pb-3 dark:border-zinc-800">
          <span className="text-xs font-medium text-zinc-500">Cases</span>
          <button
            type="button"
            onClick={newCase}
            className="rounded-lg border border-zinc-300 px-2 py-1 text-xs font-medium dark:border-zinc-600"
          >
            + New case
          </button>
          <div className="flex max-w-full flex-wrap gap-1 overflow-x-auto">
            {caseIds.map((id) => {
              const doc = store.load(id);
              const label = doc ? deriveCaseTabLabel(doc) : id.slice(0, 8);
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => switchCase(id)}
                  className={[
                    "max-w-[200px] truncate rounded-full border px-2 py-1 text-xs",
                    activeCaseId === id
                      ? "border-emerald-600 bg-emerald-50 dark:border-emerald-500 dark:bg-emerald-950/40"
                      : "border-zinc-200 dark:border-zinc-700",
                  ].join(" ")}
                  title={label}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.1fr_1.2fr_0.95fr]">
          <section className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900/40">
            <h2 className="mb-3 text-sm font-semibold">Raw input</h2>
            <div className="space-y-2">
              <label className="text-xs text-zinc-500">Mode override</label>
              <select
                className="w-full rounded-lg border border-zinc-300 bg-white px-2 py-1.5 text-sm dark:border-zinc-600 dark:bg-zinc-900"
                value={caseDoc?.modeOverride ?? ""}
                onChange={(e) => {
                  if (!caseDoc) return;
                  const v = e.target.value;
                  const mode = v === "" ? null : (v as AssistMode);
                  saveDoc({ ...caseDoc, modeOverride: mode, version: caseDoc.version + 1, updatedAt: new Date().toISOString() });
                }}
              >
                <option value="">Auto-detect</option>
                {modeOptions.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
              <div className="max-h-40 space-y-2 overflow-y-auto rounded-xl border border-zinc-200 p-2 text-sm dark:border-zinc-700">
                {caseDoc?.timeline.length ? (
                  caseDoc.timeline.map((e) => (
                    <div key={e.entryId} className="border-b border-zinc-100 pb-2 text-xs last:border-0 dark:border-zinc-800">
                      <div className="text-[10px] text-zinc-400">{new Date(e.at).toLocaleString()}</div>
                      <div className="whitespace-pre-wrap text-zinc-800 dark:text-zinc-200">{e.text}</div>
                    </div>
                  ))
                ) : (
                  <div className="text-xs text-zinc-400">No entries yet.</div>
                )}
              </div>
              <textarea
                className="min-h-[88px] w-full rounded-xl border border-zinc-300 p-2 text-sm dark:border-zinc-600 dark:bg-zinc-950"
                placeholder="Paste or type a line, then Send to case"
                value={composer}
                onChange={(e) => setComposer(e.target.value)}
              />
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={sendToCase}
                  className="rounded-lg bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white dark:bg-zinc-100 dark:text-zinc-900"
                >
                  Send to case
                </button>
                <button
                  type="button"
                  onClick={onAnalyze}
                  disabled={loading}
                  className="rounded-lg border border-emerald-600 px-3 py-1.5 text-xs font-medium text-emerald-800 disabled:opacity-50 dark:text-emerald-300"
                >
                  {loading ? "Analyzing…" : "Analyze"}
                </button>
              </div>
              <div className="space-y-1">
                <div className="text-[11px] font-medium text-zinc-500">Quick demos</div>
                <div className="flex flex-wrap gap-1">
                  {OPD_ASSIST_DEMOS.map((d) => (
                    <button
                      key={d.key}
                      type="button"
                      onClick={() => loadDemo(d.text, d.key)}
                      className="rounded border border-zinc-200 px-2 py-0.5 text-[10px] dark:border-zinc-700"
                    >
                      {d.label}
                    </button>
                  ))}
                </div>
              </div>
              {error ? <div className="text-xs text-red-600 dark:text-red-400">{error}</div> : null}
            </div>
          </section>

          <section className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900/40">
            <h2 className="mb-3 text-sm font-semibold">Clinical workspace</h2>
            <div className="space-y-2 text-sm text-zinc-600 dark:text-zinc-400">
              <p className="text-xs">
                V1: structured output is driven by the rule engine and appears in Active cards. Edit
                fields in a later iteration.
              </p>
              {analysis ? (
                <div className="rounded-lg border border-zinc-100 p-2 text-xs dark:border-zinc-800">
                  <div>
                    <span className="font-medium text-zinc-800 dark:text-zinc-200">Detected mode:</span>{" "}
                    {analysis.mode}
                  </div>
                  <div className="mt-1 text-zinc-500">
                    Pack: v{analysis.rulePack.ruleVersion} · reviewed {analysis.rulePack.reviewedAt}
                  </div>
                </div>
              ) : null}
            </div>
          </section>

          <section className="space-y-3 rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900/40">
            <h2 className="text-sm font-semibold">Safety &amp; cards</h2>
            {analysis ? (
              <>
                <SafetyCard sweep={analysis.safetySweep} />
                <CardRail cards={analysis.diseaseCards} />
                <ReferenceDrawer
                  title="Based on sources (rule pack)"
                  sourceIds={rulePackStatic.basedOnSourceIds}
                />
              </>
            ) : (
              <p className="text-xs text-zinc-500">Run Analyze to see safety sweep and disease cards.</p>
            )}
          </section>
        </div>

        <footer className="border-t border-zinc-200 pt-4 text-[11px] text-zinc-400 dark:border-zinc-800">
          Not for public release. Manual-first guideline updates only in V1.
        </footer>
      </div>
    </main>
  );
}
