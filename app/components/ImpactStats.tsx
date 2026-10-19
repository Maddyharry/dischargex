"use client";

import { useEffect, useState } from "react";

type Stats = {
  available: boolean;
  completedJobs: number;
  timedJobs?: number;
  averageGenerationSeconds: number | null;
  updatedAt?: string;
};

type ImpactStatsPanelProps = {
  stats: Stats | null;
  failed: boolean;
};

function formatGenerationDuration(seconds: number): string {
  const roundedSeconds = Math.max(0, Math.round(seconds));
  return `${Math.floor(roundedSeconds / 60)} นาที ${roundedSeconds % 60} วินาที`;
}

export function ImpactStatsPanel({ stats, failed }: ImpactStatsPanelProps) {
  const isLoading = !stats && !failed;

  return (
    <section className="mx-auto max-w-6xl px-6 py-14" aria-labelledby="impact-stats-heading">
      <p className="text-sm font-medium text-cyan-300">ภาพรวมจากผู้ใช้งานทุกบัญชี</p>
      <h2 id="impact-stats-heading" className="mt-2 text-2xl font-semibold">สถิติการสร้างสรุปในระบบ</h2>
      <p className="mt-2 text-sm text-slate-400">ดูภาพรวมงานที่ระบบสร้างสำเร็จ จากประวัติที่เซิร์ฟเวอร์ยังเก็บไว้</p>

      {isLoading ? (
        <p className="mt-5 text-slate-300" role="status">กำลังโหลดสถิติการใช้งาน…</p>
      ) : failed || !stats?.available ? (
        <p className="mt-5 rounded-xl border border-amber-300/20 bg-amber-300/5 p-4 text-slate-200" role="status">
          ตอนนี้ยังเชื่อมต่อข้อมูลสถิติไม่ได้ กรุณาลองใหม่ภายหลัง
        </p>
      ) : (
        <div className="mt-6 grid gap-4 sm:grid-cols-2" aria-live="polite">
          <div className="rounded-2xl border border-cyan-300/15 bg-slate-900/70 p-5 sm:p-6">
            <div className="flex items-start gap-4">
              <span aria-hidden="true" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-cyan-300/10 text-xl text-cyan-200">✓</span>
              <div>
                <p className="text-sm text-slate-300">สรุปที่สร้างสำเร็จ</p>
                <strong className="mt-1 block text-3xl font-semibold text-white">{stats.completedJobs.toLocaleString("th-TH")} <span className="text-base font-normal text-slate-400">งาน</span></strong>
              </div>
            </div>
            {stats.completedJobs === 0 && (
              <p className="mt-3 text-sm text-slate-400">ยังไม่มีงานสำเร็จในประวัติที่เก็บอยู่</p>
            )}
          </div>
          <div className="rounded-2xl border border-blue-300/15 bg-slate-900/70 p-5 sm:p-6">
            <div className="flex items-start gap-4">
              <span aria-hidden="true" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-300/10 text-xl text-blue-200">◷</span>
              <div>
                <p className="text-sm text-slate-300">เวลา Generate เฉลี่ย</p>
                <strong className="mt-1 block text-2xl font-semibold text-white sm:text-3xl">
                  {stats.averageGenerationSeconds === null
                    ? "—"
                    : formatGenerationDuration(stats.averageGenerationSeconds)}
                </strong>
              </div>
            </div>
            <p className="mt-3 text-sm text-slate-400">
              {stats.averageGenerationSeconds === null
                ? "ยังไม่มีข้อมูลเวลาเพียงพอสำหรับคำนวณค่าเฉลี่ย"
                : `ต่อเคส · คำนวณจาก ${stats.timedJobs ?? 0} งานที่มีข้อมูลเวลา`}
            </p>
          </div>
          {stats.updatedAt && (
            <p className="text-xs text-slate-400 sm:col-span-2">
              ข้อมูลล่าสุด {new Date(stats.updatedAt).toLocaleString("th-TH", { timeZone: "Asia/Bangkok" })}
            </p>
          )}
        </div>
      )}

      <details className="mt-5 text-sm text-slate-400">
        <summary className="cursor-pointer">สถิตินี้นับอย่างไร</summary>
        <p className="mt-2">
          นับงานสรุปที่สร้างสำเร็จและบันทึกบนเซิร์ฟเวอร์จากทุกบัญชี ไม่นับงานล้มเหลว การคำนวณซ้ำ หรือการลองซ้ำ เวลาเฉลี่ยเป็นเวลา Generate ฝั่งเซิร์ฟเวอร์ เฉพาะงานที่มีข้อมูลเวลาบันทึก
        </p>
      </details>
    </section>
  );
}

export function ImpactStats() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    const refresh = async () => {
      try {
        const response = await fetch("/api/impact", { signal: controller.signal });
        const data = await response.json() as Stats;
        if (!response.ok || data.available !== true) {
          setStats(data);
          setFailed(true);
          return;
        }
        setStats(data);
        setFailed(false);
      } catch {
        if (!controller.signal.aborted) setFailed(true);
      }
    };

    void refresh();
    const timer = setInterval(() => void refresh(), 60_000);
    return () => {
      controller.abort();
      clearInterval(timer);
    };
  }, []);

  return <ImpactStatsPanel stats={stats} failed={failed} />;
}
