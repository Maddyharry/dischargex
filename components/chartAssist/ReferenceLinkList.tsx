import { getReferencesByIds } from "@/lib/chartAssist/referenceCatalog";
import type { ReferenceSource } from "@/lib/chartAssist/referenceCatalog";
import OpenSourceButton from "./OpenSourceButton";

type ReferenceLinkListProps = {
  sourceIds: string[];
  inlineTopThai?: boolean;
  collapsible?: boolean;
};

function sourceTypeLabel(sourceType: string) {
  if (sourceType === "direct-clinical-rule") return "Direct rule";
  if (sourceType === "topic-index") return "Topic index";
  return "Supporting";
}

function sortThaiByPriority(refs: ReferenceSource[]) {
  return [...refs].sort((a, b) => a.priority - b.priority);
}

export default function ReferenceLinkList({
  sourceIds,
  inlineTopThai = true,
  collapsible = true,
}: ReferenceLinkListProps) {
  const refs = getReferencesByIds(sourceIds);
  const thaiRefs = sortThaiByPriority(refs.filter((r) => r.region === "THAI"));
  const intlRefs = sortThaiByPriority(refs.filter((r) => r.region === "INTL"));

  const topThai =
    inlineTopThai
      ? thaiRefs.find((r) => r.priority === 1) ?? thaiRefs[0] ?? null
      : null;
  const remainingThai = topThai
    ? thaiRefs.filter((r) => r.id !== topThai.id)
    : thaiRefs;
  const remaining = [...remainingThai, ...intlRefs];

  return (
    <div className="space-y-2">
      {inlineTopThai && topThai ? (
        <div className="rounded-lg border border-zinc-200 p-2 dark:border-zinc-700">
          <div className="mb-1 flex items-center gap-2">
            <span className="rounded bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200">
              THAI
            </span>
            <span className="rounded bg-zinc-100 px-2 py-0.5 text-[10px] font-semibold text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200">
              {sourceTypeLabel(topThai.sourceType)}
            </span>
          </div>

          <div className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{topThai.shortLabel}</div>
          {topThai.notes ? (
            <div className="mt-1 line-clamp-2 text-xs text-zinc-600 dark:text-zinc-400">
              {topThai.notes}
            </div>
          ) : null}

          <div className="mt-2">
            <OpenSourceButton url={topThai.url} label="Read source" />
          </div>
        </div>
      ) : null}

      {remaining.length > 0 ? (
        collapsible ? (
          <details className="rounded-lg border border-zinc-200 p-2 dark:border-zinc-700">
            <summary className="cursor-pointer text-xs font-medium text-zinc-700 dark:text-zinc-300">
              More references ({remaining.length})
            </summary>
            <div className="mt-2 space-y-2">
              {remaining.map((ref) => (
                <div key={ref.id} className="rounded-md border border-zinc-200 p-2 dark:border-zinc-600">
                  <div className="mb-1 flex flex-wrap items-center gap-2">
                    <span
                      className={[
                        "rounded px-2 py-0.5 text-[10px] font-semibold",
                        ref.region === "THAI"
                          ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200"
                          : "bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-100",
                      ].join(" ")}
                    >
                      {ref.region === "THAI" ? "THAI" : "INTL fallback"}
                    </span>
                    <span className="rounded bg-zinc-100 px-2 py-0.5 text-[10px] font-semibold text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200">
                      {sourceTypeLabel(ref.sourceType)}
                    </span>
                  </div>

                  <div className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{ref.shortLabel}</div>
                  {ref.notes ? (
                    <div className="mt-1 line-clamp-2 text-xs text-zinc-600 dark:text-zinc-400">
                      {ref.notes}
                    </div>
                  ) : null}

                  <div className="mt-2">
                    <OpenSourceButton url={ref.url} />
                  </div>
                </div>
              ))}
            </div>
          </details>
        ) : (
          <div className="space-y-2">
            {remaining.map((ref) => (
              <div key={ref.id} className="rounded-md border border-zinc-200 p-2 dark:border-zinc-600">
                <div className="mb-1 flex flex-wrap items-center gap-2">
                  <span
                    className={[
                      "rounded px-2 py-0.5 text-[10px] font-semibold",
                      ref.region === "THAI"
                        ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200"
                        : "bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-100",
                    ].join(" ")}
                  >
                    {ref.region === "THAI" ? "THAI" : "INTL fallback"}
                  </span>
                  <span className="rounded bg-zinc-100 px-2 py-0.5 text-[10px] font-semibold text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200">
                    {sourceTypeLabel(ref.sourceType)}
                  </span>
                </div>

                <div className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{ref.shortLabel}</div>
                {ref.notes ? (
                  <div className="mt-1 line-clamp-2 text-xs text-zinc-600 dark:text-zinc-400">
                    {ref.notes}
                  </div>
                ) : null}

                <div className="mt-2">
                  <OpenSourceButton url={ref.url} />
                </div>
              </div>
            ))}
          </div>
        )
      ) : null}
    </div>
  );
}
