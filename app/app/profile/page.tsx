"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import UsagePolicyCard from "@/app/components/UsagePolicyCard";
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
  extraCredits?: number;
  periodAllowancePercentUsed?: number | null;
  periodAllowanceReached?: boolean;
  periodAllowanceResetAt?: string | null;
  periodAllowanceGrandfathered?: boolean;
  periodAllowanceDisplayMode?: "ai_cost" | "legacy_units" | "not_applicable";
  approxSummaryCasesPerMonth?: { min: number; max: number } | null;
  periodEnd?: string | null;
  usagePolicyKnown?: boolean;
  boostPurchaseAvailable?: boolean;
  baseUsagePercent?: number;
  nextCreditRefreshAt?: string | null;
  daysLeftInMonth?: number;
  subscriptionStatus?: string;
  nextPlanId?: string | null;
  nextPlanEffectiveDate?: string | null;
  summaryUsedToday?: number;
  summaryDailyLimit?: number;
  trialSummaryUsed?: number | null;
  trialSummaryLimit?: number | null;
  trialSummaryRemaining?: number | null;
  nextDailyResetAt?: string;
};

type BillingState = {
  currentPlanId: string;
  pendingPlanId: string | null;
  pendingPlanEffectiveAt: string | null;
  cancelAtPeriodEnd: boolean;
  cancelAt: string | null;
  periodStartedAt: string | null;
  paidThroughAt: string | null;
  subscriptionStatus: string;
  hasSchedule: boolean;
  hasAppManagedSchedule: boolean;
  hasExternalSchedule: boolean;
};

const BILLING_PLAN_OPTIONS = [
  "basic_monthly",
  "standard_monthly",
  "pro_monthly",
  "basic_yearly",
  "standard_yearly",
  "pro_yearly",
];

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

type ReferralData = {
  referralCode: string | null;
  stats: { referredCount: number; firstPurchases: number; boostEarned: number };
  history: Array<{ id: string; status: string; signupAt: string; firstUsageAt: string | null; firstPurchaseAt: string | null; creditsEarned: number }>;
};

type ReferralLedgerItem = { id: string; amount: number; direction: string; createdAt: string };

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
  const [billingState, setBillingState] = useState<BillingState | null>(null);
  const [billingLoading, setBillingLoading] = useState(true);
  const [billingActionLoading, setBillingActionLoading] = useState(false);
  const [billingError, setBillingError] = useState<string | null>(null);
  const [billingNotice, setBillingNotice] = useState<string | null>(null);
  const [selectedPlanId, setSelectedPlanId] = useState("");
  const [referral, setReferral] = useState<ReferralData | null>(null);
  const [referralLedger, setReferralLedger] = useState<ReferralLedgerItem[]>([]);
  const [referralAlreadyClaimed, setReferralAlreadyClaimed] = useState(false);
  const [referralCodeInput, setReferralCodeInput] = useState("");
  const [referralLoading, setReferralLoading] = useState(true);
  const [referralSubmitting, setReferralSubmitting] = useState(false);
  const [referralError, setReferralError] = useState<string | null>(null);
  const [referralFeedback, setReferralFeedback] = useState<string | null>(null);

  async function refreshReferral() {
    setReferralLoading(true);
    setReferralError(null);
    try {
      const response = await fetch("/api/referral/me", { cache: "no-store" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.ok) throw new Error(data.error || "โหลดข้อมูลแนะนำเพื่อนไม่สำเร็จ");
      setReferral(data.referral as ReferralData);
      setReferralLedger(Array.isArray(data.ledger) ? data.ledger : []);
      setReferralAlreadyClaimed(data.alreadyClaimed === true);
    } catch (err) {
      setReferralError(err instanceof Error ? err.message : "โหลดข้อมูลแนะนำเพื่อนไม่สำเร็จ");
    } finally {
      setReferralLoading(false);
    }
  }
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
        const [meRes, usageRes, reqRes, notiRes, referralRes] = await Promise.all([
          fetch("/api/me"),
          fetch("/api/usage"),
          fetch("/api/me/requests"),
          fetch("/api/notifications?limit=50"),
          fetch("/api/referral/me", { cache: "no-store" }),
        ]);

        const meData = await meRes.json().catch(() => ({}));
        const usageData = await usageRes.json().catch(() => ({}));
        const reqData = await reqRes.json().catch(() => ({}));
        const notiData = await notiRes.json().catch(() => ({}));
        const referralData = await referralRes.json().catch(() => ({}));

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
            periodAllowancePercentUsed: typeof usageData.periodAllowancePercentUsed === "number" ? usageData.periodAllowancePercentUsed : null,
            periodAllowanceReached: usageData.periodAllowanceReached === true,
            periodAllowanceResetAt: typeof usageData.periodAllowanceResetAt === "string" ? usageData.periodAllowanceResetAt : null,
            periodAllowanceGrandfathered: usageData.periodAllowanceGrandfathered === true,
            periodAllowanceDisplayMode:
              usageData.periodAllowanceDisplayMode === "ai_cost" || usageData.periodAllowanceDisplayMode === "legacy_units"
                ? usageData.periodAllowanceDisplayMode
                : "not_applicable",
            approxSummaryCasesPerMonth: usageData.approxSummaryCasesPerMonth &&
              typeof usageData.approxSummaryCasesPerMonth.min === "number" &&
              typeof usageData.approxSummaryCasesPerMonth.max === "number"
              ? usageData.approxSummaryCasesPerMonth
              : null,
            periodEnd: typeof usageData.periodEnd === "string" ? usageData.periodEnd : null,
            baseUsagePercent:
              typeof usageData.baseUsagePercent === "number" ? usageData.baseUsagePercent : undefined,
            daysLeftInMonth:
              typeof usageData.daysLeftInMonth === "number" ? usageData.daysLeftInMonth : undefined,
            nextCreditRefreshAt:
              typeof usageData.nextCreditRefreshAt === "string" ? usageData.nextCreditRefreshAt : null,
            subscriptionStatus: usageData.subscriptionStatus,
            nextPlanId: usageData.nextPlanId ?? null,
            nextPlanEffectiveDate: usageData.nextPlanEffectiveDate ?? null,
            summaryUsedToday: typeof usageData.summaryUsedToday === "number" ? usageData.summaryUsedToday : undefined,
            summaryDailyLimit: typeof usageData.summaryDailyLimit === "number" ? usageData.summaryDailyLimit : undefined,
            trialSummaryUsed: typeof usageData.trialSummaryUsed === "number" ? usageData.trialSummaryUsed : null,
            trialSummaryLimit: typeof usageData.trialSummaryLimit === "number" ? usageData.trialSummaryLimit : null,
            trialSummaryRemaining: typeof usageData.trialSummaryRemaining === "number" ? usageData.trialSummaryRemaining : null,
            nextDailyResetAt: typeof usageData.nextDailyResetAt === "string" ? usageData.nextDailyResetAt : null,
          });
        }

        if (reqData.ok && Array.isArray(reqData.requests)) {
          setRequests(reqData.requests);
        }
        if (notiData.ok && Array.isArray(notiData.notifications)) {
          setNotifications(notiData.notifications);
        }
        if (referralRes.ok && referralData.ok) {
          setReferral(referralData.referral as ReferralData);
          setReferralLedger(Array.isArray(referralData.ledger) ? referralData.ledger : []);
          setReferralAlreadyClaimed(referralData.alreadyClaimed === true);
          setReferralError(null);
        } else {
          setReferralError(referralData.error || "โหลดข้อมูลแนะนำเพื่อนไม่สำเร็จ");
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "โหลดข้อมูลไม่สำเร็จ");
      } finally {
        setLoading(false);
        setReferralLoading(false);
      }
    }
    void load();
  }, [sessionStatus]);

  async function copyReferralCode() {
    const code = referral?.referralCode;
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code);
      setReferralFeedback("คัดลอกรหัสแนะนำแล้ว");
    } catch {
      setReferralFeedback("คัดลอกไม่สำเร็จ กรุณาเลือกและคัดลอกรหัสด้วยตนเอง");
    }
  }

  async function copyReferralLink() {
    const code = referral?.referralCode;
    if (!code) return;
    const inviteUrl = `https://dischargex.net/signup?ref=${encodeURIComponent(code)}`;
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setReferralFeedback("คัดลอกลิงก์ชวนเพื่อนแล้ว ส่งให้เพื่อนได้หลายคน");
    } catch {
      setReferralFeedback(`คัดลอกไม่สำเร็จ กรุณาคัดลอกลิงก์นี้: ${inviteUrl}`);
    }
  }

  async function submitReferralClaim(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setReferralSubmitting(true);
    setReferralError(null);
    setReferralFeedback(null);
    try {
      const response = await fetch("/api/referral/claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ referralCode: referralCodeInput }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.ok) throw new Error(data.error || "บันทึกรหัสแนะนำไม่สำเร็จ");
      setReferralAlreadyClaimed(true);
      setReferralCodeInput("");
      setReferralFeedback("บันทึกรหัสแนะนำแล้ว การกรอกรหัสยังไม่มีโบนัสทันที");
      await refreshReferral();
    } catch (err) {
      setReferralError(err instanceof Error ? err.message : "บันทึกรหัสแนะนำไม่สำเร็จ");
    } finally {
      setReferralSubmitting(false);
    }
  }

  useEffect(() => {
    if (sessionStatus !== "authenticated") return;
    let cancelled = false;
    setBillingLoading(true);
    fetch("/api/stripe/portal", { cache: "no-store" })
      .then(async (response) => {
        const data = (await response.json().catch(() => ({}))) as {
          ok?: boolean;
          error?: string;
          currentPlanId?: string;
          pendingPlanId?: string | null;
          pendingPlanEffectiveAt?: string | null;
          cancelAtPeriodEnd?: boolean;
          cancelAt?: string | null;
          periodStartedAt?: string | null;
          paidThroughAt?: string | null;
          subscriptionStatus?: string;
          hasSchedule?: boolean;
          hasAppManagedSchedule?: boolean;
          hasExternalSchedule?: boolean;
        };
        if (!response.ok || !data.ok) throw new Error(data.error || "โหลดสถานะ Billing ไม่สำเร็จ");
        if (cancelled) return;
        const nextState: BillingState = {
          currentPlanId: data.currentPlanId || user?.plan || "trial",
          pendingPlanId: data.pendingPlanId ?? null,
          pendingPlanEffectiveAt: data.pendingPlanEffectiveAt ?? null,
          cancelAtPeriodEnd: data.cancelAtPeriodEnd === true,
          cancelAt: data.cancelAt ?? null,
          periodStartedAt: data.periodStartedAt ?? null,
          paidThroughAt: data.paidThroughAt ?? null,
          subscriptionStatus: data.subscriptionStatus || "unknown",
          hasSchedule: data.hasSchedule === true,
          hasAppManagedSchedule: data.hasAppManagedSchedule === true,
          hasExternalSchedule: data.hasExternalSchedule === true,
        };
        setBillingState(nextState);
        setSelectedPlanId(nextState.currentPlanId);
        setBillingError(null);
      })
      .catch((err) => {
        if (!cancelled) setBillingError(err instanceof Error ? err.message : "โหลดสถานะ Billing ไม่สำเร็จ");
      })
      .finally(() => {
        if (!cancelled) setBillingLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [sessionStatus, user?.plan]);

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

  async function refreshBillingState() {
    const response = await fetch("/api/stripe/portal", { cache: "no-store" });
    const data = (await response.json().catch(() => ({}))) as BillingState & { ok?: boolean; error?: string };
    if (!response.ok || !data.ok) throw new Error(data.error || "โหลดสถานะ Billing ไม่สำเร็จ");
    setBillingState(data);
    setSelectedPlanId(data.currentPlanId || "trial");
  }

  async function handleSchedulePlanChange() {
    if (!billingState || !selectedPlanId || billingActionLoading) return;
    setBillingActionLoading(true);
    setBillingError(null);
    setBillingNotice(null);
    try {
      const response = await fetch("/api/stripe/plan-change", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId: selectedPlanId }),
      });
      const data = (await response.json().catch(() => ({}))) as { ok?: boolean; error?: string; message?: string };
      if (!response.ok || !data.ok) throw new Error(data.error || "ตั้งเวลาการเปลี่ยนแพ็กเกจไม่สำเร็จ");
      setBillingNotice(data.message || "กำหนดการเปลี่ยนแพ็กเกจในรอบถัดไปแล้ว");
      await refreshBillingState();
    } catch (err) {
      setBillingError(err instanceof Error ? err.message : "ตั้งเวลาการเปลี่ยนแพ็กเกจไม่สำเร็จ");
    } finally {
      setBillingActionLoading(false);
    }
  }

  async function handleManageRenewal() {
    if (!billingState || billingActionLoading) return;
    if (billingState.hasExternalSchedule) {
      setBillingError("มีตาราง subscription จากแหล่งอื่น กรุณาติดต่อทีมงานก่อนเปลี่ยนการต่ออายุ");
      return;
    }
    if (billingState.hasAppManagedSchedule) {
      const paidThrough = billingState.paidThroughAt
        ? new Date(billingState.paidThroughAt).toLocaleDateString("th-TH", { dateStyle: "long" })
        : "วันสิ้นสุดรอบที่แสดงในบัญชี";
      const confirmed = window.confirm(
        `ยืนยันยกเลิกการต่ออายุและยกเลิกแผนที่กำหนดไว้หรือไม่? คุณยังใช้แพ็กเกจปัจจุบันได้ถึง ${paidThrough}`
      );
      if (!confirmed) return;
      setBillingActionLoading(true);
      setBillingError(null);
      setBillingNotice(null);
      try {
        const response = await fetch("/api/stripe/cancel-renewal", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ confirm: true }),
        });
        const data = (await response.json().catch(() => ({}))) as { ok?: boolean; error?: string; paidThroughAt?: string };
        if (!response.ok || !data.ok) throw new Error(data.error || "ยกเลิกการต่ออายุไม่สำเร็จ");
        setBillingNotice(
          `ยกเลิกการต่ออายุแล้ว คุณยังใช้แพ็กเกจปัจจุบันได้ถึง ${data.paidThroughAt ? new Date(data.paidThroughAt).toLocaleDateString("th-TH", { dateStyle: "long" }) : paidThrough}`
        );
        await refreshBillingState();
      } catch (err) {
        setBillingError(err instanceof Error ? err.message : "ยกเลิกการต่ออายุไม่สำเร็จ");
      } finally {
        setBillingActionLoading(false);
      }
      return;
    }

    setBillingActionLoading(true);
    setBillingError(null);
    try {
      const response = await fetch("/api/stripe/portal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = (await response.json().catch(() => ({}))) as { ok?: boolean; error?: string; url?: string };
      if (!response.ok || !data.ok || !data.url) throw new Error(data.error || "เปิด Stripe Billing Portal ไม่สำเร็จ");
      window.location.assign(data.url);
    } catch (err) {
      setBillingError(err instanceof Error ? err.message : "เปิด Stripe Billing Portal ไม่สำเร็จ");
      setBillingActionLoading(false);
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
                <div className="mb-5 max-w-xl">
                  <p className="mb-2 text-xs text-slate-400">แผนปัจจุบัน</p>
                  <p className="mb-4 text-sm font-medium text-slate-100">{formatPlanName(usage?.plan ?? user?.plan)}</p>
                  <UsagePolicyCard
                    used={usage?.used ?? 0}
                    remaining={usage?.remaining ?? 0}
                    total={usage?.total ?? 0}
                    summaryUsedToday={usage?.summaryUsedToday}
                    summaryDailyLimit={usage?.summaryDailyLimit}
                    trialSummaryUsed={usage?.trialSummaryUsed}
                    trialSummaryLimit={usage?.trialSummaryLimit}
                    trialSummaryRemaining={usage?.trialSummaryRemaining}
                    summaryResetAt={usage?.nextDailyResetAt}
                    periodAllowanceResetAt={usage?.periodAllowanceResetAt}
                    periodEnd={usage?.periodEnd}
                    periodPercentUsed={usage?.periodAllowancePercentUsed}
                    allowanceDisplayMode={usage?.periodAllowanceDisplayMode ?? "not_applicable"}
                    approxCasesPerMonth={usage?.approxSummaryCasesPerMonth ?? null}
                    grandfathered={usage?.periodAllowanceGrandfathered === true}
                    boostCredits={usage?.extraCredits ?? 0}
                    active={usage?.subscriptionStatus === "active" || usage?.subscriptionStatus === "pending_change"}
                    canPurchaseBoost={usage?.boostPurchaseAvailable === true}
                  />
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

            <section className="rounded-3xl border border-violet-500/20 bg-slate-900/60 p-6">
              <h2 className="text-lg font-semibold text-white">แนะนำเพื่อน</h2>
              <p className="mt-2 text-sm text-slate-300">ส่งลิงก์นี้ให้เพื่อนได้หลายคน รับ Boost 10 สิทธิ์ต่อเพื่อน เมื่อเพื่อนซื้อแพ็กเกจครั้งแรกสำเร็จ (สมัครหรือทดลองฟรียังไม่ได้โบนัส)</p>
              <p className="mt-1 text-xs text-slate-400">ใช้ Boost ได้ขณะแพ็กเกจแบบชำระเงินยังใช้งานอยู่</p>

              {referralLoading ? <p className="mt-4 text-sm text-slate-400">กำลังโหลดข้อมูลแนะนำเพื่อน…</p> : null}
              {!referralLoading && referral?.referralCode ? (
                <div className="mt-4 flex flex-wrap items-center gap-3">
                  <span className="rounded-xl border border-violet-400/30 bg-slate-950 px-4 py-2 font-mono text-lg tracking-wider text-violet-100">{referral.referralCode}</span>
                  <button type="button" onClick={() => void copyReferralCode()} className="rounded-xl border border-violet-400/40 px-3 py-2 text-sm text-violet-100 hover:bg-violet-950/40">คัดลอกรหัส</button>
                  <button type="button" onClick={() => void copyReferralLink()} className="rounded-xl bg-violet-600 px-3 py-2 text-sm font-medium text-white hover:bg-violet-500">คัดลอกลิงก์ชวนเพื่อน</button>
                </div>
              ) : null}

              {!referralLoading && !referralAlreadyClaimed ? (
                <form onSubmit={submitReferralClaim} className="mt-5 flex flex-wrap items-end gap-3">
                  <label className="text-sm text-slate-300">มีรหัสจากเพื่อน?
                    <input value={referralCodeInput} onChange={(event) => setReferralCodeInput(event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 32))} maxLength={32} autoComplete="off" className="mt-1 block w-64 rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 font-mono text-white" placeholder="กรอกรหัสแนะนำ" />
                  </label>
                  <button type="submit" disabled={referralSubmitting || referralCodeInput.length < 2} className="rounded-xl bg-violet-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{referralSubmitting ? "กำลังบันทึก…" : "บันทึกรหัส"}</button>
                  <span className="basis-full text-xs text-slate-400">การกรอกรหัสเพียงอย่างเดียวไม่ให้โบนัส</span>
                </form>
              ) : referralAlreadyClaimed ? <p className="mt-4 text-sm text-slate-400">บัญชีนี้บันทึกรหัสแนะนำแล้ว</p> : null}

              {referral ? <>
                <div className="mt-5 grid gap-3 sm:grid-cols-3">
                  <div className="rounded-xl border border-white/10 bg-slate-950/60 p-3"><p className="text-xs text-slate-400">เพื่อนที่แนะนำ</p><p className="mt-1 font-semibold text-white">{referral.stats.referredCount}</p></div>
                  <div className="rounded-xl border border-white/10 bg-slate-950/60 p-3"><p className="text-xs text-slate-400">ซื้อแพ็กเกจครั้งแรก</p><p className="mt-1 font-semibold text-white">{referral.stats.firstPurchases}</p></div>
                  <div className="rounded-xl border border-white/10 bg-slate-950/60 p-3"><p className="text-xs text-slate-400">Boost ที่ได้รับสะสม</p><p className="mt-1 font-semibold text-white">{referral.stats.boostEarned} สิทธิ์</p></div>
                </div>
                {referralLedger.length > 0 ? <div className="mt-4">
                  <h3 className="text-sm font-medium text-slate-200">รายการโบนัสแนะนำเพื่อนล่าสุด</h3>
                  <ul className="mt-2 divide-y divide-white/10 text-sm text-slate-300">
                    {referralLedger.slice(0, 8).map((item) => <li key={item.id} className="flex justify-between gap-4 py-2"><span>Boost {item.direction === "minus" ? "ปรับลด" : "ได้รับ"} {item.amount} สิทธิ์</span><time className="text-slate-500">{new Date(item.createdAt).toLocaleString("th-TH")}</time></li>)}
                  </ul>
                </div> : null}
              </> : null}
              {referralError ? <p role="alert" className="mt-3 text-sm text-red-300">{referralError}</p> : null}
              {referralFeedback ? <p role="status" className="mt-3 text-sm text-emerald-300">{referralFeedback}</p> : null}
            </section>

            <section className="rounded-3xl border border-cyan-500/20 bg-slate-900/60 p-6">
              <h2 className="text-lg font-semibold text-white">แพ็กเกจและการต่ออายุ</h2>
              {billingLoading ? (
                <p className="mt-3 text-sm text-slate-400">กำลังโหลดสถานะจาก Stripe…</p>
              ) : billingState ? (
                <div className="mt-4 space-y-4">
                  <div className="flex flex-wrap gap-x-8 gap-y-2 text-sm">
                    <p className="text-slate-300">แพ็กเกจปัจจุบัน: <span className="font-semibold text-white">{formatPlanName(billingState.currentPlanId)}</span></p>
                    <p className="text-slate-300">ใช้ได้ถึง: <span className="font-semibold text-white">{billingState.paidThroughAt ? new Date(billingState.paidThroughAt).toLocaleDateString("th-TH", { dateStyle: "long" }) : "ยังไม่พบข้อมูลรอบชำระ"}</span></p>
                  </div>
                  {billingState.pendingPlanId ? (
                    <p className="rounded-xl border border-amber-500/30 bg-amber-950/20 p-3 text-sm text-amber-100">
                      เปลี่ยนเป็น {formatPlanName(billingState.pendingPlanId)} ในรอบถัดไป วันที่ {billingState.pendingPlanEffectiveAt ? new Date(billingState.pendingPlanEffectiveAt).toLocaleDateString("th-TH", { dateStyle: "long" }) : "ตามรอบถัดไป"} — แพ็กเกจปัจจุบันยังคงใช้ได้จนถึงวันดังกล่าว
                    </p>
                  ) : null}
                  {billingState.cancelAtPeriodEnd ? (
                    <p className="rounded-xl border border-amber-500/30 bg-amber-950/20 p-3 text-sm text-amber-100">
                      ปิดการต่ออายุแล้ว คุณยังใช้แพ็กเกจได้จนถึง {billingState.paidThroughAt ? new Date(billingState.paidThroughAt).toLocaleDateString("th-TH", { dateStyle: "long" }) : "วันสิ้นสุดรอบที่ชำระแล้ว"}
                    </p>
                  ) : null}
                  <div className="flex flex-wrap items-end gap-3">
                    {!billingState.cancelAtPeriodEnd && !billingState.hasExternalSchedule ? (
                      <>
                        <label className="text-sm text-slate-300">
                          เปลี่ยนแพ็กเกจรอบถัดไป
                          <select value={selectedPlanId || billingState.currentPlanId} onChange={(event) => setSelectedPlanId(event.target.value)} disabled={billingActionLoading || billingState.hasSchedule || billingState.hasExternalSchedule} className="mt-1 block rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-white">
                            {BILLING_PLAN_OPTIONS.map((planId) => <option key={planId} value={planId}>{formatPlanName(planId)}</option>)}
                          </select>
                        </label>
                        <button type="button" onClick={handleSchedulePlanChange} disabled={billingActionLoading || billingState.hasSchedule || !selectedPlanId || selectedPlanId === billingState.currentPlanId} className="rounded-xl bg-cyan-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
                          {billingActionLoading ? "กำลังดำเนินการ…" : "เปลี่ยนแผนรอบถัดไป"}
                        </button>
                      </>
                    ) : null}
                    {!billingState.cancelAtPeriodEnd ? (
                      <button type="button" onClick={handleManageRenewal} disabled={billingActionLoading || billingState.hasExternalSchedule} className="rounded-xl border border-slate-600 px-4 py-2 text-sm font-medium text-slate-100 disabled:opacity-50">
                        {billingState.hasAppManagedSchedule ? "ยกเลิกการต่ออายุและแผนที่ตั้งไว้" : "จัดการการต่ออายุ / วิธีชำระเงิน"}
                      </button>
                    ) : null}
                    {billingState.cancelAtPeriodEnd && !billingState.hasSchedule ? (
                      <button type="button" onClick={handleManageRenewal} disabled={billingActionLoading} className="rounded-xl border border-slate-600 px-4 py-2 text-sm text-slate-100 disabled:opacity-50">จัดการการชำระเงินใน Stripe</button>
                    ) : null}
                  </div>
                  {billingState.hasExternalSchedule ? <p className="text-sm text-amber-200">มีการเปลี่ยน subscription ที่ตั้งไว้นอก DischargeX จึงปิดการแก้ไขอัตโนมัติเพื่อป้องกันการเปลี่ยนแปลงทับกัน กรุณาติดต่อทีมงาน</p> : null}
                  <p className="text-xs text-slate-500">การเปลี่ยนแผนมีผลเมื่อเริ่มรอบที่ชำระเงินถัดไป ไม่มีการคิดเงินหรือเปลี่ยนสิทธิ์ทันที</p>
                  {billingNotice ? <p role="status" className="text-sm text-emerald-300">{billingNotice}</p> : null}
                  {billingError ? <p role="alert" className="text-sm text-rose-300">{billingError}</p> : null}
                </div>
              ) : (
                <div className="mt-3 space-y-2 text-sm text-slate-400"><p>ยังโหลดสถานะ Billing ไม่ได้</p><button type="button" onClick={() => void refreshBillingState().catch((err) => setBillingError(err instanceof Error ? err.message : "โหลดไม่สำเร็จ"))} className="text-cyan-300 underline">ลองโหลดอีกครั้ง</button></div>
              )}
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
                              <>ซื้อ Boost {r.addCredits ?? 0} สิทธิ์</>
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
