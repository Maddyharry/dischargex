import { getReferencesByIds } from "@/lib/chartAssist/referenceCatalog";
import OpenSourceButton from "./OpenSourceButton";

type CardHeaderProps = {
  label: string;
  severity: "info" | "warn" | "urgent";
  sourceIds: string[];
};

function severityClasses(severity: "info" | "warn" | "urgent") {
  if (severity === "urgent") return "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200";
  if (severity === "warn") return "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200";
  return "bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-200";
}

export default function CardHeader({
  label,
  severity,
  sourceIds,
}: CardHeaderProps) {
  const refs = getReferencesByIds(sourceIds);
  const thaiSorted = [...refs.filter((r) => r.region === "THAI")].sort(
    (a, b) => a.priority - b.priority
  );
  const topThai =
    thaiSorted.find((r) => r.priority === 1) ?? thaiSorted[0] ?? null;

  return (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{label}</h3>
          <span
            className={`rounded px-2 py-0.5 text-[10px] font-semibold ${severityClasses(severity)}`}
          >
            {severity}
          </span>
          <span className="rounded bg-zinc-100 px-2 py-0.5 text-[10px] font-semibold text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200">
            {sourceIds.length} source{sourceIds.length !== 1 ? "s" : ""}
          </span>
        </div>

        {topThai ? (
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-zinc-600 dark:text-zinc-400">
            <span className="rounded bg-emerald-100 px-2 py-0.5 font-semibold text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200">
              THAI
            </span>
            <span>{topThai.shortLabel}</span>
          </div>
        ) : null}
      </div>

      {topThai ? <OpenSourceButton url={topThai.url} label="Read source" /> : null}
    </div>
  );
}
