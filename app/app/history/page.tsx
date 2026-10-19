"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type LogEntry = {
  id: string;
  createdAt: string;
  creditsUsed?: number;
  hasSnapshot?: boolean;
};

export default function HistoryPage() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modal, setModal] = useState<{ logId: string; text: string } | null>(null);
  const [snapshotLoading, setSnapshotLoading] = useState<string | null>(null);
  const [canViewSnapshots, setCanViewSnapshots] = useState(false);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/usage/history?limit=100");
        const data = await res.json();
        if (!res.ok || !data.ok) {
          throw new Error(data.error || "โหลดประวัติไม่สำเร็จ");
        }
        setLogs(data.logs || []);
        setCanViewSnapshots(data.canViewSnapshots === true);
      } catch (err) {
        setError(err instanceof Error ? err.message : "โหลดข้อมูลล้มเหลว");
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, []);

  async function fetchSnapshot(logId: string) {
    setSnapshotLoading(logId);
    try {
      const res = await fetch(`/api/usage/snapshot?logId=${encodeURIComponent(logId)}`);
      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error || "โหลดข้อความไม่สำเร็จ");
      }
      setModal({ logId, text: data.text ?? "" });
    } catch (err) {
      alert(err instanceof Error ? err.message : "โหลดข้อความล้มเหลว");
    } finally {
      setSnapshotLoading(null);
    }
  }

  async function deleteSnapshot(logId: string) {
    if (!window.confirm("ลบข้อความต้นทางและผลสรุปที่บันทึกไว้หรือไม่? รายการโควตาจะยังอยู่ แต่กู้คืนข้อความไม่ได้")) return;
    setSnapshotLoading(logId);
    try {
      const res = await fetch(`/api/usage/snapshot?logId=${encodeURIComponent(logId)}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || "ลบข้อมูลไม่สำเร็จ");
      setLogs((current) => current.map((entry) => entry.id === logId ? { ...entry, hasSnapshot: false } : entry));
      if (modal?.logId === logId) setModal(null);
    } catch (err) {
      alert(err instanceof Error ? err.message : "ลบข้อมูลไม่สำเร็จ");
    } finally {
      setSnapshotLoading(null);
    }
  }

  function copySnapshot(text: string) {
    navigator.clipboard.writeText(text).then(
      () => alert("คัดลอกลงคลิปบอร์ดแล้ว"),
      () => alert("คัดลอกไม่สำเร็จ")
    );
  }

  function downloadSnapshot(text: string) {
    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `discharge-summary-${new Date().toISOString().slice(0, 10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <main className="min-h-screen bg-[#081120] text-slate-100">
      <div className="mx-auto max-w-4xl px-4 py-8 space-y-6">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold text-white">ประวัติการใช้งาน</h1>
            <p className="mt-1 text-sm text-slate-300">
              งานสรุปย้อนหลัง เรียงจากใหม่ไปเก่า
              {" · ระบบพยายามปกปิดข้อมูลในสำเนาที่บันทึกไว้ แต่ไม่รับประกันว่าปกปิดได้ครบทุกกรณี ทุกแพ็กเกจลบสำเนาได้; ดูหรือส่งออกได้เฉพาะ Pro"}
            </p>
          </div>
          <Link
            href="/app"
            className="rounded-2xl border border-slate-700 bg-slate-900/80 px-4 py-2 text-sm font-medium text-slate-100 transition hover:bg-slate-800"
          >
            ← กลับไปสรุปชาร์จ
          </Link>
        </header>

        {error ? (
          <div className="rounded-2xl border border-red-900/60 bg-red-950/40 px-4 py-3 text-sm text-red-200">
            {error}
          </div>
        ) : null}

        {!loading && logs.some((entry) => entry.hasSnapshot) && !canViewSnapshots ? (
          <div className="rounded-2xl border border-cyan-500/30 bg-cyan-950/30 px-4 py-3 text-sm text-cyan-100">
            ต้องใช้แพ็กเกจ Pro เพื่อดูหรือ export ข้อความย้อนหลัง <Link href="/pricing" className="font-semibold underline">ดูแพ็กเกจ Pro</Link>
          </div>
        ) : null}

        {loading ? (
          <div className="text-sm text-slate-300">กำลังโหลด...</div>
        ) : logs.length === 0 ? (
          <div className="rounded-2xl border border-slate-700 bg-slate-950/60 px-4 py-8 text-center text-sm text-slate-400">
            ยังไม่มีประวัติการใช้งาน
          </div>
        ) : (
          <div className="overflow-x-auto rounded-3xl border border-white/10 bg-white/[0.03]">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-900/80 text-left text-xs uppercase tracking-wide text-slate-400">
                <tr>
                  <th className="px-4 py-3">#</th>
                  <th className="px-4 py-3">วันที่ / เวลา</th>
                  <th className="px-4 py-3">รายการ</th>
                  <th className="px-4 py-3">ดูย้อนหลัง</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((entry, index) => (
                  <tr
                    key={entry.id}
                    className="border-t border-slate-800/60 bg-slate-950/40 hover:bg-slate-900/60"
                  >
                    <td className="px-4 py-3 text-slate-400">{logs.length - index}</td>
                    <td className="px-4 py-3 text-slate-200">
                      {new Date(entry.createdAt).toLocaleString("th-TH", {
                        dateStyle: "short",
                        timeStyle: "short",
                      })}
                    </td>
                    <td className="px-4 py-3 text-slate-300">
                      สร้างสรุป 1 รายการ{(entry.creditsUsed ?? 0) > 0 ? ` · ใช้ ${entry.creditsUsed} สิทธิ์` : ""}
                    </td>
                    <td className="px-4 py-3">
                        {entry.hasSnapshot ? (
                          <>
                            {canViewSnapshots ? <button
                              type="button"
                              onClick={() => fetchSnapshot(entry.id)}
                              disabled={snapshotLoading === entry.id}
                              className="rounded-xl border border-cyan-500/50 bg-cyan-500/10 px-3 py-1.5 text-xs font-medium text-cyan-200 transition hover:bg-cyan-500/20 disabled:opacity-50"
                            >
                              {snapshotLoading === entry.id ? "กำลังโหลด..." : "ดู / Export"}
                            </button> : <span className="text-xs text-slate-500">Pro เท่านั้น</span>}
                            <button
                              type="button"
                              onClick={() => void deleteSnapshot(entry.id)}
                              disabled={snapshotLoading === entry.id}
                              className="ml-2 rounded-xl border border-red-700/50 bg-red-950/20 px-3 py-1.5 text-xs font-medium text-red-200 hover:bg-red-950/40 disabled:opacity-50"
                            >ลบข้อความ</button>
                          </>
                        ) : (
                          <span className="text-slate-500 text-xs">—</span>
                        )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <p className="text-xs text-slate-500">
          แสดงล่าสุดสูงสุด 100 รายการ
        </p>
      </div>

      {modal ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          onClick={() => setModal(null)}
        >
          <div
            className="max-h-[80vh] w-full max-w-2xl overflow-hidden rounded-2xl border border-slate-700 bg-[#0f172a] shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-700 px-4 py-3">
              <span className="text-sm font-medium text-slate-200">ข้อความสรุปเคส</span>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => copySnapshot(modal.text)}
                  className="rounded-xl border border-slate-600 bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-slate-700"
                >
                  คัดลอกทั้งหมด
                </button>
                <button
                  type="button"
                  onClick={() => downloadSnapshot(modal.text)}
                  className="rounded-xl border border-slate-600 bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-slate-700"
                >
                  ดาวน์โหลด .txt
                </button>
                <button
                  type="button"
                  onClick={() => setModal(null)}
                  className="rounded-xl border border-slate-600 bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-slate-700"
                >
                  ปิด
                </button>
              </div>
            </div>
            <div className="max-h-[60vh] overflow-y-auto p-4">
              <pre className="whitespace-pre-wrap break-words font-sans text-sm text-slate-300">
                {modal.text || "ไม่มีข้อความ"}
              </pre>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
