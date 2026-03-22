"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type UserRow = {
  id: string;
  email: string | null;
  name: string | null;
  plan: string;
  role: string;
  totalGenerations: number;
  usageCount: number;
  planTotal: number;
  daysLeftInMonth: number;
  deviceCount: number;
  createdAt: string;
};

export default function AdminUsersPage() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [adjustingId, setAdjustingId] = useState<string | null>(null);
  const [edits, setEdits] = useState<Record<string, { plan: string; role: string }>>({});
  /** ลบ user ต้องยืนยัน 2 ขั้นใน modal (ไม่ใช้ window.confirm — บางเบราว์เซอร์ไม่โชว์ชัด) */
  const [deleteModal, setDeleteModal] = useState<{
    userId: string;
    label: string;
    step: 1 | 2;
  } | null>(null);

  async function loadUsers() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/users");
      const text = await res.text();
      let data: { ok?: boolean; error?: string; users?: UserRow[] };
      try {
        data = text ? JSON.parse(text) : { ok: false };
      } catch {
        throw new Error(res.ok ? "ตอบกลับไม่ใช่ JSON" : `โหลดไม่สำเร็จ (${res.status})`);
      }
      if (!res.ok || !data.ok || !data.users) {
        throw new Error(data.error || "โหลดรายการผู้ใช้ไม่สำเร็จ");
      }
      setUsers(data.users);
      setEdits(
        Object.fromEntries(
          data.users.map((u: UserRow) => [
            u.id,
            { plan: u.plan, role: u.role },
          ])
        )
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "โหลดข้อมูลล้มเหลว");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadUsers();
  }, []);

  function setEdit(id: string, field: "plan" | "role", value: string) {
    setEdits((prev) => ({
      ...prev,
      [id]: { ...prev[id], [field]: value },
    }));
  }

  async function saveUser(id: string) {
    const e = edits[id];
    if (!e) return;
    const user = users.find((u) => u.id === id);
    if (!user || (e.plan === user.plan && e.role === user.role)) return;

    setUpdatingId(id);
    setError(null);
    try {
      const res = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: id, plan: e.plan, role: e.role }),
      });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) {
        throw new Error(data.error || "อัปเดตไม่สำเร็จ");
      }
      setUsers((prev) =>
        prev.map((u) =>
          u.id === id ? { ...u, plan: e.plan, role: e.role } : u
        )
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "อัปเดตล้มเหลว");
    } finally {
      setUpdatingId(null);
    }
  }

  function openDeleteModal(userId: string, label: string) {
    setDeleteModal({ userId, label, step: 1 });
  }

  async function runDeleteUser(userId: string) {
    setDeletingId(userId);
    setError(null);
    try {
      const res = await fetch("/api/admin/users", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) {
        throw new Error(data.error || "ลบผู้ใช้ไม่สำเร็จ");
      }
      setUsers((prev) => prev.filter((u) => u.id !== userId));
      setEdits((prev) => {
        const next = { ...prev };
        delete next[userId];
        return next;
      });
      setDeleteModal(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "ลบผู้ใช้ไม่สำเร็จ");
    } finally {
      setDeletingId(null);
    }
  }

  async function adjustUser(userId: string) {
    const creditDeltaRaw = prompt(
      "ปรับเครดิตโบนัส (ใส่ตัวเลข เช่น 50 หรือ -20)\nถ้าไม่ปรับเครดิต ให้เว้นว่างหรือใส่ 0",
      ""
    );
    if (creditDeltaRaw === null) return;
    const expiryDeltaRaw = prompt(
      "ปรับวันหมดอายุ subscription (วัน, ใส่ตัวเลข เช่น 7 หรือ -3)\nถ้าไม่ปรับวันหมดอายุ ให้เว้นว่างหรือใส่ 0",
      ""
    );
    if (expiryDeltaRaw === null) return;
    const noteRaw = prompt("หมายเหตุ (optional)", "Manual adjust by admin");
    if (noteRaw === null) return;

    const creditDelta = Number(creditDeltaRaw || 0);
    const expiryDeltaDays = Number(expiryDeltaRaw || 0);
    if (!Number.isFinite(creditDelta) || !Number.isFinite(expiryDeltaDays)) {
      setError("รูปแบบตัวเลขไม่ถูกต้อง");
      return;
    }
    if (creditDelta === 0 && expiryDeltaDays === 0) {
      alert("ยังไม่ได้ระบุการปรับ\n\nตัวอย่าง:\n- เติมเครดิต: ใส่ 50\n- หักเครดิต: ใส่ -10\n- เพิ่มวันหมดอายุ: ใส่ 7\n- ลดวันหมดอายุ: ใส่ -3");
      return;
    }

    setAdjustingId(userId);
    setError(null);
    try {
      const res = await fetch("/api/admin/users/adjust", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          creditDelta,
          expiryDeltaDays,
          note: noteRaw.trim() || null,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) {
        throw new Error(data.error || "ปรับสิทธิ์ไม่สำเร็จ");
      }
      await loadUsers();
    } catch (err) {
      setError(err instanceof Error ? err.message : "ปรับสิทธิ์ไม่สำเร็จ");
    } finally {
      setAdjustingId(null);
    }
  }

  return (
    <main className="min-h-screen bg-[#081120] text-slate-100">
      <div className="mx-auto max-w-6xl px-4 py-8 space-y-6">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold text-white">Admin – Users</h1>
            <p className="mt-1 text-sm text-slate-300">
              จัดการแผนและสิทธิ์ผู้ใช้ · แผนรายเดือน 30 วัน / แผนรายปี 365 วัน (อนุมัติสลิป = apply สิทธิ์)
            </p>
          </div>
          <div className="flex gap-2">
            <Link
              href="/admin/payments"
              className="rounded-2xl border border-slate-700 bg-slate-900/80 px-4 py-2 text-sm font-medium text-slate-100 transition hover:bg-slate-800"
            >
              คำขอชำระเงิน
            </Link>
            <Link
              href="/admin/ledger"
              className="rounded-2xl border border-slate-700 bg-slate-900/80 px-4 py-2 text-sm font-medium text-slate-100 transition hover:bg-slate-800"
            >
              Credit ledger
            </Link>
          </div>
        </header>

        {error ? (
          <div className="rounded-2xl border border-red-900/60 bg-red-950/40 px-4 py-3 text-sm text-red-200">
            {error}
          </div>
        ) : null}

        {loading ? (
          <div className="text-sm text-slate-300">กำลังโหลด...</div>
        ) : users.length === 0 ? (
          <div className="rounded-2xl border border-slate-700 bg-slate-950/60 px-4 py-6 text-sm text-slate-300">
            ยังไม่มีผู้ใช้
          </div>
        ) : (
          <div className="overflow-x-auto rounded-3xl border border-white/10 bg-white/[0.03]">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-900/80 text-left text-xs uppercase tracking-wide text-slate-400">
                <tr>
                  <th className="px-4 py-3">อีเมล / ชื่อ</th>
                  <th className="px-4 py-3">แผน</th>
                  <th className="px-4 py-3">สิทธิ์</th>
                  <th className="px-4 py-3">เครดิตรอบนี้</th>
                  <th className="px-4 py-3" title="จำนวนวันจนถึงสิ้นรอบของแพ็กเกจ (30 วัน หรือ 365 วัน)">
                    เหลืออีก (วัน)
                  </th>
                  <th className="px-4 py-3">อุปกรณ์</th>
                  <th className="px-4 py-3">สมัครเมื่อ</th>
                  <th className="px-4 py-3 text-right">จัดการ</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => {
                  const e = edits[u.id] ?? { plan: u.plan, role: u.role };
                  const changed = e.plan !== u.plan || e.role !== u.role;
                  return (
                    <tr
                      key={u.id}
                      className="border-t border-slate-800/60 bg-slate-950/40 hover:bg-slate-900/60"
                    >
                      <td className="px-4 py-3">
                        <div className="font-medium text-slate-100">
                          {u.email || "-"}
                        </div>
                        {u.name ? (
                          <div className="text-xs text-slate-400">{u.name}</div>
                        ) : null}
                      </td>
                      <td className="px-4 py-3">
                        <select
                          value={e.plan}
                          onChange={(ev) => setEdit(u.id, "plan", ev.target.value)}
                          className="rounded-xl border border-slate-700 bg-slate-950 px-2 py-1.5 text-slate-100 focus:border-cyan-500 focus:outline-none"
                        >
                          <option value="trial">trial</option>
                          <option value="basic_monthly">basic_monthly</option>
                          <option value="basic_yearly">basic_yearly</option>
                          <option value="standard_monthly">standard_monthly</option>
                          <option value="standard_yearly">standard_yearly</option>
                          <option value="pro_monthly">pro_monthly</option>
                          <option value="pro_yearly">pro_yearly</option>
                        </select>
                      </td>
                      <td className="px-4 py-3">
                        <select
                          value={e.role}
                          onChange={(ev) => setEdit(u.id, "role", ev.target.value)}
                          className="rounded-xl border border-slate-700 bg-slate-950 px-2 py-1.5 text-slate-100 focus:border-cyan-500 focus:outline-none"
                        >
                          <option value="user">user</option>
                          <option value="admin">admin</option>
                        </select>
                      </td>
                      <td className="px-4 py-3 text-slate-300">
                        {u.usageCount} / {u.planTotal}
                      </td>
                      <td className="px-4 py-3 text-slate-300" title="วันคงเหลือจนหมดอายุ subscription">
                        เหลืออีก {u.daysLeftInMonth} วัน
                      </td>
                      <td className="px-4 py-3 text-slate-300">
                        {u.deviceCount}
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-400">
                        {new Date(u.createdAt).toLocaleDateString("th-TH")}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {changed ? (
                            <button
                              type="button"
                              disabled={updatingId === u.id}
                              onClick={() => saveUser(u.id)}
                              className="rounded-2xl bg-cyan-500/90 px-3 py-1.5 text-xs font-semibold text-white hover:bg-cyan-400 disabled:opacity-50"
                            >
                              {updatingId === u.id ? "กำลังบันทึก..." : "บันทึก"}
                            </button>
                          ) : null}
                          <button
                            type="button"
                            disabled={adjustingId === u.id}
                            onClick={() => adjustUser(u.id)}
                            className="rounded-2xl border border-amber-700 bg-amber-950/40 px-3 py-1.5 text-xs font-medium text-amber-200 hover:bg-amber-900/50 disabled:opacity-50"
                          >
                            {adjustingId === u.id ? "กำลังปรับ..." : "ปรับเครดิต/วัน"}
                          </button>
                          <button
                            type="button"
                            disabled={deletingId === u.id}
                            onClick={() => openDeleteModal(u.id, u.email || u.name || u.id)}
                            className="rounded-2xl border border-red-800 bg-red-950/50 px-3 py-1.5 text-xs font-medium text-red-300 hover:bg-red-900/50 disabled:opacity-50"
                          >
                            {deletingId === u.id ? "กำลังลบ..." : "ลบ"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {deleteModal ? (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-modal-title"
          onClick={() => setDeleteModal(null)}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-slate-600 bg-slate-900 p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="delete-modal-title" className="text-lg font-semibold text-white">
              {deleteModal.step === 1 ? "ยืนยันการลบ (ขั้นที่ 1/2)" : "ยืนยันครั้งสุดท้าย (ขั้นที่ 2/2)"}
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-slate-300">
              {deleteModal.step === 1 ? (
                <>
                  จะลบผู้ใช้{" "}
                  <span className="font-mono font-medium text-cyan-200">{deleteModal.label}</span>{" "}
                  อย่างถาวร — ไม่สามารถกู้คืนได้
                </>
              ) : (
                <>
                  กด &quot;ลบถาวร&quot; เพื่อลบบัญชี{" "}
                  <span className="font-mono font-medium text-cyan-200">{deleteModal.label}</span>{" "}
                  จริงๆ หากกดผิด ให้กดยกเลิก
                </>
              )}
            </p>
            <div className="mt-6 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                className="rounded-xl border border-slate-600 bg-slate-800 px-4 py-2 text-sm font-medium text-slate-200 hover:bg-slate-700"
                onClick={() => setDeleteModal(null)}
              >
                ยกเลิก
              </button>
              {deleteModal.step === 1 ? (
                <button
                  type="button"
                  className="rounded-xl border border-amber-700 bg-amber-950/60 px-4 py-2 text-sm font-semibold text-amber-100 hover:bg-amber-900/50"
                  onClick={() => setDeleteModal((m) => (m ? { ...m, step: 2 } : null))}
                >
                  ถัดไป — ยืนยัน
                </button>
              ) : (
                <button
                  type="button"
                  disabled={deletingId === deleteModal.userId}
                  className="rounded-xl border border-red-700 bg-red-950/50 px-4 py-2 text-sm font-semibold text-red-200 hover:bg-red-900/50 disabled:opacity-50"
                  onClick={() => void runDeleteUser(deleteModal.userId)}
                >
                  {deletingId === deleteModal.userId ? "กำลังลบ..." : "ลบถาวร"}
                </button>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
