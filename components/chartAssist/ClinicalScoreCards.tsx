"use client";

import { useMemo } from "react";
import {
  CLINICAL_SCORE_BY_ID,
  evaluateClinicalScore,
  fieldLabel,
  type ClinicalScoreDefinition,
} from "@/lib/chartAssist/clinicalScores";
import type { ClinicalScoreComputed } from "@/lib/chartAssist/clinicalScores";
import PhysicianReferenceBlock from "./PhysicianReferenceBlock";

const SCORE_NA = "ไม่เกี่ยวข้อง / ไม่ใช้คะแนนนี้";

function formatComputed(c: ClinicalScoreComputed): string {
  if (c.kind === "numeric") return `รวม ${c.total}`;
  if (c.kind === "graded") return `เกรด ${c.grade} — ${c.gradeLabel}`;
  return c.lines.map((l) => `${l.label}: ${l.value}`).join(" · ");
}

type ClinicalScoreCardProps = {
  def: ClinicalScoreDefinition;
  raw: Record<string, unknown>;
  markedNa: boolean;
  activePackIds: Set<string>;
  onChange: (fieldId: string, value: unknown) => void;
  onMarkedNa: (v: boolean) => void;
};

function ClinicalScoreCard({ def, raw, markedNa, activePackIds, onChange, onMarkedNa }: ClinicalScoreCardProps) {
  const ev = useMemo(
    () => evaluateClinicalScore(def, raw, { activePackIds, markedNa }),
    [def, raw, activePackIds, markedNa]
  );

  const stateBadge =
    ev.state === "ready"
      ? "bg-emerald-100 text-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-200"
      : ev.state === "incomplete"
        ? "bg-amber-100 text-amber-900 dark:bg-amber-950/50 dark:text-amber-200"
        : "bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200";

  const stateLabel =
    ev.state === "ready" ? "ready" : ev.state === "incomplete" ? "incomplete" : "not_applicable";

  return (
    <div className="mt-2 rounded-md border border-violet-200/80 bg-violet-50/60 px-2 py-2 dark:border-violet-800/50 dark:bg-violet-950/25">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-[11px] font-semibold text-violet-950 dark:text-violet-100">{def.label}</div>
        <span className={`rounded px-1.5 py-0.5 text-[9px] font-semibold uppercase ${stateBadge}`}>{stateLabel}</span>
      </div>
      <label className="mt-1.5 flex cursor-pointer items-center gap-2 text-[10px] text-violet-900/90 dark:text-violet-200/90">
        <input
          type="checkbox"
          checked={markedNa}
          onChange={(e) => onMarkedNa(e.target.checked)}
          className="rounded border-violet-400"
        />
        {SCORE_NA}
      </label>

      {markedNa ? (
        <p className="mt-1 text-[10px] text-violet-800/80 dark:text-violet-300/80">ไม่คำนวณคะแนนตามที่เลือก</p>
      ) : null}

      {!markedNa ? (
        <div className="mt-2 space-y-2">
          {[...def.requiredFields, ...def.optionalFields].map((f) => {
            const opt = def.optionalFields.some((o) => o.id === f.id);
            const val = raw[f.id];
            if (f.kind === "boolean") {
              const sval =
                val === true || val === "true" ? "true" : val === false || val === "false" ? "false" : "";
              return (
                <label key={f.id} className="block text-[10px] text-violet-950 dark:text-violet-100">
                  <span className="font-medium">
                    {f.label}
                    {opt ? " (optional)" : " *"}
                  </span>
                  <select
                    className="mt-0.5 w-full rounded border border-violet-200/90 bg-white px-1.5 py-1 text-[11px] dark:border-violet-700 dark:bg-slate-900"
                    value={sval}
                    onChange={(e) => {
                      const v = e.target.value;
                      if (v === "") onChange(f.id, "");
                      else onChange(f.id, v === "true");
                    }}
                  >
                    <option value="">—</option>
                    <option value="false">No</option>
                    <option value="true">Yes</option>
                  </select>
                  {f.helpText ? <span className="mt-0.5 block text-[9px] text-violet-700/90">{f.helpText}</span> : null}
                </label>
              );
            }
            if (f.kind === "select") {
              return (
                <label key={f.id} className="block text-[10px] text-violet-950 dark:text-violet-100">
                  <span className="font-medium">
                    {f.label}
                    {opt ? " (optional)" : " *"}
                  </span>
                  <select
                    className="mt-0.5 w-full rounded border border-violet-200/90 bg-white px-1.5 py-1 text-[11px] dark:border-violet-700 dark:bg-slate-900"
                    value={val === undefined || val === null ? "" : String(val)}
                    onChange={(e) => onChange(f.id, e.target.value)}
                  >
                    <option value="">—</option>
                    {f.options?.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </label>
              );
            }
            return (
              <label key={f.id} className="block text-[10px] text-violet-950 dark:text-violet-100">
                <span className="font-medium">
                  {f.label}
                  {opt ? " (optional)" : " *"}
                </span>
                <input
                  type="number"
                  min={f.min}
                  max={f.max}
                  step={f.step ?? 1}
                  className="mt-0.5 w-full rounded border border-violet-200/90 bg-white px-1.5 py-1 text-[11px] dark:border-violet-700 dark:bg-slate-900"
                  value={typeof val === "number" && !Number.isNaN(val) ? val : ""}
                  onChange={(e) => {
                    const t = e.target.value;
                    onChange(f.id, t === "" ? "" : Number(t));
                  }}
                />
              </label>
            );
          })}
        </div>
      ) : null}

      {ev.state === "incomplete" && !markedNa ? (
        <p className="mt-2 text-[10px] text-amber-900 dark:text-amber-200/95">
          ยังขาด: {ev.missingFieldIds.map((id) => fieldLabel(def, id)).join(", ")}
        </p>
      ) : null}

      {ev.state === "ready" && ev.computed && ev.interpretation ? (
        <div className="mt-2 rounded border border-emerald-200/80 bg-emerald-50/70 px-2 py-1.5 dark:border-emerald-800/50 dark:bg-emerald-950/30">
          <div className="text-[11px] font-semibold text-emerald-950 dark:text-emerald-100">{formatComputed(ev.computed)}</div>
          <p className="mt-1 text-[10px] leading-relaxed text-emerald-900/95 dark:text-emerald-200/95">{ev.interpretation}</p>
        </div>
      ) : null}

      {def.referenceIds.length ? (
        <div className="mt-2">
          <PhysicianReferenceBlock sourceIds={[...def.referenceIds]} contextLabel="Score" />
        </div>
      ) : null}
    </div>
  );
}

type PackScoreRowProps = {
  scoreIds: string[];
  scoreInputs: Record<string, Record<string, unknown>>;
  scoreMarkedNa: Record<string, boolean>;
  activePackIds: Set<string>;
  setScoreField: (scoreId: string, fieldId: string, value: unknown) => void;
  setScoreMarkedNa: (scoreId: string, v: boolean) => void;
};

export function ClinicalScoreCardsForPack({
  scoreIds,
  scoreInputs,
  scoreMarkedNa,
  activePackIds,
  setScoreField,
  setScoreMarkedNa,
}: PackScoreRowProps) {
  if (!scoreIds.length) return null;
  return (
    <div className="mt-2 space-y-1">
      <div className="text-[9px] font-semibold uppercase tracking-wide text-violet-800/90 dark:text-violet-300/90">
        Clinical scores (structured)
      </div>
      {scoreIds.map((id) => {
        const def = CLINICAL_SCORE_BY_ID[id];
        if (!def) return null;
        return (
          <ClinicalScoreCard
            key={id}
            def={def}
            raw={scoreInputs[id] ?? {}}
            markedNa={!!scoreMarkedNa[id]}
            activePackIds={activePackIds}
            onChange={(fieldId, value) => setScoreField(id, fieldId, value)}
            onMarkedNa={(v) => setScoreMarkedNa(id, v)}
          />
        );
      })}
    </div>
  );
}
