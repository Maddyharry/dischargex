"use client";

import type { OpdChatMessage } from "@/lib/chartAssist/opdAssistTypes";
import type { MissingDataStrip } from "@/lib/chartAssist/opdAssistMissingStrip";
import { formatMissingDataStripLines } from "@/lib/chartAssist/opdAssistMissingStrip";
import type { AssistMode } from "@/lib/chartAssist/cardTypes";

type Props = {
  modeOverride: AssistMode | null;
  modeOptions: AssistMode[];
  modeLabels: Record<AssistMode, string>;
  onModeChange: (m: AssistMode | null) => void;
  composerText: string;
  onComposerChange: (v: string) => void;
  messages: OpdChatMessage[];
  onSend: () => void;
  onClearCase: () => void;
  loading: boolean;
  error: string | null;
  /** Latest missing-data strip (after last analyze) */
  missingStrip: MissingDataStrip;
  /** One-line global status (dirty order, etc.) */
  globalStatusLine: string | null;
  problemOrderOutOfSync: boolean;
  demos: { key: string; label: string; onClick: () => void }[];
  promptStatsLine: string | null;
  showDebug: boolean;
  debugLine: string | null;
};

export default function OpdAssistChatPane({
  modeOverride,
  modeOptions,
  modeLabels,
  onModeChange,
  composerText,
  onComposerChange,
  messages,
  onSend,
  onClearCase,
  loading,
  error,
  missingStrip,
  globalStatusLine,
  problemOrderOutOfSync,
  demos,
  promptStatsLine,
  showDebug,
  debugLine,
}: Props) {
  const { missingLine, askLine } = formatMissingDataStripLines(missingStrip);
  const lastAssistant = [...messages].reverse().find((m) => m.role === "assistant");

  return (
    <section className="flex min-h-[50vh] flex-col rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 lg:col-span-5 lg:min-h-[70vh]">
      <div className="flex flex-wrap items-start justify-between gap-2 border-b border-slate-100 pb-3 dark:border-slate-800">
        <div>
          <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">แชทคลินิก</h2>
          <p className="text-[11px] text-slate-500">ข้อความสั้นๆ — ประวัติเต็มส่งวิเคราะห์ทางด้านล่างของกล่อง</p>
        </div>
        {problemOrderOutOfSync ? (
          <span
            className="max-w-[min(100%,280px)] rounded-md border border-amber-300 bg-amber-50 px-2 py-1 text-[10px] font-medium text-amber-950 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100"
            title="Problem order changed locally — not yet applied to server analysis"
          >
            Problem order changed locally — not yet applied to server analysis
          </span>
        ) : null}
      </div>

      {globalStatusLine ? (
        <p className="mt-2 text-[11px] text-slate-600 dark:text-slate-400">{globalStatusLine}</p>
      ) : null}

      <label className="mt-3 text-xs font-medium text-slate-600 dark:text-slate-300">โหมดการดูแล (เลือกได้)</label>
      <select
        className="mt-1 rounded-lg border border-slate-200 bg-white px-2 py-2 text-sm dark:border-slate-600 dark:bg-slate-950"
        value={modeOverride ?? ""}
        onChange={(e) => {
          const v = e.target.value;
          onModeChange(v === "" ? null : (v as AssistMode));
        }}
      >
        <option value="">ตรวจจับอัตโนมัติ</option>
        {modeOptions.map((m) => (
          <option key={m} value={m}>
            {modeLabels[m]}
          </option>
        ))}
      </select>

      <div className="mt-3 min-h-[160px] flex-1 space-y-2 overflow-y-auto rounded-lg border border-slate-100 bg-slate-50/50 p-2 dark:border-slate-800 dark:bg-slate-950/40">
        {messages.length === 0 ? (
          <p className="py-6 text-center text-[12px] text-slate-400">พิมพ์รอบถัดไป แล้วกดส่งวิเคราะห์</p>
        ) : (
          messages.map((m) => (
            <div
              key={m.id}
              className={[
                "max-w-[95%] rounded-lg px-2.5 py-1.5 text-[12px] leading-snug",
                m.role === "user"
                  ? "ml-auto bg-slate-200/90 text-slate-900 dark:bg-slate-700 dark:text-slate-100"
                  : "mr-auto border border-slate-200 bg-white text-slate-800 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100",
              ].join(" ")}
            >
              <pre className="whitespace-pre-wrap font-sans">{m.body}</pre>
            </div>
          ))
        )}
      </div>

      {lastAssistant ? (
        <div className="mt-2 space-y-1 rounded-md border border-slate-200/90 bg-slate-50/80 px-2 py-1.5 text-[10px] text-slate-700 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-300">
          {missingLine ? <div>{missingLine}</div> : null}
          {askLine ? <div>{askLine}</div> : null}
        </div>
      ) : null}

      <label className="mt-3 text-xs font-medium text-slate-600 dark:text-slate-300">รอบนี้ (ต่อท้ายประวัติวิเคราะห์)</label>
      <textarea
        className="mt-1 min-h-[72px] resize-y rounded-lg border border-slate-200 p-2.5 text-sm leading-relaxed text-slate-900 placeholder:text-slate-400 dark:border-slate-600 dark:bg-slate-950 dark:text-slate-100"
        placeholder="พิมพ์ประวัติรอบสั้นๆ — จะต่อเข้าประวัติวิเคราะห์"
        value={composerText}
        onChange={(e) => onComposerChange(e.target.value)}
        spellCheck={false}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
            e.preventDefault();
            onSend();
          }
        }}
      />

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onSend}
          disabled={loading}
          className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white shadow-sm disabled:opacity-50 dark:bg-white dark:text-slate-900"
        >
          {loading ? "กำลังวิเคราะห์…" : "ส่งและวิเคราะห์"}
        </button>
        <button
          type="button"
          onClick={onClearCase}
          className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 dark:border-slate-600 dark:text-slate-200"
        >
          ล้างเคส
        </button>
      </div>

      {promptStatsLine ? (
        <p className="mt-2 text-[10px] leading-snug text-slate-500 dark:text-slate-400">{promptStatsLine}</p>
      ) : null}

      <div className="mt-3 border-t border-slate-100 pt-3 dark:border-slate-800">
        <div className="text-[11px] font-medium text-slate-500">ตัวอย่างเร็ว</div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {demos.map((d) => (
            <button
              key={d.key}
              type="button"
              onClick={d.onClick}
              className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[10px] text-slate-600 transition hover:bg-white dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300"
            >
              {d.label}
            </button>
          ))}
        </div>
      </div>

      {error ? <p className="mt-3 text-xs text-red-600 dark:text-red-400">{error}</p> : null}
      {showDebug && debugLine ? <p className="mt-2 text-[10px] text-slate-400">{debugLine}</p> : null}
    </section>
  );
}
