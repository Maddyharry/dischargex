"use client";

import { useCallback, useEffect, useLayoutEffect, useState } from "react";
import type { RefObject } from "react";
import {
  WORKSPACE_COACH_COPY,
  type WorkspaceCoachPhase,
} from "@/app/components/WorkspaceTutorialFloating";

type HoleRect = { top: number; left: number; width: number; height: number };

export function WorkspaceTutorialOverlay({
  active,
  targetRef,
  phase,
  onSkipToPaste,
  onSkipToGenerate,
  stepIndex,
  stepTotal,
}: {
  active: boolean;
  targetRef: RefObject<HTMLElement | null>;
  phase: WorkspaceCoachPhase;
  onSkipToPaste: () => void;
  onSkipToGenerate: () => void;
  stepIndex: number;
  stepTotal: number;
}) {
  const [hole, setHole] = useState<HoleRect | null>(null);

  const measure = useCallback(() => {
    if (!active) {
      setHole(null);
      return;
    }
    const el = targetRef.current;
    if (!el) {
      setHole(null);
      return;
    }
    const r = el.getBoundingClientRect();
    const pad = 12;
    setHole({
      top: Math.max(0, r.top - pad),
      left: Math.max(0, r.left - pad),
      width: r.width + pad * 2,
      height: r.height + pad * 2,
    });
  }, [active, targetRef]);

  useLayoutEffect(() => {
    measure();
  }, [measure, phase]);

  useLayoutEffect(() => {
    if (!active) return;
    const id = requestAnimationFrame(measure);
    return () => cancelAnimationFrame(id);
  }, [active, measure]);

  useEffect(() => {
    if (!active) return;
    window.addEventListener("scroll", measure, true);
    window.addEventListener("resize", measure);
    return () => {
      window.removeEventListener("scroll", measure, true);
      window.removeEventListener("resize", measure);
    };
  }, [active, measure]);

  if (!active || typeof window === "undefined") return null;

  const vw = window.innerWidth;
  const vh = window.innerHeight;

  const c = WORKSPACE_COACH_COPY[phase];

  if (!hole) {
    return (
      <div
        className="pointer-events-none fixed inset-0 z-[90] bg-black/75 backdrop-blur-[1px]"
        aria-hidden
      />
    );
  }

  const { top, left, width, height } = hole;
  const t = top;
  const l = left;
  const w = width;
  const h = height;

  const topH = Math.max(0, t);
  const bottomTop = t + h;
  const bottomH = Math.max(0, vh - bottomTop);
  const leftW = Math.max(0, l);
  const rightLeft = l + w;
  const rightW = Math.max(0, vw - rightLeft);

  const panelClass =
    "fixed z-[90] bg-black/80 backdrop-blur-[2px] pointer-events-auto";

  return (
    <div
      className="pointer-events-none fixed inset-0 z-[90]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="ws-overlay-title"
    >
      {/* แผงมืดทั้งจอแบบเจาะช่อง (spotlight) */}
      <div className={panelClass} style={{ top: 0, left: 0, width: vw, height: topH }} />
      <div
        className={panelClass}
        style={{ top: bottomTop, left: 0, width: vw, height: bottomH }}
      />
      <div className={panelClass} style={{ top: t, left: 0, width: leftW, height: h }} />
      <div
        className={panelClass}
        style={{ top: t, left: rightLeft, width: rightW, height: h }}
      />

      {/* ขอบเรืองรอบจุดโฟกัส */}
      <div
        className="pointer-events-none fixed z-[91] rounded-[1.25rem] border-2 border-cyan-400 shadow-[0_0_0_4px_rgba(34,211,238,0.25),0_0_32px_rgba(34,211,238,0.35)]"
        style={{
          top: t,
          left: l,
          width: w,
          height: h,
        }}
      />

      {/* การ์ดคำแนะนำด้านล่าง — อ่านง่าย ไม่บังช่อง */}
      <div className="pointer-events-auto fixed bottom-0 left-0 right-0 z-[100] flex justify-center p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <div className="w-full max-w-lg rounded-2xl border border-cyan-500/40 bg-gradient-to-br from-slate-950/98 via-[#0c1728]/98 to-slate-950/98 px-4 py-4 shadow-[0_-8px_40px_rgba(0,0,0,0.6)] backdrop-blur-md ring-1 ring-cyan-500/20">
          <div className="flex items-center justify-between gap-2">
            <span className="rounded-full bg-cyan-500/20 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-cyan-200">
              ขั้นตอน {stepIndex}/{stepTotal}
            </span>
            <span className="text-[10px] font-medium text-slate-500">{c.stepLabel}</span>
          </div>
          <h2 id="ws-overlay-title" className="mt-2 text-base font-semibold text-white">
            {c.title}
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-slate-300">{c.body}</p>
          <p className="mt-2 rounded-lg border border-cyan-500/25 bg-cyan-950/35 px-3 py-2 text-xs text-cyan-100/95">
            <span className="font-semibold text-cyan-400">ชี้ไปที่:</span> {c.target}
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-slate-700/60 pt-3">
            {phase === "workspace_click" ? (
              <button
                type="button"
                onClick={onSkipToPaste}
                className="rounded-xl border border-slate-600 bg-slate-900/90 px-3 py-2 text-xs font-medium text-slate-200 hover:bg-slate-800"
              >
                ข้ามไปขั้นวาง
              </button>
            ) : null}
            {phase === "workspace_paste" ? (
              <button
                type="button"
                onClick={onSkipToGenerate}
                className="rounded-xl border border-slate-600 bg-slate-900/90 px-3 py-2 text-xs font-medium text-slate-200 hover:bg-slate-800"
              >
                ข้ามไปขั้นสร้างสรุป
              </button>
            ) : null}
            <span className="ml-auto text-[10px] text-slate-500">
              คลิกในช่องที่ไฮไลต์ได้ — พื้นที่มืดบังคลิกนอกโฟกัส
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
