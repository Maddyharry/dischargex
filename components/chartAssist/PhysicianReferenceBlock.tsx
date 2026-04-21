"use client";

import { getReferencesByIds } from "@/lib/chartAssist/referenceCatalog";
import type { ReferenceSource } from "@/lib/chartAssist/referenceCatalog";
import OpenSourceButton from "./OpenSourceButton";

type PhysicianReferenceBlockProps = {
  sourceIds: string[];
  /** Optional section label (not shown in collapsed summary to save space) */
  contextLabel?: string;
  className?: string;
};

function sortRefs(refs: ReferenceSource[]) {
  return [...refs].sort((a, b) => {
    if (a.region !== b.region) return a.region === "THAI" ? -1 : 1;
    return a.priority - b.priority;
  });
}

function compactRefLine(r: ReferenceSource): string {
  const bits = [r.shortLabel];
  if (r.publisher) bits.push(r.publisher);
  if (r.sourceDate) bits.push(r.sourceDate);
  return bits.join(" · ");
}

const WHY_TEXT =
  "Suggestions follow structured triage and documentation patterns aligned with these guideline or official sources for traceability. The rule layer does not replace local hospital protocol or physician judgment.";

export default function PhysicianReferenceBlock({
  sourceIds,
  contextLabel,
  className = "",
}: PhysicianReferenceBlockProps) {
  if (!sourceIds.length) return null;

  const refs = sortRefs(getReferencesByIds(sourceIds));
  if (!refs.length) return null;

  const preview = refs.slice(0, 2).map((r) => compactRefLine(r)).join(" · ");
  const more = refs.length > 2 ? ` +${refs.length - 2}` : "";

  return (
    <details
      className={[
        "group mt-2 border-t border-slate-200/90 pt-2 dark:border-slate-700/90",
        className,
      ].join(" ")}
    >
      <summary className="cursor-pointer list-none text-[10px] text-slate-500 dark:text-slate-400 [&::-webkit-details-marker]:hidden">
        <span className="inline-flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
          <span className="font-medium text-slate-600 dark:text-slate-300">
            References ({refs.length})
          </span>
          <span className="truncate text-slate-500 dark:text-slate-400" title={refs.map((r) => r.title).join(" · ")}>
            {preview}
            {more}
          </span>
          <span className="text-slate-400 group-open:hidden dark:text-slate-500">▸</span>
          <span className="hidden text-slate-400 group-open:inline dark:text-slate-500">▾</span>
        </span>
      </summary>

      {contextLabel ? (
        <p className="mt-1.5 text-[10px] font-medium text-slate-600 dark:text-slate-400">{contextLabel}</p>
      ) : null}

      <ul className="mt-1.5 max-h-28 space-y-1 overflow-y-auto text-[10px] leading-snug text-slate-700 dark:text-slate-300">
        {refs.map((r) => (
          <li
            key={r.id}
            className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5"
            title={[r.title, r.publisher, r.sourceDate].filter(Boolean).join(" · ")}
          >
            <span className="shrink-0 rounded bg-slate-100 px-1 py-px text-[9px] font-semibold uppercase text-slate-600 dark:bg-slate-800 dark:text-slate-300">
              {r.region}
            </span>
            <span className="min-w-0 font-medium">{r.shortLabel}</span>
            {(r.publisher || r.sourceDate) && (
              <span className="min-w-0 text-slate-500 dark:text-slate-500">
                · {[r.publisher, r.sourceDate].filter(Boolean).join(" · ")}
              </span>
            )}
          </li>
        ))}
      </ul>

      <details className="mt-1.5 rounded-md border border-slate-200/80 bg-slate-50/50 dark:border-slate-700 dark:bg-slate-900/40">
        <summary className="cursor-pointer px-2 py-1 text-[10px] font-medium text-slate-600 dark:text-slate-400">
          Why this suggestion?
        </summary>
        <div className="space-y-2 border-t border-slate-200/80 px-2 pb-2 pt-1.5 dark:border-slate-700">
          <p className="text-[10px] leading-relaxed text-slate-600 dark:text-slate-400">{WHY_TEXT}</p>
          <ul className="space-y-2">
            {refs.map((r) => (
              <li key={`why-${r.id}`} className="text-[10px] text-slate-700 dark:text-slate-300">
                <div className="font-medium text-slate-800 dark:text-slate-100">{r.title}</div>
                {r.publisher || r.sourceDate ? (
                  <p className="mt-0.5 text-[9px] text-slate-500 dark:text-slate-500">
                    {[r.publisher, r.sourceDate].filter(Boolean).join(" · ")}
                  </p>
                ) : null}
                {r.notes ? <p className="mt-0.5 text-slate-600 dark:text-slate-400">{r.notes}</p> : null}
                <div className="mt-1">
                  <OpenSourceButton url={r.url} label="Open guideline" className="py-0.5 text-[10px]" />
                </div>
              </li>
            ))}
          </ul>
        </div>
      </details>
    </details>
  );
}
