"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

type LedgerRow = {
  id: string;
  userId: string;
  userEmail: string | null;
  userName: string | null;
  sourceType: string;
  sourceId: string | null;
  amount: number;
  direction: string;
  note: string | null;
  createdBy: string | null;
  createdAt: string;
};

export default function AdminLedgerPage() {
  const [rows, setRows] = useState<LedgerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [userId, setUserId] = useState("");
  const [sourceType, setSourceType] = useState("");
  const [limit, setLimit] = useState(200);

  const query = useMemo(() => {
    const sp = new URLSearchParams();
    if (email.trim()) sp.set("email", email.trim());
    if (userId.trim()) sp.set("userId", userId.trim());
    if (sourceType.trim()) sp.set("sourceType", sourceType.trim());
    sp.set("limit", String(limit));
    return sp.toString();
  }, [email, userId, sourceType, limit]);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/ledger?${query}`);
      const text = await res.text();
      const data = (text ? JSON.parse(text) : {}) as { ok?: boolean; error?: string; ledger?: LedgerRow[] };
      if (!res.ok || !data.ok || !Array.isArray(data.ledger)) {
        throw new Error(data.error || "โหลด ledger ไม่สำเร็จ");
      }
      setRows(data.ledger);
    } catch (err) {
      setError(err instanceof Error ? err.message : "โหลด ledger ไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  async function manualAdjust() {
    const targetUserId = userId.trim();
    if (!targetUserId) {
      setError("กรุณาใส่ userId เพื่อปรับเครดิต/วัน");
      return;
    }
    const creditDeltaRaw = (document.getElementById("creditDelta") as HTMLInputElement | null)?.value || "0";
    const expiryDeltaRaw = (document.getElementById("expiryDeltaDays") as HTMLInputElement | null)?.value || "0";
    const noteRaw = (document.getElementById("adjustNote") as HTMLInputElement | null)?.value || "";
    const creditDelta = Number(creditDeltaRaw || 0);
    const expiryDeltaDays = Number(expiryDeltaRaw || 0);
    if (!Number.isFinite(creditDelta) || !Number.isFinite(expiryDeltaDays)) {
      setError("รูปแบบตัวเลขไม่ถูกต้อง");
      return;
    }
    if (creditDelta === 0 && expiryDeltaDays === 0) {
      setError("ยังไม่ได้ระบุการปรับ");
      return;
    }
    setError(null);
    try {
      const res = await fetch("/api/admin/users/adjust", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: targetUserId,
          creditDelta,
          expiryDeltaDays,
          note: noteRaw.trim() || null,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) throw new Error(data.error || "ปรับสิทธิ์ไม่สำเร็จ");
      await load();
      alert("ปรับสิทธิ์สำเร็จ");
    } catch (err) {
      setError(err instanceof Error ? err.message : "ปรับสิทธิ์ไม่สำเร็จ");
    }
  }

  return (
    <main className="min-h-screen bg-[#081120] text-slate-100">
      <div className="mx-auto max-w-6xl px-4 py-8 space-y-6">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold text-white">Admin – Credit Ledger</h1>
            <p className="mt-1 text-sm text-slate-300">ดูประวัติการเพิ่ม/ลดเครดิตโบนัส และปรับเครดิต/วันหมดอายุแบบ manual</p>
          </div>
          <div className="flex gap-2">
            <Link
              href="/admin/users"
              className="rounded-2xl border border-slate-700 bg-slate-900/80 px-4 py-2 text-sm font-medium text-slate-100 transition hover:bg-slate-800"
            >
              Users
            </Link>
            <Link
              href="/admin/payments"
              className="rounded-2xl border border-slate-700 bg-slate-900/80 px-4 py-2 text-sm font-medium text-slate-100 transition hover:bg-slate-800"
            >
              Payments
            </Link>
          </div>
        </header>

        {error ? (
          <div className="rounded-2xl border border-red-900/60 bg-red-950/40 px-4 py-3 text-sm text-red-200">
            {error}
          </div>
        ) : null}

        <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-6">
          <h2 className="text-lg font-semibold text-white">Filter</h2>
          <div className="mt-4 grid gap-3 md:grid-cols-4">
            <div>
              <label className="text-xs text-slate-400">email</label>
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-cyan-500"
                placeholder="user@email.com"
              />
            </div>
            <div>
              <label className="text-xs text-slate-400">userId</label>
              <input
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-cyan-500"
                placeholder="cuid..."
              />
            </div>
            <div>
              <label className="text-xs text-slate-400">sourceType</label>
              <input
                value={sourceType}
                onChange={(e) => setSourceType(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-cyan-500"
                placeholder="feedback/referral/manual/..."
              />
            </div>
            <div>
              <label className="text-xs text-slate-400">limit</label>
              <input
                type="number"
                value={limit}
                onChange={(e) => setLimit(Number(e.target.value))}
                className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-cyan-500"
              />
            </div>
          </div>
        </section>

        <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-6">
          <h2 className="text-lg font-semibold text-white">Manual Adjust</h2>
          <p className="mt-1 text-xs text-slate-400">ใช้ userId ด้านบนเป็นเป้าหมาย</p>
          <div className="mt-4 grid gap-3 md:grid-cols-4">
            <div>
              <label className="text-xs text-slate-400">creditDelta</label>
              <input
                id="creditDelta"
                defaultValue="0"
                className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-cyan-500"
              />
            </div>
            <div>
              <label className="text-xs text-slate-400">expiryDeltaDays</label>
              <input
                id="expiryDeltaDays"
                defaultValue="0"
                className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-cyan-500"
              />
            </div>
            <div className="md:col-span-2">
              <label className="text-xs text-slate-400">note</label>
              <input
                id="adjustNote"
                defaultValue="Manual adjust by admin"
                className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-cyan-500"
              />
            </div>
          </div>
          <div className="mt-4">
            <button
              type="button"
              onClick={manualAdjust}
              className="rounded-2xl bg-amber-500/90 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-400"
            >
              ปรับสิทธิ์
            </button>
          </div>
        </section>

        <section className="overflow-x-auto rounded-3xl border border-white/10 bg-white/[0.03]">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-900/80 text-left text-xs uppercase tracking-wide text-slate-400">
              <tr>
                <th className="px-4 py-3">เวลา</th>
                <th className="px-4 py-3">ผู้ใช้</th>
                <th className="px-4 py-3">ที่มา</th>
                <th className="px-4 py-3">จำนวน</th>
                <th className="px-4 py-3">หมายเหตุ</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td className="px-4 py-4 text-slate-300" colSpan={5}>
                    กำลังโหลด...
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td className="px-4 py-4 text-slate-300" colSpan={5}>
                    ไม่พบรายการ
                  </td>
                </tr>
              ) : (
                rows.map((r) => (
                  <tr key={r.id} className="border-t border-slate-800/60 bg-slate-950/40 hover:bg-slate-900/60">
                    <td className="px-4 py-3 text-xs text-slate-400">
                      {new Date(r.createdAt).toLocaleString("th-TH")}
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-100">{r.userEmail || r.userId}</div>
                      {r.userName ? <div className="text-xs text-slate-400">{r.userName}</div> : null}
                    </td>
                    <td className="px-4 py-3 text-slate-300">
                      <div>{r.sourceType}</div>
                      {r.sourceId ? <div className="text-xs text-slate-500">{r.sourceId}</div> : null}
                    </td>
                    <td className="px-4 py-3">
                      <span className={r.direction === "plus" ? "text-emerald-300" : "text-red-300"}>
                        {r.direction === "plus" ? "+" : "-"}
                        {r.amount}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-300">{r.note || "-"}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </section>
      </div>
    </main>
  );
}

