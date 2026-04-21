"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import type { AssistMode } from "@/lib/chartAssist/cardTypes";
import type { CaseDocument } from "@/lib/chartAssist/caseModel";
import { timelinePlainText } from "@/lib/chartAssist/caseModel";
import {
  appendTimelineEntry,
  createLocalStorageCaseStore,
  ensureCaseInStore,
} from "@/lib/chartAssist/caseStore";
import type { ChartRuleAnalysis } from "@/lib/chartAssist/types";
import type { WorkspaceSectionId } from "@/lib/chartAssist/caseModel";

const MODE_OPTIONS: AssistMode[] = ["OPD", "ER", "TRAUMA", "PSYCH", "LABOR_ROOM", "GYNE"];

const WORKSPACE_META: { id: WorkspaceSectionId; label: string }[] = [
  { id: "cc", label: "CC" },
  { id: "pi", label: "PI / HPI" },
  { id: "pastHistory", label: "PMH / allergy / meds" },
  { id: "pe", label: "PE / vitals" },
  { id: "assessment", label: "Assessment" },
  { id: "diagnosis", label: "Diagnosis" },
  { id: "differential", label: "Differential" },
  { id: "plan", label: "Plan" },
  { id: "patientAdvice", label: "Patient instructions" },
];

function workspaceOrderForMode(mode: AssistMode): WorkspaceSectionId[] {
  if (mode === "ER" || mode === "TRAUMA") {
    return [
      "cc",
      "pi",
      "assessment",
      "plan",
      "pe",
      "pastHistory",
      "diagnosis",
      "differential",
      "patientAdvice",
    ];
  }
  return WORKSPACE_META.map((w) => w.id);
}

function labelForSection(id: WorkspaceSectionId): string {
  return WORKSPACE_META.find((w) => w.id === id)?.label ?? id;
}

export default function ChartAssistLab() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const store = useMemo(() => createLocalStorageCaseStore(), []);

  const [caseId, setCaseId] = useState<string | null>(null);
  const [doc, setDoc] = useState<CaseDocument | null>(null);
  const [composer, setComposer] = useState("");
  const [analysis, setAnalysis] = useState<ChartRuleAnalysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [liveAssist, setLiveAssist] = useState(false);
  const liveTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const caseParam = searchParams.get("case");
  useEffect(() => {
    const uuidRe =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    const id = caseParam && uuidRe.test(caseParam) ? caseParam : crypto.randomUUID();
    if (!caseParam || !uuidRe.test(caseParam)) {
      router.replace(`/admin/chart-assist-lab?case=${id}`, { scroll: false });
    }
    const d = ensureCaseInStore(store, id);
    setCaseId(id);
    setDoc(d);
  }, [caseParam, router, store]);

  const persist = useCallback(
    (next: CaseDocument) => {
      store.save(next);
      setDoc(next);
    },
    [store],
  );

  const runAnalyze = useCallback(async () => {
    if (!doc || !caseId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/chart-assist/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          caseId,
          timeline: doc.timeline,
          modeOverride: doc.modeOverride,
          caseVersion: doc.version,
        }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        error?: string;
        echo?: unknown;
      } & Partial<ChartRuleAnalysis>;
      if (!res.ok || !data.ok) {
        setError(data.error ?? "Analyze failed");
        setAnalysis(null);
        return;
      }
      const { ok: _o, echo: _e, error: _err, ...rest } = data;
      setAnalysis(rest as ChartRuleAnalysis);
    } catch {
      setError("Network error");
      setAnalysis(null);
    } finally {
      setLoading(false);
    }
  }, [doc, caseId]);

  useEffect(() => {
    if (!liveAssist || !doc || !caseId) {
      if (liveTimerRef.current) {
        clearInterval(liveTimerRef.current);
        liveTimerRef.current = null;
      }
      return;
    }
    liveTimerRef.current = setInterval(() => {
      void runAnalyze();
    }, 4000);
    return () => {
      if (liveTimerRef.current) clearInterval(liveTimerRef.current);
    };
  }, [liveAssist, doc, caseId, runAnalyze]);

  const onSend = () => {
    if (!doc || !composer.trim()) return;
    const next = appendTimelineEntry(doc, composer);
    persist(next);
    setComposer("");
  };

  const onClearCase = () => {
    const id = crypto.randomUUID();
    router.replace(`/admin/chart-assist-lab?case=${id}`, { scroll: false });
    const fresh = ensureCaseInStore(store, id);
    setCaseId(id);
    setDoc(fresh);
    setAnalysis(null);
    setComposer("");
    setError(null);
  };

  const updateWorkspace = (id: WorkspaceSectionId, text: string) => {
    if (!doc) return;
    const now = new Date().toISOString();
    persist({
      ...doc,
      version: doc.version + 1,
      updatedAt: now,
      workspace: { ...doc.workspace, [id]: text },
    });
  };

  const setModeOverride = (mode: AssistMode | null) => {
    if (!doc) return;
    const now = new Date().toISOString();
    persist({
      ...doc,
      version: doc.version + 1,
      updatedAt: now,
      modeOverride: mode,
    });
  };

  const recentIds = store.listRecentIds(8);

  const displayMode = analysis?.mode ?? doc?.modeOverride ?? "OPD";
  const wsOrder = workspaceOrderForMode(displayMode);

  if (!doc || !caseId) {
    return (
      <div className="min-h-screen bg-slate-950 p-8 text-slate-400">
        Loading case…
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#070b12] text-slate-100">
      <header className="border-b border-white/10 bg-[#081120] px-4 py-3">
        <div className="mx-auto flex max-w-[1800px] flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="rounded bg-amber-500/20 px-2 py-0.5 font-medium text-amber-100">
                Admin Lab
              </span>
              <span className="rounded bg-violet-500/20 px-2 py-0.5 text-violet-100">
                Experimental
              </span>
              <span className="rounded bg-slate-500/20 px-2 py-0.5 text-slate-300">
                Not for public release
              </span>
            </div>
            <p className="mt-1 text-[11px] text-slate-500">
              Rule engine only (no LLM). Not a substitute for clinical judgment or licensure.
            </p>
          </div>
          <Link
            href="/admin"
            className="text-xs text-slate-400 underline-offset-2 hover:text-white hover:underline"
          >
            ← Admin
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-[1800px] px-3 py-4 md:px-4">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-12 lg:gap-5">
          {/* LEFT — timeline + composer */}
          <section className="lg:col-span-4">
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
              <div className="text-xs font-semibold text-slate-300">Case & timeline</div>
              <p className="mt-1 font-mono text-[10px] text-slate-500 break-all">{caseId}</p>
              <label className="mt-3 block text-[11px] text-slate-400">Mode override</label>
              <select
                className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-2 py-2 text-sm"
                value={doc.modeOverride ?? ""}
                onChange={(e) => {
                  const v = e.target.value;
                  setModeOverride(v === "" ? null : (v as AssistMode));
                }}
              >
                <option value="">Auto (detect)</option>
                {MODE_OPTIONS.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
              <div className="mt-3 flex items-center gap-2">
                <input
                  type="checkbox"
                  id="live"
                  checked={liveAssist}
                  onChange={(e) => setLiveAssist(e.target.checked)}
                  className="rounded border-white/20"
                />
                <label htmlFor="live" className="text-xs text-slate-400">
                  Live assist (re-analyze every 4s)
                </label>
              </div>
              <textarea
                className="mt-3 min-h-[100px] w-full rounded-lg border border-white/10 bg-black/30 p-3 text-sm"
                placeholder="Paste line / dictation — append to timeline"
                value={composer}
                onChange={(e) => setComposer(e.target.value)}
                spellCheck={false}
              />
              <div className="mt-2 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={onSend}
                  disabled={!composer.trim()}
                  className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-40"
                >
                  Send
                </button>
                <button
                  type="button"
                  onClick={() => void runAnalyze()}
                  disabled={loading}
                  className="rounded-lg bg-slate-600 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-40"
                >
                  {loading ? "Analyzing…" : "Analyze now"}
                </button>
                <button
                  type="button"
                  onClick={onClearCase}
                  className="rounded-lg border border-white/15 px-3 py-1.5 text-xs text-slate-300"
                >
                  New case
                </button>
              </div>
              <div className="mt-4 max-h-[280px] space-y-2 overflow-y-auto text-xs">
                {doc.timeline.length === 0 ? (
                  <p className="text-slate-500">No entries yet.</p>
                ) : (
                  doc.timeline.map((e) => (
                    <div
                      key={e.entryId}
                      className="rounded border border-white/5 bg-black/20 px-2 py-1.5 text-slate-300"
                    >
                      <div className="text-[10px] text-slate-500">{e.at}</div>
                      <div className="whitespace-pre-wrap">{e.payload.text}</div>
                    </div>
                  ))
                )}
              </div>
              {recentIds.length > 0 ? (
                <div className="mt-4 border-t border-white/10 pt-3">
                  <div className="text-[11px] font-medium text-slate-500">Recent cases</div>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {recentIds.map((id) => (
                      <button
                        key={id}
                        type="button"
                        title={id}
                        onClick={() => router.push(`/admin/chart-assist-lab?case=${id}`)}
                        className="max-w-[140px] truncate rounded bg-white/5 px-2 py-0.5 font-mono text-[10px] text-slate-400 hover:bg-white/10"
                      >
                        {id.slice(0, 8)}…
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          </section>

          {/* CENTER — workspace */}
          <section className="lg:col-span-5">
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
              <div className="text-xs font-semibold text-slate-300">Clinical workspace</div>
              <p className="mt-1 text-[11px] text-slate-500">
                Persisted with case (local). Raw text for rules = timeline below (not these fields).
              </p>
              <div className="mt-3 space-y-3">
                {wsOrder.map((sid) => (
                  <label key={sid} className="block">
                    <span className="text-[11px] text-slate-400">{labelForSection(sid)}</span>
                    <textarea
                      className="mt-1 min-h-[56px] w-full rounded-lg border border-white/10 bg-black/30 p-2 text-sm"
                      value={doc.workspace[sid] ?? ""}
                      onChange={(e) => updateWorkspace(sid, e.target.value)}
                      spellCheck={false}
                    />
                  </label>
                ))}
              </div>
            </div>
          </section>

          {/* RIGHT — rule output */}
          <section className="lg:col-span-3">
            <div className="space-y-4">
              <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
                <div className="text-xs font-semibold text-slate-300">Rule engine</div>
                {error ? <p className="mt-2 text-xs text-red-400">{error}</p> : null}
                {!analysis && !loading ? (
                  <p className="mt-2 text-xs text-slate-500">Run Analyze to load ABCD/ABCDE + cards.</p>
                ) : null}
                {analysis ? (
                  <div className="mt-2 space-y-2 text-xs">
                    <p>
                      <span className="text-slate-500">Mode:</span>{" "}
                      <span className="font-medium text-emerald-300">{analysis.mode}</span>{" "}
                      <span className="text-slate-500">({analysis.visitModeReason})</span>
                    </p>
                    <p>
                      <span className="text-slate-500">Urgency:</span>{" "}
                      <span className="text-slate-200">{analysis.urgency}</span>
                    </p>
                    <p className="text-[10px] text-slate-500">v{analysis.ruleVersion}</p>
                  </div>
                ) : null}
              </div>

              {analysis ? (
                <>
                  <div className="rounded-xl border border-cyan-500/20 bg-cyan-500/5 p-4">
                    <div className="text-xs font-semibold text-cyan-200">
                      Safety — {analysis.safetySweep.framework}
                    </div>
                    <ul className="mt-2 space-y-2 text-[11px] text-slate-300">
                      {analysis.safetySweep.items.map((item) => (
                        <li key={item.label}>
                          <span className="font-bold text-cyan-100">{item.label}</span>
                          {item.redFlags?.length ? (
                            <span className="ml-1 text-red-300">({item.redFlags.join(" · ")})</span>
                          ) : null}
                          <div className="text-slate-500">
                            {item.missing.length ? `Missing: ${item.missing.join("; ")}` : "Documented"}
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="rounded-xl border border-slate-500/20 p-4">
                    <div className="text-xs font-semibold text-slate-300">Disease cards</div>
                    {analysis.diseaseCards.length === 0 ? (
                      <p className="mt-2 text-xs text-slate-500">No starter cards for this text.</p>
                    ) : (
                      <ul className="mt-2 space-y-3">
                        {analysis.diseaseCards.map((c) => (
                          <li key={c.id} className="rounded border border-white/5 bg-black/20 p-2 text-[11px]">
                            <div className="font-medium text-slate-200">{c.label}</div>
                            <div className="text-slate-500">{c.severity}</div>
                            {c.whyShown.length ? (
                              <div className="mt-1 text-slate-400">{c.whyShown.join(" · ")}</div>
                            ) : null}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  <div className="rounded-xl border border-indigo-500/20 bg-indigo-500/5 p-4">
                    <div className="text-xs font-semibold text-indigo-200">Medication (gated)</div>
                    <ul className="mt-2 list-inside list-disc text-[11px] text-slate-300">
                      {analysis.medicationDraft.lines.map((l) => (
                        <li key={l}>{l}</li>
                      ))}
                    </ul>
                  </div>

                  <div className="rounded-xl border border-white/10 p-4">
                    <div className="text-xs font-semibold text-slate-300">References</div>
                    <ul className="mt-2 space-y-2 text-[11px]">
                      {analysis.referenceHints.map((r) => (
                        <li key={r.id}>
                          <a
                            href={r.url}
                            target="_blank"
                            rel="noreferrer"
                            className="text-sky-400 hover:underline"
                          >
                            {r.shortLabel}
                          </a>
                          <span
                            className={
                              r.region === "THAI"
                                ? "ml-1 rounded bg-emerald-500/20 px-1 text-[10px] text-emerald-200"
                                : "ml-1 rounded bg-amber-500/20 px-1 text-[10px] text-amber-100"
                            }
                          >
                            {r.region === "THAI" ? "THAI" : "INTL fallback"}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="rounded-xl border border-white/10 p-4">
                    <div className="text-xs font-semibold text-slate-300">Guideline hints</div>
                    <ul className="mt-2 space-y-2 text-[11px] text-slate-300">
                      {analysis.guidelineHints.map((h) => (
                        <li key={h.id}>
                          <div>{h.text}</div>
                        </li>
                      ))}
                    </ul>
                  </div>
                </>
              ) : null}
            </div>
          </section>
        </div>

        <div className="mt-6 rounded-lg border border-dashed border-white/10 p-3 text-center text-[10px] text-slate-600">
          Rule input text ({timelinePlainText(doc.timeline).length} chars from timeline)
        </div>
      </div>
    </div>
  );
}
