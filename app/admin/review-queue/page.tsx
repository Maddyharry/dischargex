"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type QueueItem = {
  id: string;
  kind: "reject_feedback" | "low_confidence_summary";
  createdAt: string;
  userId: string | null;
  message: string;
  detail: string;
};

export default function AdminReviewQueuePage() {
  const [items, setItems] = useState<QueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [sendingDigest, setSendingDigest] = useState(false);
  const [actingId, setActingId] = useState<string>("");

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/review-queue");
      const data = (await res.json()) as { ok?: boolean; items?: QueueItem[] };
      if (res.ok && data.ok) setItems(data.items || []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function sendDigest() {
    setSendingDigest(true);
    try {
      await fetch("/api/admin/review-queue/email-digest", { method: "POST" });
    } finally {
      setSendingDigest(false);
    }
  }

  async function applyAction(id: string, action: "reviewed" | "reject") {
    setActingId(id);
    try {
      await fetch("/api/admin/review-queue", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, action }),
      });
      await load();
    } finally {
      setActingId("");
    }
  }

  return (
    <main className="min-h-screen bg-[#081120] text-slate-100">
      <div className="mx-auto max-w-5xl px-4 py-8">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold">Pending Review Queue</h1>
            <p className="text-sm text-slate-400">
              Human-in-the-loop: เคสที่ควร review โดยคนก่อนปรับระบบหรือใช้งานต่อ
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => void sendDigest()}
              disabled={sendingDigest}
              className="rounded-xl border border-emerald-600 bg-emerald-600/20 px-3 py-2 text-xs font-medium text-emerald-200 hover:bg-emerald-600/30 disabled:opacity-60"
            >
              {sendingDigest ? "กำลังส่ง..." : "ส่งอีเมล digest"}
            </button>
            <Link
              href="/admin"
              className="rounded-xl border border-slate-700 bg-slate-900/80 px-3 py-2 text-xs font-medium text-slate-200 hover:bg-slate-800"
            >
              กลับ Admin
            </Link>
          </div>
        </div>

        {loading ? (
          <div className="text-sm text-slate-400">กำลังโหลด...</div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-white/10">
            <table className="w-full text-sm">
              <thead className="bg-white/5 text-slate-300">
                <tr>
                  <th className="px-3 py-2 text-left">Type</th>
                  <th className="px-3 py-2 text-left">Detail</th>
                  <th className="px-3 py-2 text-left">User</th>
                  <th className="px-3 py-2 text-left">Time</th>
                  <th className="px-3 py-2 text-left">Action</th>
                </tr>
              </thead>
              <tbody>
                {items.map((i) => (
                  <tr key={i.id} className="border-t border-white/10">
                    <td className="px-3 py-2">{i.kind}</td>
                    <td className="px-3 py-2">{i.detail}</td>
                    <td className="px-3 py-2">{i.userId || "-"}</td>
                    <td className="px-3 py-2">{new Date(i.createdAt).toLocaleString("th-TH")}</td>
                    <td className="px-3 py-2">
                      <div className="flex gap-2">
                        <button
                          onClick={() => void applyAction(i.id, "reviewed")}
                          disabled={actingId === i.id}
                          className="rounded border border-emerald-700 bg-emerald-900/30 px-2 py-1 text-xs text-emerald-200 disabled:opacity-50"
                        >
                          reviewed
                        </button>
                        <button
                          onClick={() => void applyAction(i.id, "reject")}
                          disabled={actingId === i.id}
                          className="rounded border border-rose-700 bg-rose-900/30 px-2 py-1 text-xs text-rose-200 disabled:opacity-50"
                        >
                          reject
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {items.length === 0 ? (
                  <tr>
                    <td className="px-3 py-4 text-slate-500" colSpan={5}>
                      ไม่มีรายการที่ต้อง review
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </main>
  );
}
