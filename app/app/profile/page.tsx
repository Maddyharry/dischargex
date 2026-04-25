"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { THAI_PROVINCES, validateBirthDateBE, validateThaiPhone } from "@/lib/thai-input";
import { LAST_REVIEWED_DATE, REFERENCE_SET_NAME } from "@/lib/reference-info";

type UserInfo = {
  id: string;
  email: string | null;
  name: string | null;
  plan: string;
  role: string;
  birthDate?: string | null;
  phone?: string | null;
  hospitalName?: string | null;
  province?: string | null;
};

type UsageInfo = {
  plan: string;
  total: number;
  used: number;
  remaining: number;
  tokenSpendThb?: number;
  tokenBudgetThb?: number;
  tokenRemainingThb?: number;
  tokenUsagePercent?: number;
  baseUsagePercent?: number;
  nextCreditRefreshAt?: string | null;
  daysLeftInMonth?: number;
  subscriptionStatus?: string;
  nextPlanId?: string | null;
  nextPlanEffectiveDate?: string | null;
};

type RequestRow = {
  id: string;
  type?: string;
  planRequested: string;
  fromPlanId?: string | null;
  toPlanId?: string | null;
  addCredits?: number | null;
  quotedAmount?: number | null;
  finalAmount?: number | null;
  status: string;
  adminNote?: string | null;
  rejectionReason?: string | null;
  reviewedAt?: string | null;
  createdAt: string;
};

type NotificationItem = {
  id: string;
  type: string;
  title: string;
  message: string;
  meta: string | null;
  readAt: string | null;
  createdAt: string;
};

function formatPlanName(plan: string | null | undefined): string {
  switch (plan) {
    case "basic_monthly":
      return "Basic Monthly";
    case "basic_yearly":
      return "Basic Yearly";
    case "standard_monthly":
      return "Standard Monthly";
    case "standard_yearly":
      return "Standard Yearly";
    case "pro_monthly":
      return "Pro Monthly";
    case "pro_yearly":
      return "Pro Yearly";
    default:
      return plan ?? "-";
  }
}

function formatPaymentStatus(status: string): string {
  switch (status) {
    case "awaiting_review":
    case "awaiting_slip":
    case "pending":
      return "รอตรวจ";
    case "approved":
      return "อนุมัติแล้ว";
    case "rejected":
      return "ปฏิเสธ";
    case "cancelled":
      return "ยกเลิก";
    case "expired":
      return "หมดอายุ";
    default:
      return status;
  }
}

export default function ProfilePage() {
  const { data: session, status: sessionStatus } = useSession();
  const [user, setUser] = useState<UserInfo | null>(null);
  const [usage, setUsage] = useState<UsageInfo | null>(null);
  const [requests, setRequests] = useState<RequestRow[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [editName, setEditName] = useState("");
  const [editBirthDate, setEditBirthDate] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editHospitalName, setEditHospitalName] = useState("");
  const [editProvince, setEditProvince] = useState("");
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [birthDateError, setBirthDateError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stripeSuccess, setStripeSuccess] = useState(false);
  const [portalReturned, setPortalReturned] = useState(false);
  const usagePercent = useMemo(() => {
    if (!usage) return 0;
    if (typeof usage.baseUsagePercent === "number" && typeof usage.tokenUsagePercent === "number") {
      return Math.max(0, Math.min(100, Math.max(usage.baseUsagePercent, usage.tokenUsagePercent)));
    }
    if (typeof usage.baseUsagePercent === "number") {
      return Math.max(0, Math.min(100, usage.baseUsagePercent));
    }
    if (typeof usage.tokenUsagePercent === "number") {
      return Math.max(0, Math.min(100, usage.tokenUsagePercent));
    }
    if (usage.total <= 0) return 0;
    return Math.max(0, Math.min(100, Math.round((usage.used / usage.total) * 100)));
  }, [usage]);
  const displayDaysLeft = useMemo(() => {
    if (!usage) return 0;
    if (typeof usage.daysLeftInMonth === "number" && usage.daysLeftInMonth > 0) return usage.daysLeftInMonth;
    if (!usage.nextCreditRefreshAt) return usage.daysLeftInMonth ?? 0;
    const target = new Date(usage.nextCreditRefreshAt);
    const diffMs = target.getTime() - Date.now();
    if (!Number.isFinite(diffMs) || diffMs <= 0) return usage.daysLeftInMonth ?? 0;
    return Math.max(1, Math.ceil(diffMs / (24 * 60 * 60 * 1000)));
  }, [usage]);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    setStripeSuccess(params.get("stripe") === "success");
    setPortalReturned(params.get("billing") === "portal");
  }, []);

  useEffect(() => {
    if (sessionStatus !== "authenticated") return;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const [meRes, usageRes, reqRes, notiRes] = await Promise.all([
          fetch("/api/me"),
          fetch("/api/usage"),
          fetch("/api/me/requests"),
          fetch("/api/notifications?limit=50"),
        ]);

        const meData = await meRes.json().catch(() => ({}));
        const usageData = await usageRes.json().catch(() => ({}));
        const reqData = await reqRes.json().catch(() => ({}));
        const notiData = await notiRes.json().catch(() => ({}));

        if (meData.ok && meData.user) {
          setUser(meData.user);
          setEditName(meData.user.name || "");
          setEditBirthDate(meData.user.birthDate || "");
          setEditPhone(meData.user.phone || "");
          setEditHospitalName(meData.user.hospitalName || "");
          setEditProvince(meData.user.province || "");
        } else if (!meRes.ok) {
          setError(meData.error || "โหลดข้อมูลบัญชีไม่สำเร็จ");
        }

        if (usageData.ok && usageData.plan !== undefined) {
          setUsage({
            plan: usageData.plan,
            total: usageData.total ?? 0,
            used: usageData.used ?? 0,
            remaining: usageData.remaining ?? 0,
            tokenSpendThb: typeof usageData.tokenSpendThb === "number" ? usageData.tokenSpendThb : undefined,
            tokenBudgetThb: typeof usageData.tokenBudgetThb === "number" ? usageData.tokenBudgetThb : undefined,
            tokenRemainingThb:
              typeof usageData.tokenRemainingThb === "number" ? usageData.tokenRemainingThb : undefined,
            tokenUsagePercent:
              typeof usageData.tokenUsagePercent === "number" ? usageData.tokenUsagePercent : undefined,
            baseUsagePercent:
              typeof usageData.baseUsagePercent === "number" ? usageData.baseUsagePercent : undefined,
            daysLeftInMonth:
              typeof usageData.daysLeftInMonth === "number" ? usageData.daysLeftInMonth : undefined,
            nextCreditRefreshAt:
              typeof usageData.nextCreditRefreshAt === "string" ? usageData.nextCreditRefreshAt : null,
            subscriptionStatus: usageData.subscriptionStatus,
            nextPlanId: usageData.nextPlanId ?? null,
            nextPlanEffectiveDate: usageData.nextPlanEffectiveDate ?? null,
          });
        }

        if (reqData.ok && Array.isArray(reqData.requests)) {
          setRequests(reqData.requests);
        }
        if (notiData.ok && Array.isArray(notiData.notifications)) {
          setNotifications(notiData.notifications);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "โหลดข้อมูลไม่สำเร็จ");
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, [sessionStatus]);

  async function markAllNotificationsRead() {
    try {
      await fetch("/api/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ all: true }),
      });
      setNotifications((prev) =>
        prev.map((n) => (n.readAt ? n : { ...n, readAt: new Date().toISOString() }))
      );
    } catch {
      // ignore
    }
  }

  async function handleSaveProfile() {
    if (!user || saving) return;
    const phoneV = validateThaiPhone(editPhone);
    if (!phoneV.ok) {
      setPhoneError(phoneV.error);
      return;
    }
    setPhoneError(null);
    const bd = editBirthDate.trim();
    if (bd) {
      const bdErr = validateBirthDateBE(bd);
      if (bdErr) {
        setBirthDateError(bdErr);
        return;
      }
    }
    setBirthDateError(null);
    setSaving(true);
    setError(null);
    setSaveSuccess(null);
    try {
      const res = await fetch("/api/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editName.trim() || null,
          birthDate: bd || null,
          phone: phoneV.normalized || null,
          hospitalName: editHospitalName.trim() || null,
          province: editProvince || null,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string; user?: UserInfo };
      if (!res.ok || !data.ok || !data.user) throw new Error(data.error || "บันทึกไม่สำเร็จ");
      setUser(data.user);
      setEditName(data.user.name || "");
      setEditBirthDate(data.user.birthDate || "");
      setEditPhone(data.user.phone || "");
      setEditHospitalName(data.user.hospitalName || "");
      setEditProvince(data.user.province || "");
      setSaveSuccess("บันทึกข้อมูลแล้ว");
      window.setTimeout(() => setSaveSuccess(null), 2500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "บันทึกไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  }

  if (sessionStatus === "loading" || !session?.user) {
    return (
      <main className="min-h-screen bg-[#081120] text-slate-100 flex items-center justify-center">
        <p className="text-slate-400">กรุณาเข้าสู่ระบบ</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#081120] text-slate-100">
      <div className="mx-auto max-w-4xl px-4 py-8 space-y-6">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold text-white">ข้อมูลของฉัน</h1>
            <p className="mt-1 text-sm text-slate-300">
              ดูและแก้ไขข้อมูลบัญชี แพ็กเกจ และคำขอเปิดแพ็กเกจ
            </p>
          </div>
          <Link
            href="/app"
            className="rounded-2xl border border-slate-700 bg-slate-900/80 px-4 py-2 text-sm font-medium text-slate-100 transition hover:bg-slate-800"
          >
            ← กลับไปสรุปชาร์จ
          </Link>
        </header>
        {stripeSuccess ? (
          <div className="rounded-2xl border border-emerald-500/40 bg-emerald-950/30 px-4 py-3 text-sm text-emerald-200">
            ชำระเงินสำเร็จแล้ว ระบบกำลังซิงก์สิทธิ์ใช้งานล่าสุดให้บัญชีของคุณ
          </div>
        ) : null}
        {portalReturned ? (
          <div className="rounded-2xl border border-cyan-500/40 bg-cyan-950/30 px-4 py-3 text-sm text-cyan-200">
            กลับมาจาก Stripe Billing Portal แล้ว หากเพิ่งเปลี่ยนแพ็กเกจ กรุณารอสักครู่แล้วรีเฟรชหน้านี้
          </div>
        ) : null}

        <section className="rounded-3xl border border-cyan-500/25 bg-cyan-950/35 p-6">
          <h2 className="text-lg font-semibold text-white">การแนะนำหน้าสรุปชาร์จ</h2>
          <p className="mt-2 text-sm leading-relaxed text-slate-300">
            เคยจบหรือข้าม tutorial แล้วอยากลอง flow แบบทีละขั้นอีกครั้ง? กดด้านล่างแล้วไปที่หน้าสรุป Discharge
            — ระบบจะเปิดหน้าต่างแนะนำใหม่ (ไม่ต้องรอให้โหมดสาธิตขึ้นทุกครั้งที่เข้าเว็บ)
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link
              href="/app?replayTutorial=1"
              className="inline-flex items-center justify-center rounded-2xl bg-gradient-to-r from-cyan-600 to-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-cyan-950/30 transition hover:brightness-110"
            >
              เริ่ม tutorial อีกครั้ง
            </Link>
            <Link
              href="/app"
              className="inline-flex items-center justify-center rounded-2xl border border-slate-600 bg-slate-900/90 px-5 py-2.5 text-sm font-medium text-slate-200 hover:bg-slate-800"
            >
              ไปสรุปชาร์จโดยไม่เริ่ม tutorial
            </Link>
          </div>
        </section>

        <section className="rounded-3xl border border-white/10 bg-slate-950/50 p-6">
          <h2 className="text-lg font-semibold text-white">ชุดอ้างอิง (reference set)</h2>
          <p className="mt-2 break-words text-xs leading-relaxed text-slate-400">{REFERENCE_SET_NAME}</p>
          <p className="mt-2 text-xs text-slate-500">Last reviewed: {LAST_REVIEWED_DATE}</p>
          <p className="mt-3 text-sm text-slate-400">
            รายละเอียดทางกฎหมายและการอ้างอิง:{" "}
            <Link href="/legal" className="text-cyan-400 hover:underline">
              Reference &amp; Legal Notice
            </Link>
          </p>
        </section>

        {error ? (
          <div className="rounded-2xl border border-red-900/60 bg-red-950/40 px-4 py-3 text-sm text-red-200">
            {error}
          </div>
        ) : null}
        {saveSuccess ? (
          <div className="rounded-2xl border border-emerald-700/50 bg-emerald-950/25 px-4 py-3 text-sm text-emerald-200">
            {saveSuccess}
          </div>
        ) : null}

        {loading ? (
          <div className="text-sm text-slate-300">กำลังโหลด...</div>
        ) : (
          <div className="space-y-6">
            <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-6">
              <h2 className="text-lg font-semibold text-white">ข้อมูลบัญชี</h2>
              <div className="mt-4 space-y-4">
                <div>
                  <label className="text-xs text-slate-400">อีเมล</label>
                  <p className="mt-1 text-sm text-slate-100">{user?.email ?? "-"}</p>
                </div>
                <div>
                  <label className="text-xs text-slate-400">ชื่อที่แสดง</label>
                  <div className="mt-1 flex gap-2">
                    <input
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="flex-1 rounded-2xl border border-slate-700 bg-slate-950 px-4 py-2 text-sm text-slate-100 outline-none focus:border-cyan-500"
                      placeholder="ชื่อ"
                    />
                  </div>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="text-xs text-slate-400">เบอร์โทร</label>
                    <input
                      type="text"
                      value={editPhone}
                      onChange={(e) => {
                        setEditPhone(e.target.value);
                        if (phoneError) setPhoneError(null);
                      }}
                      onBlur={() => {
                        const v = validateThaiPhone(editPhone);
                        setPhoneError(v.ok ? null : v.error);
                        if (v.ok && v.normalized !== editPhone) setEditPhone(v.normalized);
                      }}
                      className={`mt-1 w-full rounded-2xl border px-4 py-2 text-sm text-slate-100 outline-none focus:border-cyan-500 ${
                        phoneError ? "border-red-500 bg-red-950/20" : "border-slate-700 bg-slate-950"
                      }`}
                      placeholder="เช่น 08x-xxx-xxxx"
                    />
                    {phoneError ? <p className="mt-1 text-xs text-red-400">{phoneError}</p> : null}
                  </div>
                  <div>
                    <label className="text-xs text-slate-400">วันเกิด (วว/ดด/ปี พ.ศ.)</label>
                    <input
                      type="text"
                      value={editBirthDate}
                      onChange={(e) => {
                        setEditBirthDate(e.target.value);
                        if (birthDateError) setBirthDateError(null);
                      }}
                      onBlur={() => {
                        const bd = editBirthDate.trim();
                        setBirthDateError(bd ? validateBirthDateBE(bd) : null);
                      }}
                      className={`mt-1 w-full rounded-2xl border px-4 py-2 text-sm text-slate-100 outline-none focus:border-cyan-500 ${
                        birthDateError ? "border-red-500 bg-red-950/20" : "border-slate-700 bg-slate-950"
                      }`}
                      placeholder="เช่น 15/8/2543"
                    />
                    {birthDateError ? (
                      <p className="mt-1 text-xs text-red-400">{birthDateError}</p>
                    ) : (
                      <p className="mt-1 text-[11px] text-slate-500">กรุณากรอกปี พ.ศ. เช่น 15/8/2543</p>
                    )}
                  </div>
                  <div>
                    <label className="text-xs text-slate-400">โรงพยาบาล / หน่วยงาน</label>
                    <input
                      type="text"
                      value={editHospitalName}
                      onChange={(e) => setEditHospitalName(e.target.value)}
                      className="mt-1 w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-2 text-sm text-slate-100 outline-none focus:border-cyan-500"
                      placeholder="ชื่อหน่วยงาน"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-400">จังหวัด</label>
                    <select
                      value={editProvince}
                      onChange={(e) => setEditProvince(e.target.value)}
                      className="mt-1 w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-2 text-sm text-slate-100 outline-none focus:border-cyan-500"
                    >
                      <option value="">-- เลือกจังหวัด --</option>
                      {THAI_PROVINCES.map((p) => (
                        <option key={p} value={p}>
                          {p}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="pt-1">
                  <button
                    type="button"
                    onClick={handleSaveProfile}
                    disabled={saving}
                    className="rounded-2xl bg-cyan-500 px-4 py-2 text-sm font-medium text-white hover:bg-cyan-600 disabled:opacity-50"
                  >
                    {saving ? "กำลังบันทึก..." : "บันทึกข้อมูล"}
                  </button>
                </div>
                <div className="flex gap-6">
                  <div>
                    <label className="text-xs text-slate-400">แผนปัจจุบัน</label>
                    <p className="mt-1 text-sm font-medium text-slate-100">
                      {formatPlanName(usage?.plan ?? user?.plan)}
                    </p>
                  </div>
                  <div>
                    <label className="text-xs text-slate-400">สถานะการใช้งาน (รอบปัจจุบัน)</label>
                    {usage ? (
                      <div className="mt-1">
                        <div className="flex items-center justify-between text-sm">
                          <p className="font-medium text-emerald-300">การใช้งานโควต้า</p>
                          <p className="font-semibold text-cyan-200">{usagePercent}%</p>
                        </div>
                        <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-800">
                          <div
                            className="h-full bg-cyan-400 transition-all"
                            style={{ width: `${usagePercent}%` }}
                          />
                        </div>
                        <div className="mt-3 flex items-center justify-between text-sm">
                          <p className="font-medium text-slate-300">เวลาในรอบ</p>
                          <p className="font-semibold text-violet-200">เหลือ {displayDaysLeft} วัน</p>
                        </div>
                      </div>
                    ) : (
                      <p className="mt-1 text-sm font-medium text-slate-400">-</p>
                    )}
                    {usage?.nextCreditRefreshAt ? (
                      <p className="mt-0.5 text-xs text-slate-500">
                        ระบบจะรีเซ็ตโควตาประมาณ{" "}
                        {new Date(usage.nextCreditRefreshAt).toLocaleString("th-TH", {
                          dateStyle: "short",
                          timeStyle: "short",
                        })}
                      </p>
                    ) : null}
                    {usage?.daysLeftInMonth !== undefined && (
                      <p className="mt-0.5 text-xs text-slate-500">
                        ระบบรีเซ็ตโควต้าตามรอบแพ็กเกจอัตโนมัติ
                      </p>
                    )}
                  </div>
                </div>
                {usage?.nextPlanId ? (
                  <div className="rounded-2xl border border-amber-600/40 bg-amber-950/20 px-4 py-3 text-sm text-amber-100">
                    มีการตั้งค่าเปลี่ยนแผนรอบถัดไปเป็น{" "}
                    <span className="font-semibold">{formatPlanName(usage.nextPlanId)}</span>
                    {usage.nextPlanEffectiveDate ? (
                      <>
                        {" "}
                        (มีผลวันที่ {new Date(usage.nextPlanEffectiveDate).toLocaleDateString("th-TH")})
                      </>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </section>

            <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-6">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="text-lg font-semibold text-white">Notification Center</h2>
                  <p className="mt-1 text-xs text-slate-400">แจ้งเตือนสถานะ feedback และเหตุการณ์สำคัญของบัญชี</p>
                </div>
                <button
                  type="button"
                  onClick={markAllNotificationsRead}
                  className="rounded-xl border border-slate-700 bg-slate-950/50 px-3 py-2 text-xs font-medium text-slate-200 hover:bg-slate-900/60"
                >
                  ทำเครื่องหมายว่าอ่านทั้งหมด
                </button>
              </div>
              {notifications.length === 0 ? (
                <div className="mt-4 text-xs text-slate-500">ยังไม่มีแจ้งเตือน</div>
              ) : (
                <div className="mt-4 space-y-2">
                  {notifications.map((n) => (
                    <div
                      key={n.id}
                      className={`rounded-2xl border px-4 py-3 text-sm ${
                        n.readAt
                          ? "border-slate-700 bg-slate-950/40 text-slate-200"
                          : "border-cyan-500/30 bg-cyan-950/20 text-slate-100"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-xs text-slate-400">{n.type}</div>
                          <div className="mt-0.5 font-medium">{n.title}</div>
                          <div className="mt-1 text-sm text-slate-300">{n.message}</div>
                        </div>
                        <div className="text-xs text-slate-500">
                          {new Date(n.createdAt).toLocaleString("th-TH")}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-6">
              <h2 className="text-lg font-semibold text-white">ประวัติ Billing / Payment</h2>
              <p className="mt-1 text-xs text-slate-400">
                รายการคำสั่งซื้อ/Stripe และสถานะ รวมราคาและบันทึกจากระบบ
              </p>
              {requests.length === 0 ? (
                <div className="mt-4 rounded-2xl border border-slate-700/60 bg-slate-950/40 px-4 py-6 text-center text-sm text-slate-400">
                  ยังไม่มีคำขอ
                </div>
              ) : (
                <div className="mt-4 overflow-x-auto rounded-2xl border border-slate-700/60">
                  <table className="min-w-full text-sm">
                    <thead className="bg-slate-900/80 text-left text-xs text-slate-400">
                      <tr>
                        <th className="px-4 py-3">วันที่</th>
                        <th className="px-4 py-3">ประเภท</th>
                        <th className="px-4 py-3">รายละเอียด</th>
                        <th className="px-4 py-3">ยอด</th>
                        <th className="px-4 py-3">สถานะ</th>
                        <th className="px-4 py-3">หมายเหตุ</th>
                      </tr>
                    </thead>
                    <tbody>
                      {requests.map((r) => (
                        <tr key={r.id} className="border-t border-slate-800/60 bg-slate-950/40">
                          <td className="px-4 py-3 text-slate-300">
                            {new Date(r.createdAt).toLocaleString("th-TH")}
                          </td>
                          <td className="px-4 py-3 text-slate-300">{r.type || "-"}</td>
                          <td className="px-4 py-3 font-medium text-slate-200">
                            {r.type === "addon" ? (
                              <>ซื้อ Boost เพิ่ม {r.addCredits ?? 0} หน่วย</>
                            ) : (
                              <>
                                {r.fromPlanId ? `${formatPlanName(r.fromPlanId)} -> ` : ""}
                                {formatPlanName(r.toPlanId || r.planRequested)}
                              </>
                            )}
                          </td>
                          <td className="px-4 py-3 text-slate-300">
                            {r.finalAmount != null
                              ? `${r.finalAmount.toLocaleString("th-TH")} บาท`
                              : r.quotedAmount != null
                              ? `${r.quotedAmount.toLocaleString("th-TH")} บาท`
                              : "-"}
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={`inline-flex rounded-full px-2 py-0.5 text-xs ${
                                r.status === "approved"
                                  ? "bg-emerald-500/20 text-emerald-300"
                                  : r.status === "rejected"
                                  ? "bg-red-500/20 text-red-300"
                                  : "bg-amber-500/20 text-amber-300"
                              }`}
                            >
                              {formatPaymentStatus(r.status)}
                            </span>
                            {r.reviewedAt ? (
                              <div className="mt-1 text-[11px] text-slate-500">
                                reviewed {new Date(r.reviewedAt).toLocaleString("th-TH")}
                              </div>
                            ) : null}
                          </td>
                          <td className="px-4 py-3 text-xs text-slate-400">
                            {r.rejectionReason || r.adminNote || "-"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <p className="mt-4">
                <Link href="/pricing" className="text-sm text-cyan-400 hover:underline">
                  ส่งคำขอเปิดแพ็กเกจ / อัปเกรด →
                </Link>
              </p>
            </section>
          </div>
        )}
      </div>
    </main>
  );
}
