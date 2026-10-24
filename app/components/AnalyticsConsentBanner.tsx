"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  ANALYTICS_CONSENT_STORAGE_KEY,
  parseAnalyticsConsent,
  persistAnalyticsConsent,
} from "@/lib/analytics-consent";
import { isSensitiveAnalyticsPath } from "./GoogleTag";
import { clearPendingSafeAnalyticsEvents } from "@/lib/safe-analytics-client";

declare global {
  interface WindowEventMap {
    "dx:analytics-consent-changed": Event;
  }
}

export function saveAnalyticsConsent(analytics: boolean, marketing: boolean): boolean {
  if (typeof window === "undefined" || !persistAnalyticsConsent({
    storage: window.localStorage,
    consent: { analytics, marketing },
    clearPending: clearPendingSafeAnalyticsEvents,
  })) return false;
  window.dispatchEvent(new Event("dx:analytics-consent-changed"));
  return true;
}

export function AnalyticsConsentBanner() {
  const pathname = usePathname() || "/";
  const [ready, setReady] = useState(false);
  const [hasChoice, setHasChoice] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [analytics, setAnalytics] = useState(false);
  const [marketing, setMarketing] = useState(false);

  useEffect(() => {
    try {
      const consent = parseAnalyticsConsent(JSON.parse(window.localStorage.getItem(ANALYTICS_CONSENT_STORAGE_KEY) || "null"));
      if (consent) {
        setAnalytics(consent.analytics);
        setMarketing(consent.marketing);
        setHasChoice(true);
      }
    } catch {
      setHasChoice(false);
    }
    setReady(true);
  }, []);

  if (!ready || isSensitiveAnalyticsPath(pathname)) return null;
  if (hasChoice && !settingsOpen) {
    return (
      <button
        type="button"
        className="fixed bottom-4 left-4 z-[80] rounded-full border border-slate-700 bg-slate-950/90 px-3 py-2 text-xs text-slate-300 shadow-lg hover:text-white"
        onClick={() => setSettingsOpen(true)}
      >
        ตั้งค่าความเป็นส่วนตัว
      </button>
    );
  }

  return (
    <aside
      aria-label="การตั้งค่าความเป็นส่วนตัว"
      className="fixed bottom-4 left-4 z-[80] w-[min(92vw,28rem)] rounded-2xl border border-slate-700 bg-slate-950/95 p-4 text-slate-100 shadow-2xl backdrop-blur"
    >
      <h2 className="text-sm font-semibold">ตั้งค่าความเป็นส่วนตัว</h2>
      <p className="mt-1 text-xs leading-5 text-slate-300">
        เราใช้สถิติการเข้าชมและการตลาดเมื่อคุณอนุญาตเท่านั้น ไม่ส่งข้อความหรือข้อมูลผู้ป่วย
      </p>
      {settingsOpen && (
        <div className="mt-3 space-y-2 text-sm">
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={analytics} onChange={(event) => setAnalytics(event.target.checked)} />
            สถิติการใช้งานเว็บไซต์
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={marketing} onChange={(event) => setMarketing(event.target.checked)} />
            การวัดผลโฆษณา
          </label>
        </div>
      )}
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          className="rounded-lg border border-slate-600 px-3 py-2 text-xs hover:bg-slate-800"
          onClick={() => {
            if (saveAnalyticsConsent(false, false)) setHasChoice(true);
          }}
        >
          ปฏิเสธ
        </button>
        <button
          type="button"
          className="rounded-lg border border-cyan-500/60 px-3 py-2 text-xs text-cyan-200 hover:bg-cyan-950/50"
          onClick={() => setSettingsOpen((open) => !open)}
        >
          {settingsOpen && hasChoice ? "ปิด" : settingsOpen ? "ปิดการตั้งค่า" : "ตั้งค่า"}
        </button>
        {settingsOpen ? (
          <button
            type="button"
            className="rounded-lg bg-cyan-600 px-3 py-2 text-xs font-semibold text-white hover:bg-cyan-500"
            onClick={() => {
              if (saveAnalyticsConsent(analytics, marketing)) {
                setHasChoice(true);
                setSettingsOpen(false);
              }
            }}
          >
            บันทึกการเลือก
          </button>
        ) : (
          <button
            type="button"
            className="rounded-lg bg-cyan-600 px-3 py-2 text-xs font-semibold text-white hover:bg-cyan-500"
            onClick={() => {
              if (saveAnalyticsConsent(true, true)) setHasChoice(true);
            }}
          >
            ยอมรับทั้งหมด
          </button>
        )}
      </div>
    </aside>
  );
}
