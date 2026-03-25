import type { SafetySweep } from "@/lib/chartAssist/cardTypes";

export default function SafetyCard({ sweep }: { sweep: SafetySweep }) {
  return (
    <div className="space-y-2 rounded-xl border border-zinc-200 p-3 text-sm dark:border-zinc-700">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">Safety</span>
        <span className="rounded bg-zinc-100 px-2 py-0.5 text-[10px] font-medium text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
          {sweep.framework}
        </span>
      </div>
      <div className="space-y-2">
        {sweep.items.map((item) => (
          <details
            key={item.label}
            className="rounded-lg border border-zinc-100 dark:border-zinc-800"
          >
            <summary className="cursor-pointer px-2 py-1 text-xs font-medium text-zinc-800 dark:text-zinc-200">
              {item.label}
            </summary>
            <div className="space-y-1 border-t border-zinc-100 px-2 py-2 text-xs dark:border-zinc-800">
              {item.documented.length > 0 ? (
                <div>
                  <span className="font-medium text-emerald-700 dark:text-emerald-400">Doc: </span>
                  {item.documented.join(" · ")}
                </div>
              ) : null}
              {item.missing.length > 0 ? (
                <div>
                  <span className="font-medium text-amber-800 dark:text-amber-300">Missing: </span>
                  {item.missing.join(" · ")}
                </div>
              ) : null}
              {item.checkNext.length > 0 ? (
                <ul className="list-inside list-disc text-zinc-600 dark:text-zinc-400">
                  {item.checkNext.map((c, i) => (
                    <li key={i}>{c}</li>
                  ))}
                </ul>
              ) : null}
              {item.redFlags.length > 0 ? (
                <div className="text-rose-700 dark:text-rose-400">{item.redFlags.join(" · ")}</div>
              ) : null}
            </div>
          </details>
        ))}
      </div>
    </div>
  );
}
