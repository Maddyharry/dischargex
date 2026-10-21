"use client";

import { useEffect, useRef, useState } from "react";
import styles from "../landing.module.css";

type Impact = {
  available: true;
  completedJobs: number;
  durationAvailable?: boolean;
  averageGenerationSeconds: number | null;
  updatedAt?: string;
};

type State = "loading" | "ready" | "unavailable";

function formatDuration(seconds: number): string {
  const rounded = Math.max(0, Math.round(seconds));
  return `${Math.floor(rounded / 60)} นาที ${rounded % 60} วินาที`;
}

function formatUpdatedAt(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return `ข้อมูลล่าสุด ${date.toLocaleString("th-TH", { timeZone: "Asia/Bangkok" })}`;
}

export function LandingImpactStatsPanel({ state, stats }: { state: State; stats: Impact | null }) {
  const countValue = state === "loading"
    ? "กำลังโหลด…"
    : state === "unavailable" || !stats
      ? "ยังโหลดข้อมูลไม่ได้"
      : <>{stats.completedJobs.toLocaleString("th-TH")} <span>งาน</span></>;
  const durationValue = state === "loading"
    ? "กำลังโหลด…"
    : state === "unavailable" || !stats
      ? "ยังโหลดข้อมูลไม่ได้"
      : stats.averageGenerationSeconds === null
        ? "—"
        : formatDuration(stats.averageGenerationSeconds);

  return (
    <>
      <div className={styles.stat} aria-live="polite">
        <svg viewBox="0 0 24 24" fill="currentColor" stroke="none" aria-hidden="true"><rect x="3" y="14" width="4" height="7" rx="1"/><rect x="10" y="9" width="4" height="12" rx="1"/><rect x="17" y="3" width="4" height="18" rx="1"/></svg>
        <div>
          <div className={styles.statLabel}>ผลการใช้งานจริง</div>
          <div className={styles.statValue}>{countValue}</div>
          <div className={styles.statDetail}>
            {state === "loading" ? "กำลังดึงข้อมูลจากระบบ" : state === "unavailable" || !stats ? "ลองโหลดหน้าเว็บอีกครั้งภายหลัง" : stats.completedJobs === 0 ? "ยังไม่มีงานสำเร็จในประวัติที่เก็บอยู่" : "งานสรุปที่สำเร็จจากผู้ใช้ทุกบัญชี"}
          </div>
        </div>
      </div>
      <div className={styles.stat} aria-live="polite">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M12 5v7l4 3"/></svg>
        <div>
          <div className={styles.statLabel}>ระยะเวลา Generate</div>
          <div className={styles.statValue}>{durationValue}</div>
          <div className={styles.statDetail}>
            {state === "loading" ? "กำลังดึงข้อมูลจากระบบ" : state === "unavailable" || !stats ? "ลองโหลดหน้าเว็บอีกครั้งภายหลัง" : stats.durationAvailable === false ? "ยังโหลดข้อมูลเวลาไม่ได้" : stats.averageGenerationSeconds === null ? "ยังไม่มีข้อมูลงานที่บันทึกเวลาไว้" : "เฉพาะงานที่มีข้อมูลเวลา Generate"}
          </div>
        </div>
      </div>
      {stats?.updatedAt && state === "ready" && (
        <p className={styles.statsUpdated}>
          {formatUpdatedAt(stats.updatedAt)}
        </p>
      )}
    </>
  );
}

export default function LandingImpactStats() {
  const [stats, setStats] = useState<Impact | null>(null);
  const [state, setState] = useState<State>("loading");
  const hasSuccessfulData = useRef(false);

  useEffect(() => {
    let active = true;
    const refresh = async () => {
      try {
        const response = await fetch("/api/impact", { cache: "no-store" });
        const data = await response.json() as Partial<Impact>;
        const valid = response.ok
          && data.available === true
          && typeof data.completedJobs === "number"
          && Number.isFinite(data.completedJobs)
          && (data.averageGenerationSeconds === null || (typeof data.averageGenerationSeconds === "number" && Number.isFinite(data.averageGenerationSeconds)));
        if (!active) return;
        if (!valid) {
          if (!hasSuccessfulData.current) setState("unavailable");
          return;
        }
        hasSuccessfulData.current = true;
        setStats(data as Impact);
        setState("ready");
      } catch {
        if (active && !hasSuccessfulData.current) setState("unavailable");
      }
    };

    void refresh();
    const timer = window.setInterval(() => void refresh(), 60_000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, []);

  return <LandingImpactStatsPanel state={state} stats={stats} />;
}
