"use client";

import { useEffect, useState } from "react";
import { formatSavedDuration } from "@/lib/summary-impact";

type Stats = {
  available: boolean;
  completedJobs: number;
  timedJobs?: number;
  averageGenerationSeconds: number | null;
  manualMinutesPerCase?: number;
  estimatedSavedMinutes?: number | null;
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
      <p className="text-sm font-medium text-cyan-300">ข้อมูลจริงจากผู้ใช้งานทุกบัญชี</p>
      <h2 id="impact-stats-heading" className="mt-2 text-2xl font-semibold">สถิติการสร้างสรุปในระบบ</h2>

      {isLoading ? (
        <p className="mt-5 text-slate-300" role="status">กำลังโหลดสถิติการใช้งาน…</p>
      ) : failed || !stats?.available ? (
        <p className="mt-5 rounded-xl border border-amber-300/20 bg-amber-300/5 p-4 text-slate-200" role="status">
          ตอนนี้ยังเชื่อมต่อข้อมูลสถิติไม่ได้ กรุณาลองใหม่ภายหลัง
        </p>
      ) : (
        <div className="mt-6 grid gap-6 sm:grid-cols-3" aria-live="polite">
          <div>
            <strong className="text-4xl">{stats.completedJobs.toLocaleString("th-TH")}</strong>
            <p className="mt-2 text-slate-300">งานสร้างสรุปที่สำเร็จจากประวัติที่ระบบบันทึกไว้</p>
            {stats.completedJobs === 0 && (
              <p className="mt-2 text-sm text-slate-400">ยังไม่มีงานสำเร็จที่บันทึกไว้</p>
            )}
          </div>
          <div>
            <strong className="text-4xl">
              {stats.averageGenerationSeconds === null
                ? "—"
                : formatGenerationDuration(stats.averageGenerationSeconds)}
            </strong>
            <p className="mt-2 text-slate-300">เวลา Generate เฉลี่ยต่อเคส</p>
            <p className="mt-1 text-sm text-slate-400">
              {stats.averageGenerationSeconds === null
                ? "ยังไม่มีข้อมูลเวลาเฉลี่ยเพียงพอ"
                : `คำนวณจาก ${stats.timedJobs ?? 0} เคสที่มีเวลาบันทึก`}
            </p>
          </div>
          <div>
            <strong className="text-4xl">
              {typeof stats.estimatedSavedMinutes === "number" ? formatSavedDuration(stats.estimatedSavedMinutes) : "—"}
            </strong>
            <p className="mt-2 text-slate-300">เวลาที่อาจประหยัดได้โดยประมาณ</p>
            <p className="mt-1 text-sm text-slate-400">
              เทียบกับสมมติฐานทำเอง {stats.manualMinutesPerCase ?? 10} นาที/เคส เฉพาะ {stats.timedJobs ?? 0} เคสที่มีเวลา Generate บันทึก
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
          นับงานสร้างสรุปที่สำเร็จจากประวัติฝั่งเซิร์ฟเวอร์ที่ยังเก็บอยู่ของผู้ใช้งานทุกบัญชี รวมงานของผู้ดูแลระบบโดยไม่หักโควตา และนับงานเดิมครั้งเดียว
          ไม่นับงานที่ล้มเหลวหรือการคำนวณซ้ำ ตัวเลขนี้ไม่ใช่จำนวนผู้ป่วยที่ไม่ซ้ำกัน
          เวลาเฉลี่ยเป็นเวลา Generate ฝั่งเซิร์ฟเวอร์ของงานที่มีข้อมูลเวลาเท่านั้น เวลาที่ประหยัดเป็นการประมาณโดยเทียบกับสมมติฐานทำเอง 10 นาทีต่อเคส ไม่ใช่การจับเวลาการทำงานจริง และไม่รวมเวลาตรวจทานหรือแก้ไขโดยแพทย์
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
