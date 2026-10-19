"use client";

import { Fragment, useEffect, useState } from "react";
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
  summariesToday: number;
  dailySummaryLimit: number;
  summariesThisMonth: number;
  lifetimeSummaries: number;
  apiCostEstimateStatus: "known" | "unknown";
  apiCostEstimateThb: number | null;
  apiCostKnownSubtotalThb: number;
  apiCostUnknownModelCount: number;
  apiCostInvalidRowCount: number;
  apiCostRowCount: number | null;
  apiCostUncertainty: string[];
  apiCostSafeForEnforcement: boolean;
  revenue4xEligible: boolean;
  revenue4xEffectiveFrom: string;
  currentApiCostCapThb: number | null;
  currentApiCostCapKind: "revenue_4x" | "legacy_internal";
  policySpendThb: number | null;
  policyRemainingThb: number | null;
  policyStatus: "active" | "expired";
  policyAllowed: boolean;
  policyResetAt: string | null;
  usagePolicySpendBasis: "legacy_internal" | "actual_api_standard_rates";
  currentApiCostWindow: "billing_period_to_date" | "legacy_calendar_month_to_date" | "calendar_month_to_date";
  nextRenewalCapForecastThb: number | null;
  currentPeriodEndsAt: string;
  dailyUsageResetsAt: string;
  monthlyUsageResetsAt: string;
  daysLeftInMonth: number;
  deviceCount: number;
  createdAt: string;
  boostPassesRemaining: number;
  boostPassesPurchased: number;
  boostPurchaseCount: number;
  boostPurchaseRevenue: number;
  boostPassesConsumed: number;
  boostLastPurchaseAt: string | null;
  boostLastUsedAt: string | null;
};

type BoostOverview = { successfulPurchases: number; passesSold: number; revenueThb: number; passesRemaining: number; passesConsumed: number; pendingPurchases: number; failedPurchases: number; unverifiedAppliedPurchases: number };

type Activity = Record<string, string | number | boolean | string[] | null | undefined> & {
  id: string; kind: string; createdAt: string;
};

export default function AdminUsersPage() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [boostOverview, setBoostOverview] = useState<BoostOverview | null>(null);
  const [userFilter, setUserFilter] = useState<"all" | "current" | "history">("all");
  const [userSearch, setUserSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [adjustingId, setAdjustingId] = useState<string | null>(null);
  const [edits, setEdits] = useState<Record<string, { plan: string; role: string }>>({});
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [activityByUser, setActivityByUser] = useState<Record<string, Activity[]>>({});
  const [activityLoadingId, setActivityLoadingId] = useState<string | null>(null);
  const [activityError, setActivityError] = useState<string | null>(null);
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
      let data: { ok?: boolean; error?: string; users?: UserRow[]; boostOverview?: BoostOverview };
      try {
        data = text ? JSON.parse(text) : { ok: false };
      } catch {
        throw new Error(res.ok ? "ตอบกลับไม่ใช่ JSON" : `โหลดไม่สำเร็จ (${res.status})`);
      }
      if (!res.ok || !data.ok || !data.users) {
        throw new Error(data.error || "โหลดรายการผู้ใช้ไม่สำเร็จ");
      }
      setUsers(data.users);
      setBoostOverview(data.boostOverview ?? null);
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

  const visibleUsers = users.filter((u) => {
    const query = userSearch.trim().toLocaleLowerCase();
    const matchesSearch = !query || `${u.email ?? ""} ${u.name ?? ""} ${u.id}`.toLocaleLowerCase().includes(query);
    const matchesBoost = userFilter === "all" || (userFilter === "current" ? u.boostPassesRemaining > 0 : u.boostPurchaseCount > 0 || u.boostPassesConsumed > 0);
    return matchesSearch && matchesBoost;
  });

  useEffect(() => {
    void loadUsers();
  }, []);

  function setEdit(id: string, field: "plan" | "role", value: string) {
    setEdits((prev) => ({
      ...prev,
      [id]: { ...prev[id], [field]: value },
    }));
  }

  async function toggleActivity(userId: string) {
    if (expandedId === userId) { setExpandedId(null); return; }
    setExpandedId(userId);
    setActivityError(null);
    if (activityByUser[userId]) return;
    setActivityLoadingId(userId);
    try {
      const res = await fetch(`/api/admin/users/${encodeURIComponent(userId)}/activity?limit=20`, { cache: "no-store" });
      const data = await res.json() as { ok?: boolean; activities?: Activity[]; error?: string };
      if (!res.ok || !data.ok) throw new Error(data.error || "โหลดกิจกรรมไม่สำเร็จ");
      setActivityByUser((prev) => ({ ...prev, [userId]: data.activities || [] }));
    } catch (err) {
      setActivityError(err instanceof Error ? err.message : "โหลดกิจกรรมไม่สำเร็จ");
    } finally {
      setActivityLoadingId(null);
    }
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
      "ปรับโควตาเสริม (ตัวเลข เช่น 50 หรือ -20)\nถ้าไม่ปรับโควตา ให้เว้นว่างหรือใส่ 0",
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
      alert("ยังไม่ได้ระบุการปรับ\n\nตัวอย่าง:\n- เติมโควตา: ใส่ 50\n- หักโควตา: ใส่ -10\n- เพิ่มวันหมดอายุ: ใส่ 7\n- ลดวันหมดอายุ: ใส่ -3");
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
              จัดการแผนและสิทธิ์ผู้ใช้ · รอบ 30/365 วันตามแพ็กเกจ · ชำระเงินหลักผ่าน Stripe (webhook อัปเดตสิทธิ์อัตโนมัติ)
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
              บันทึกโควตา
            </Link>
          </div>
        </header>

        {error ? (
          <div className="rounded-2xl border border-red-900/60 bg-red-950/40 px-4 py-3 text-sm text-red-200">
            {error}
          </div>
        ) : null}

        {!loading && boostOverview ? <section aria-label="ภาพรวม Boost" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            ["ชำระแล้ว (Stripe ยืนยัน)", boostOverview.successfulPurchases.toLocaleString("th-TH") + " รายการ"],
            ["สิทธิ์ขายแล้ว", boostOverview.passesSold.toLocaleString("th-TH")],
            ["รายรับที่ยืนยันแล้ว", "฿" + boostOverview.revenueThb.toLocaleString("th-TH")],
            ["รอชำระ / ยืนยัน", boostOverview.pendingPurchases.toLocaleString("th-TH") + " รายการ"],
            ["ไม่สำเร็จ / ยกเลิก / หมดอายุ", boostOverview.failedPurchases.toLocaleString("th-TH") + " รายการ"],
            ["บันทึกสิทธิ์แต่ไม่มีหลักฐาน Stripe", boostOverview.unverifiedAppliedPurchases.toLocaleString("th-TH") + " รายการ"],
            ["สิทธิ์คงเหลือ", boostOverview.passesRemaining.toLocaleString("th-TH")],
            ["สิทธิ์ใช้แล้ว", boostOverview.passesConsumed.toLocaleString("th-TH")],
          ].map(([label, value]) => <div key={label} className="rounded-xl border border-cyan-900/60 bg-slate-950/70 p-3"><p className="text-xs text-slate-400">{label}</p><p className="mt-1 text-lg font-semibold text-cyan-100">{value}</p></div>)}
          <p className="text-xs text-slate-500 sm:col-span-2 lg:col-span-5">ยอดสิทธิ์คงเหลือมาจากเครดิตในบัญชี อาจรวมเครดิตซื้อ Boost และเครดิตที่แอดมิน/แนะนำ/โบนัสเพิ่ม จึงอาจไม่ตรงกับยอดซื้อหักยอดใช้</p>
        </section> : null}

        {!loading ? <div className="flex flex-wrap items-center gap-2">
          <input value={userSearch} onChange={(event) => setUserSearch(event.target.value)} placeholder="ค้นหาอีเมล ชื่อ หรือ ID" className="min-w-64 rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm" />
          <label className="text-sm text-slate-300">Boost:
            <select value={userFilter} onChange={(event) => setUserFilter(event.target.value as typeof userFilter)} className="ml-2 rounded-xl border border-slate-700 bg-slate-950 px-3 py-2">
              <option value="all">ผู้ใช้ทั้งหมด</option><option value="current">มีสิทธิ์คงเหลือ</option><option value="history">มีประวัติซื้อ/ใช้</option>
            </select>
          </label>
          <span className="text-xs text-slate-500">แสดง {visibleUsers.length} / {users.length} ผู้ใช้</span>
        </div> : null}

        {loading ? (
          <div className="text-sm text-slate-300">กำลังโหลด...</div>
        ) : visibleUsers.length === 0 ? (
          <div className="rounded-2xl border border-slate-700 bg-slate-950/60 px-4 py-6 text-sm text-slate-300">
            ยังไม่มีผู้ใช้
          </div>
        ) : (
          <div className="max-w-full overflow-x-auto rounded-3xl border border-white/10 bg-white/[0.03]">
            <table className="w-full min-w-[1320px] text-sm">
              <thead className="bg-slate-900/80 text-left text-xs uppercase tracking-wide text-slate-400">
                <tr>
                  <th className="w-[240px] px-4 py-3">ผู้ใช้</th>
                  <th className="w-[230px] px-4 py-3">แผน / สถานะ</th>
                  <th className="w-[150px] px-4 py-3">ใช้วันนี้ / เพดานรายวัน</th>
                  <th className="w-[205px] px-4 py-3">วงเงิน AI รอบแพ็กเกจ</th>
                  <th className="w-[180px] px-4 py-3">Boost</th>
                  <th className="w-[190px] px-4 py-3" title="ประมาณจาก model และ token ที่บันทึกไว้; ไม่ใช่ใบแจ้งหนี้ API จริง">
                    ต้นทุน API ประเมิน
                  </th>
                  <th className="w-[150px] px-4 py-3">วันจบรอบ</th>
                  <th className="w-[300px] px-4 py-3 text-right">จัดการ</th>
                </tr>
              </thead>
              <tbody>
                {visibleUsers.map((u) => {
                  const e = edits[u.id] ?? { plan: u.plan, role: u.role };
                  const changed = e.plan !== u.plan || e.role !== u.role;
                  return (
                    <Fragment key={u.id}>
                    <tr className="border-t border-slate-800/60 bg-slate-950/40 align-top hover:bg-slate-900/60">
                      <td className="px-4 py-3">
                        <div className="font-medium text-slate-100">
                          {u.email || "-"}
                        </div>
                        {u.name ? (
                          <div className="text-xs text-slate-400">{u.name}</div>
                        ) : null}
                        <details className="mt-2 text-xs text-slate-400">
                          <summary className="w-fit cursor-pointer text-cyan-300 hover:text-cyan-200">ดูรายละเอียด</summary>
                          <div className="mt-2 space-y-2 rounded-xl border border-slate-800 bg-black/20 p-3 leading-relaxed">
                            <div>ใช้งานเดือนนี้ {u.summariesThisMonth} เคส · สะสม {u.lifetimeSummaries} เคส</div>
                            <div>รีเซ็ตรายวัน {new Date(u.dailyUsageResetsAt).toLocaleString("th-TH", { timeZone: "Asia/Bangkok" })}</div>
                            <div>รีเซ็ตรอบโควตา {new Date(u.monthlyUsageResetsAt).toLocaleString("th-TH", { timeZone: "Asia/Bangkok" })}</div>
                            <div>อุปกรณ์ที่ลงทะเบียน {u.deviceCount} เครื่อง · สมัคร {new Date(u.createdAt).toLocaleDateString("th-TH", { timeZone: "Asia/Bangkok" })}</div>
                            <div className="border-t border-slate-800 pt-2" title="120/420/1260 เป็นเครดิตภายใน ไม่ใช่จำนวนเคส; รอบเดิมอาจยังบังคับเพดานนี้ควบคู่กับวงเงิน AI">
                              <span className="font-medium text-slate-200">เครดิตรอบเดิม (หน่วยภายใน): </span>
                              {u.usageCount} / {u.planTotal} หน่วย
                              <p className="mt-1 text-slate-500">ไม่ใช่จำนวนเคสหรือเงินบาท; รอบที่จ่ายก่อนนโยบายใหม่อาจยังถูกจำกัดด้วยเครดิตนี้และวงเงินภายใน 3600 หน่วยร่วมกัน ส่วนค่าประเมิน API แสดงแยกต่างหาก</p>
                            </div>
                            <div className="border-t border-slate-800 pt-2">
                              <div className="font-medium text-slate-200">รายละเอียดวงเงินและต้นทุน</div>
                              <div>{u.currentApiCostWindow === "billing_period_to_date" ? "ตั้งแต่เริ่มรอบบิล" : u.currentApiCostWindow === "legacy_calendar_month_to_date" ? "เดือนปฏิทินนี้ (รอบเดิม)" : "เดือนปฏิทินนี้"}</div>
                              <div>ต้นทุน API ประเมิน: {u.apiCostEstimateStatus === "known" && u.apiCostEstimateThb !== null ? `฿${u.apiCostEstimateThb.toFixed(4)} จาก ${u.apiCostRowCount} รายการ` : `ข้อมูลไม่ครบ · ประเมินได้ ฿${u.apiCostKnownSubtotalThb.toFixed(4)}`}; ไม่ใช่ใบแจ้งหนี้</div>
                              {u.apiCostUnknownModelCount > 0 || u.apiCostInvalidRowCount > 0 ? <div className="text-amber-300">รุ่นที่ไม่รองรับ {u.apiCostUnknownModelCount} · ข้อมูลไม่ครบ {u.apiCostInvalidRowCount}</div> : null}
                              {u.apiCostUncertainty.length > 0 ? <ul className="list-inside list-disc text-amber-300">{u.apiCostUncertainty.map((item) => <li key={item}>{item}</li>)}</ul> : null}
                              <div>นโยบาย: {u.currentApiCostCapKind === "revenue_4x" ? `เพดานต้นทุน API รอบเต็ม ฿${u.currentApiCostCapThb === null ? "ไม่ทราบ" : u.currentApiCostCapThb.toFixed(2)}` : `เพดานรุ่นเดิม ${u.currentApiCostCapThb === null ? "ไม่ทราบ" : u.currentApiCostCapThb.toFixed(2)} หน่วยภายใน / เดือน (ไม่ใช่บาท)`}</div>
                              {u.policySpendThb === null ? <div>ยอดใช้ตามนโยบาย: ไม่ทราบ (ledger อ่านไม่ได้หรือข้อมูลไม่ครบ)</div> : <div>ยอดใช้ตามนโยบาย: {u.usagePolicySpendBasis === "legacy_internal" ? `${u.policySpendThb.toFixed(4)} หน่วยภายในรุ่นเดิม` : `฿${u.policySpendThb.toFixed(4)} ต้นทุน API ประเมิน`}</div>}
                              {u.policyRemainingThb !== null ? <div>เหลือในกรอบ: {u.usagePolicySpendBasis === "legacy_internal" ? `${u.policyRemainingThb.toFixed(4)} หน่วยภายในรุ่นเดิม` : `฿${u.policyRemainingThb.toFixed(4)}`}</div> : null}
                              {u.policyStatus === "expired" ? <div className="text-amber-300">รอบนโยบายหมดอายุ</div> : null}
                              {u.policyResetAt ? <div>รีเซ็ตนโยบาย {new Date(u.policyResetAt).toLocaleString("th-TH", { timeZone: "Asia/Bangkok" })}</div> : null}
                              {u.nextRenewalCapForecastThb !== null && u.currentApiCostCapKind === "legacy_internal" ? <div>คาดการณ์เพดานรอบต่ออายุ ฿{u.nextRenewalCapForecastThb.toFixed(2)} (เริ่มได้ตั้งแต่ {new Date(u.revenue4xEffectiveFrom).toLocaleDateString("th-TH", { timeZone: "Asia/Bangkok" })}; ยังไม่ active)</div> : null}
                            </div>
                          </div>
                        </details>
                      </td>
                      <td className="px-4 py-3">
                        <div className="mb-2 flex flex-wrap gap-1.5">
                          <span className="rounded-full border border-cyan-900/70 bg-cyan-950/60 px-2 py-0.5 text-[11px] text-cyan-200">{u.daysLeftInMonth > 0 ? "รอบสิทธิ์ยังไม่จบ" : "รอบสิทธิ์สิ้นสุด"}</span>
                          <span className="rounded-full border border-slate-700 bg-slate-900 px-2 py-0.5 text-[11px] text-slate-300">{e.role === "admin" ? "Admin" : "User"}</span>
                        </div>
                        <select aria-label={`แผนของ ${u.email || u.name || u.id}`} value={e.plan} onChange={(ev) => setEdit(u.id, "plan", ev.target.value)} className="w-full rounded-xl border border-slate-700 bg-slate-950 px-2 py-1.5 text-slate-100 focus:border-cyan-500 focus:outline-none">
                          <option value="trial">trial</option><option value="basic_monthly">basic_monthly</option><option value="basic_yearly">basic_yearly</option><option value="standard_monthly">standard_monthly</option><option value="standard_yearly">standard_yearly</option><option value="pro_monthly">pro_monthly</option><option value="pro_yearly">pro_yearly</option>
                        </select>
                        <select aria-label={`สิทธิ์บัญชีของ ${u.email || u.name || u.id}`} value={e.role} onChange={(ev) => setEdit(u.id, "role", ev.target.value)} className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-2 py-1.5 text-slate-100 focus:border-cyan-500 focus:outline-none">
                          <option value="user">user</option><option value="admin">admin</option>
                        </select>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-slate-200">
                        <div className="text-base font-semibold tabular-nums">{u.summariesToday} / {u.dailySummaryLimit} เคส</div>
                        <span className="text-xs text-slate-500">วันนี้</span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-semibold tabular-nums text-slate-100">{u.policySpendThb === null ? "ยอดใช้ไม่ทราบ" : u.usagePolicySpendBasis === "legacy_internal" ? `${u.policySpendThb.toFixed(2)} / ${u.currentApiCostCapThb?.toFixed(2) ?? "?"} หน่วย` : `฿${u.policySpendThb.toFixed(2)} / ฿${u.currentApiCostCapThb?.toFixed(2) ?? "?"}`}</div>
                        <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs">
                          <span className={`rounded-full px-2 py-0.5 ${u.policyStatus === "expired" ? "bg-amber-950/60 text-amber-200" : u.policyAllowed ? "bg-emerald-950/60 text-emerald-200" : "bg-red-950/60 text-red-200"}`}>{u.policyStatus === "expired" ? "รอบหมดอายุ" : u.policyAllowed ? "ยังอยู่ในวงเงิน" : "ถึงเพดาน"}</span>
                          <span className="text-slate-500">{u.usagePolicySpendBasis === "legacy_internal" ? "หน่วยวงเงินภายใน (ไม่ใช่บาท)" : "ต้นทุน API ประเมิน"}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-300">
                        <div className="font-semibold text-cyan-100">เหลือ {u.boostPassesRemaining} สิทธิ์</div>
                        <div className="text-slate-500">ซื้อ {u.boostPassesPurchased} · ใช้ {u.boostPassesConsumed}</div>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-300">
                        {u.apiCostEstimateStatus === "known" && u.apiCostSafeForEnforcement && u.apiCostEstimateThb !== null ? <>
                          <div className="font-semibold tabular-nums text-slate-100">฿{u.apiCostEstimateThb.toFixed(2)}</div>
                          <span className="text-emerald-300">ประเมินได้ · {u.apiCostRowCount} รายการ</span>
                        </> : <>
                          <div className="font-semibold tabular-nums text-amber-200">ประเมินได้บางส่วน ฿{u.apiCostKnownSubtotalThb.toFixed(2)}</div>
                          <span className="text-amber-300">ข้อมูลไม่ครบ · ดูรายละเอียด</span>
                        </>}
                        <div className="text-[11px] text-slate-500">ไม่ใช่ใบแจ้งหนี้ API</div>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-slate-300">
                        <div>{new Date(u.currentPeriodEndsAt).toLocaleDateString("th-TH", { timeZone: "Asia/Bangkok" })}</div>
                        <div className="text-xs text-slate-500">เหลือ {u.daysLeftInMonth} วัน</div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex flex-wrap items-center justify-end gap-2">
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
                            {adjustingId === u.id ? "กำลังปรับ..." : "ปรับโควตา/วัน"}
                          </button>
                          <button
                            type="button"
                            aria-expanded={expandedId === u.id}
                            onClick={() => void toggleActivity(u.id)}
                            className="rounded-2xl border border-cyan-800 bg-cyan-950/40 px-3 py-1.5 text-xs font-medium text-cyan-200 hover:bg-cyan-900/50"
                          >
                            {expandedId === u.id ? "ซ่อนกิจกรรม" : "กิจกรรมเคส"}
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
                    {expandedId === u.id ? (
                      <tr key={`${u.id}:activity`} className="border-t border-cyan-900/50 bg-slate-950/80">
                        <td colSpan={8} className="px-5 py-4">
                          <p className="mb-3 text-xs text-amber-200">สำหรับตรวจสอบการทำงานของระบบโดยผู้ดูแลเท่านั้น ข้อความสรุปยังอาจมีข้อมูลสุขภาพอ่อนไหวแม้ผ่านการปกปิดตัวระบุแล้ว; แสดงเมื่อขยายรายการเท่านั้น ไม่มีภาพหรือ raw payload</p>
                          {activityLoadingId === u.id ? <p className="text-sm text-slate-400">กำลังโหลดกิจกรรม...</p> : null}
                          {activityError ? <p role="alert" className="text-sm text-red-300">{activityError}</p> : null}
                          {!activityLoadingId && !activityError && (activityByUser[u.id] || []).length === 0 ? <p className="text-sm text-slate-400">ไม่พบกิจกรรมในแหล่งข้อมูลที่มี</p> : null}
                          <div className="space-y-3">
                            {(activityByUser[u.id] || []).map((item) => (
                              <details key={item.id} className="rounded-xl border border-slate-800 bg-slate-900/60 p-3">
                                <summary className="cursor-pointer text-sm text-slate-200">
                                  {new Date(item.createdAt).toLocaleString("th-TH", { timeZone: "Asia/Bangkok" })} · {item.kind === "boost_purchase" ? "Boost purchase" : item.kind === "summary" && Number(item.addonCreditsUsed) > 0 ? "Boost used" : item.kind} · {String(item.kind === "boost_purchase" ? item.status : item.reason || item.source || item.status || "metadata ไม่ครบ")}
                                  {item.model ? ` · ${String(item.model)}` : ""}
                                  {typeof item.totalTokens === "number" ? ` · ${item.totalTokens.toLocaleString()} tokens` : ""}
                                  {typeof item.estimatedCostThb === "number" ? ` · ยอด ledger หน่วยภายใน ฿${item.estimatedCostThb.toFixed(4)}` : ""}
                                </summary>
                                <div className="mt-3 space-y-2 text-xs text-slate-300">
                                  {item.kind === "token_usage" ? <>
                                    <p>แหล่งข้อมูล: {item.source === "summary_provider_call" ? "การเรียกโมเดลรายครั้ง" : item.source === "summary_image_ocr" ? "OCR/ประมวลผลภาพ" : item.source === "summary_generate" ? "ยอดรวมสร้างสรุป" : item.source === "summary_recalc" ? "ยอดรวมคำนวณสรุปใหม่" : String(item.source || "ไม่ทราบ")}</p>
                                    <p>ยอด estimatedCostThb เป็นหน่วย ledger ภายใน ไม่ใช่ต้นทุน API จริง และรายการรายครั้งกับยอดรวมอาจอ้างอิงงานเดียวกัน—ห้ามนำมาบวกเอง</p>
                                    {item.actualApiCostEstimateStatus === "known" && typeof item.actualApiCostEstimateThb === "number"
                                      ? <p>ประมาณต้นทุน API รายการนี้ตาม standard rates: ฿{item.actualApiCostEstimateThb.toFixed(4)} (ไม่ใช่ใบแจ้งหนี้)</p>
                                      : <p className="text-amber-300">ไม่สามารถประเมินต้นทุน API รายการนี้ได้แน่นอน</p>}
                                  </> : null}
                                  {item.kind === "summary" ? <p>เครดิต: {String(item.creditsUsed ?? "ไม่ทราบ")} (base {String(item.baseCreditsUsed ?? "ไม่ทราบ")}, เสริม {String(item.addonCreditsUsed ?? "ไม่ทราบ")}) · case: {String(item.caseId || "ไม่มีข้อมูล")}</p> : null}
                                  {item.kind === "boost_purchase" ? <p>รายการ Boost: {String(item.addCredits ?? 0)} สิทธิ์ · จำนวนเงิน ฿{String(item.finalAmount ?? "ไม่ทราบ")}</p> : null}
                                  {item.kind === "error_report" || item.kind === "summary_job" ? <>
                                    <p>สถานะ: {String(item.status || "ไม่ทราบ")} · issue flag เป็นคำแนะนำอัตโนมัติ ไม่ใช่หลักฐานว่าสรุปถูกหรือผิด</p>
                                    {item.message ? <p className="whitespace-pre-wrap">{String(item.message)}</p> : null}
                                    {item.shortSummary ? <p>สรุป: {String(item.shortSummary)}</p> : null}
                                    {item.pageOrFeature ? <p>ส่วนที่พบ: {String(item.pageOrFeature)}</p> : null}
                                    {item.reproducibleSteps ? <p>ขั้นตอน: {String(item.reproducibleSteps)}</p> : null}
                                    {item.errorCode ? <p>รหัสข้อผิดพลาด: {String(item.errorCode)}</p> : null}
                                    {item.warningCount != null ? <p>คำเตือนที่บันทึก: {String(item.warningCount)}</p> : null}
                                    {Array.isArray(item.warnings) ? item.warnings.map((warning, i) => <p key={i}>• {warning}</p>) : null}
                                    {item.diagnosisConfidence ? <p>ความมั่นใจที่บันทึก: {String(item.diagnosisConfidence)}</p> : null}
                                    {item.privacy ? <p>ข้อมูล privacy: {String(item.privacy)}</p> : null}
                                    <p>ขั้นตอนลดข้อมูลระบุตัวตนในข้อความ: {item.textRedactionApplied === true ? "มี metadata บันทึกว่าใช้แล้ว (best-effort ไม่ใช่การรับรองว่าปกปิดครบ)" : item.textRedactionApplied === false ? "metadata บันทึกว่าไม่ได้ใช้" : "ไม่ทราบ/ไม่มี metadata"}</p>
                                    <p>การยืนยันปกปิดภาพจากผู้ใช้: {item.imageRedactionConfirmed === true ? "มีการยืนยัน" : item.imageRedactionConfirmed === false ? "ไม่มีการยืนยัน" : "ไม่ทราบ/ไม่มี metadata"}</p>
                                    <p>การตรวจสอบเนื้อหาภาพ: {item.imageContentVerified === true ? "มี metadata ว่าตรวจแล้ว (ไม่ใช่การรับรองความถูกต้อง)" : item.imageContentVerified === false ? "บันทึกว่ายังไม่ได้ตรวจ" : "ไม่ทราบ/ไม่มี metadata"}</p>
                                    {item.warningCount == null ? <p className="text-slate-400">จำนวนคำเตือน: ไม่ทราบหรือไม่ได้บันทึก (metadata ของรายการเก่าอาจไม่มี; การไม่มีข้อมูลไม่ยืนยันว่าไม่มีคำเตือน)</p> : null}
                                    {!Array.isArray(item.warnings) ? <p className="text-slate-400">รายละเอียดคำเตือน: ไม่ได้บันทึก</p> : null}
                                    {!item.diagnosisConfidence ? <p className="text-slate-400">ความมั่นใจในการวินิจฉัย: ไม่ทราบหรือไม่ได้บันทึก</p> : null}
                                    {!item.privacy ? <p className="text-slate-400">metadata privacy: ไม่ทราบหรือไม่ได้บันทึก</p> : null}
                                  </> : null}
                                  {item.summaryText ? <p className="whitespace-pre-wrap rounded-lg bg-black/30 p-3">ข้อความสรุปที่ปกปิดตัวระบุแล้ว: {String(item.summaryText)}{item.summaryTextTruncated ? " … (แสดง 12,000 อักขระแรกหลังปกปิดตัวระบุ)" : ""}</p> : item.kind === "summary" ? <p className="text-slate-400">ไม่มี snapshot ที่จัดเก็บไว้ ข้อความเดิมกู้คืนไม่ได้</p> : null}
                                </div>
                              </details>
                            ))}
                          </div>
                        </td>
                      </tr>
                    ) : null}
                    </Fragment>
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
