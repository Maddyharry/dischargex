"use client";

export function InlineAssistBlock({ title, items }: { title: string; items: string[] }) {
  if (!items.length) return null;
  return (
    <div className="mt-1.5 rounded-lg border border-emerald-200/60 bg-emerald-50/40 px-2.5 py-2 dark:border-emerald-900/40 dark:bg-emerald-950/20">
      <div className="text-[10px] font-semibold uppercase tracking-wide text-emerald-800 dark:text-emerald-300/90">
        {title}
      </div>
      <ul className="mt-1.5 space-y-1">
        {items.map((x, i) => (
          <li
            key={`${i}-${x.slice(0, 32)}`}
            className="flex gap-2 text-[12px] leading-snug text-emerald-950/90 dark:text-emerald-100/90"
          >
            <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-emerald-500/80" />
            <span>{x}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function BulletList({
  items,
  empty,
  urgent,
}: {
  items: string[];
  empty?: string;
  urgent?: boolean;
}) {
  if (!items.length) {
    return <p className="text-sm text-slate-500">{empty ?? "—"}</p>;
  }
  return (
    <ul className="mt-1 space-y-1.5">
      {items.map((x, i) => (
        <li
          key={`${i}-${x.slice(0, 24)}`}
          className={[
            "flex gap-2 text-sm leading-snug text-slate-700 dark:text-slate-300",
            urgent ? "text-red-700 dark:text-red-300" : "",
          ].join(" ")}
        >
          <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-slate-400" />
          <span>{x}</span>
        </li>
      ))}
    </ul>
  );
}
