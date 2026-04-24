"use client";

import React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";

const ADD_CREDIT_OPTIONS = [
  { credits: 40, price: 89, label: "Boost Chat/Summary S: ประมาณ 40 หน่วยเสริม (89฿ / 7 วัน)" },
  { credits: 120, price: 199, label: "Boost Chat/Summary M: ประมาณ 120 หน่วยเสริม (199฿ / 7 วัน)" },
] as const;

const PLAN_SELECT_OPTIONS = {
  monthly: [
    { value: "basic_monthly", label: "Basic Monthly (299฿ / 30 วัน) — โปรโมชั่นช่วงแรก" },
    { value: "standard_monthly", label: "Standard Monthly (590฿ / 30 วัน) — แนะนำ" },
    { value: "pro_monthly", label: "Pro Monthly (1,090฿ / 30 วัน)" },
  ],
  yearly: [
    { value: "basic_yearly", label: "Basic Yearly (2,990฿ / ปี) — เฉลี่ยประมาณ 249฿/เดือน" },
    { value: "standard_yearly", label: "Standard Yearly (5,990฿ / ปี) — เฉลี่ยประมาณ 499฿/เดือน" },
    { value: "pro_yearly", label: "Pro Yearly (10,990฿ / ปี) — เฉลี่ยประมาณ 916฿/เดือน" },
  ],
} as const;

function billingViewFromPlanId(planId: string): "monthly" | "yearly" {
  return planId.endsWith("_yearly") ? "yearly" : "monthly";
}

function tierToPlanId(tier: "basic" | "standard" | "pro", billing: "monthly" | "yearly") {
  return `${tier}_${billing === "yearly" ? "yearly" : "monthly"}` as
    | "basic_monthly"
    | "basic_yearly"
    | "standard_monthly"
    | "standard_yearly"
    | "pro_monthly"
    | "pro_yearly";
}

function MobilePlanPicker(props: {
  id: string;
  value: string;
  onChange: (planId: string) => void;
}) {
  return (
    <div className="space-y-1">
      <label htmlFor={props.id} className="text-xs font-medium text-slate-300">
        เลือกแพ็กเกจ
      </label>
      <select
        id={props.id}
        value={props.value}
        onChange={(e) => props.onChange(e.target.value)}
        className="w-full rounded-2xl border border-slate-600 bg-slate-950 px-3 py-3 text-sm text-slate-100 outline-none focus:border-cyan-500"
      >
        <optgroup label="ทดลองใช้ (ไม่ชำระผ่าน Stripe)">
          <option value="__trial" disabled>
            Trial 0฿ — ~20 แชท/วัน · ~2 สรุปชาร์จ/วัน · ทดลอง 14 วัน (สมัครแล้วใช้ได้)
          </option>
        </optgroup>
        <optgroup label="รายเดือน">
          {PLAN_SELECT_OPTIONS.monthly.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </optgroup>
        <optgroup label="รายปี">
          {PLAN_SELECT_OPTIONS.yearly.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </optgroup>
      </select>
    </div>
  );
}

function PricingPageContent() {
  const searchParams = useSearchParams();
  const { data: session, status: sessionStatus } = useSession();
  const isLoggedIn = sessionStatus === "authenticated" && !!session?.user?.email;

  const [billingView, setBillingView] = React.useState<"monthly" | "yearly">("monthly");
  const [submitError, setSubmitError] = React.useState<string | null>(null);
  const [stripeLoading, setStripeLoading] = React.useState(false);
  const [requestType, setRequestType] = React.useState<"plan" | "add_credits">("plan");
  const [selectedPlanRequested, setSelectedPlanRequested] = React.useState<string>("standard_monthly");
  const [quote, setQuote] = React.useState<{
    paymentType: string;
    quotedAmount: number | null;
    finalAmount: number | null;
    remainingValue: number | null;
    remainingDays: number | null;
    fromPlanId: string | null;
    toPlanId: string | null;
  } | null>(null);
  const [quoteError, setQuoteError] = React.useState<string | null>(null);
  const [checkoutStatus, setCheckoutStatus] = React.useState<{
    state: "idle" | "loading" | "confirmed" | "pending" | "failed";
    message: string | null;
  }>({ state: "idle", message: null });

  const [addCreditsOption, setAddCreditsOption] = React.useState(0);
  const submitSuccess =
    searchParams.get("stripe") === "success" || searchParams.get("status") === "success";
  const submitCancelled = searchParams.get("stripe") === "cancel";
  const hasPlan = (session?.user as { plan?: string } | undefined)?.plan;
  const isExistingPlan = hasPlan && hasPlan !== "trial";
  const defaultPlanRequested = billingView === "yearly" ? "standard_yearly" : "standard_monthly";
  const selectedPlanTier = selectedPlanRequested.startsWith("basic")
    ? "basic"
    : selectedPlanRequested.startsWith("pro")
    ? "pro"
    : "standard";

  function applyPlanFromPicker(planId: string) {
    setBillingView(billingViewFromPlanId(planId));
    setSelectedPlanRequested(planId);
  }

  React.useEffect(() => {
    setSelectedPlanRequested(defaultPlanRequested);
  }, [defaultPlanRequested]);

  React.useEffect(() => {
    if (!submitSuccess || !isLoggedIn) {
      setCheckoutStatus({ state: "idle", message: null });
      return;
    }

    let cancelled = false;
    const controller = new AbortController();
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    let attempts = 0;
    const maxAttempts = 6;

    setCheckoutStatus({
      state: "loading",
      message: "กำลังตรวจสอบสถานะการชำระเงินกับระบบสมาชิก...",
    });

    const checkUsage = () => {
      attempts += 1;
      fetch("/api/usage", { cache: "no-store", signal: controller.signal })
        .then(async (response) => {
          const text = await response.text();
          const data = text ? (JSON.parse(text) as Record<string, unknown>) : {};
          if (!response.ok || !data.ok) {
            throw new Error(
              typeof data.error === "string" ? data.error : "ตรวจสอบสถานะการชำระเงินไม่สำเร็จ"
            );
          }
          if (cancelled) return;

          const status = String(data.subscriptionStatus || "");
          const plan = String(data.plan || "");
          const remaining = Number(data.remaining || 0);
          const isProvisioned =
            status === "active" || (plan !== "trial" && Number.isFinite(remaining) && remaining > 0);

          if (isProvisioned) {
            setCheckoutStatus({
              state: "confirmed",
              message: "สิทธิ์ใช้งานถูกอัปเดตแล้ว คุณเริ่มใช้งานต่อได้ทันที",
            });
            return;
          }

          if (attempts < maxAttempts) {
            setCheckoutStatus({
              state: "loading",
              message: `กำลังรอ backend อัปเดตสิทธิ์ล่าสุด... (รอบที่ ${attempts}/${maxAttempts})`,
            });
            retryTimer = setTimeout(checkUsage, 4000);
            return;
          }

          setCheckoutStatus({
            state: "pending",
            message:
              "Stripe รับชำระสำเร็จแล้ว แต่ระบบสมาชิกยังอัปเดตไม่เสร็จ หากเพิ่งชำระไปให้รอสักครู่แล้วรีเฟรชอีกครั้ง",
          });
        })
        .catch((error) => {
          if (cancelled || String(error?.name || "") === "AbortError") return;
          setCheckoutStatus({
            state: "failed",
            message:
              error instanceof Error
                ? error.message
                : "ตรวจสอบสถานะการชำระเงินไม่สำเร็จ กรุณาลองรีเฟรชอีกครั้ง",
          });
        });
    };
    checkUsage();

    return () => {
      cancelled = true;
      if (retryTimer) clearTimeout(retryTimer);
      controller.abort();
    };
  }, [submitSuccess, isLoggedIn]);

  React.useEffect(() => {
    if (!isLoggedIn) return;
    setQuoteError(null);
    setQuote(null);
    const controller = new AbortController();
    const sp = new URLSearchParams();
    if (requestType === "add_credits") {
      sp.set("addCredits", String(ADD_CREDIT_OPTIONS[addCreditsOption].credits));
    } else {
      sp.set("planRequested", selectedPlanRequested);
    }
    fetch(`/api/billing/quote?${sp.toString()}`, { signal: controller.signal })
      .then(async (r) => {
        const text = await r.text();
        const data = (text ? JSON.parse(text) : {}) as { ok?: boolean; error?: string };
        if (!r.ok || !data.ok) throw new Error(data.error || `คำนวณราคาไม่สำเร็จ (${r.status})`);
        return data as unknown;
      })
      .then((data) => {
        const d = (data ?? {}) as Record<string, unknown>;
        setQuote({
          paymentType: String(d.paymentType || "-"),
          quotedAmount: typeof d.quotedAmount === "number" ? d.quotedAmount : null,
          finalAmount: typeof d.finalAmount === "number" ? d.finalAmount : null,
          remainingValue: typeof d.remainingValue === "number" ? d.remainingValue : null,
          remainingDays: typeof d.remainingDays === "number" ? d.remainingDays : null,
          fromPlanId: typeof d.fromPlanId === "string" ? d.fromPlanId : null,
          toPlanId: typeof d.toPlanId === "string" ? d.toPlanId : null,
        });
      })
      .catch((e) => {
        if (String(e?.name || "") === "AbortError") return;
        setQuoteError(e instanceof Error ? e.message : "คำนวณราคาไม่สำเร็จ");
      });
    return () => controller.abort();
  }, [isLoggedIn, requestType, addCreditsOption, selectedPlanRequested]);

  async function startStripeCheckout() {
    setSubmitError(null);
    setStripeLoading(true);
    try {
      const payload =
        requestType === "add_credits"
          ? { addCredits: ADD_CREDIT_OPTIONS[addCreditsOption].credits }
          : { planRequested: selectedPlanRequested };
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string; checkoutUrl?: string };
      if (!res.ok || !data.ok || !data.checkoutUrl) {
        throw new Error(data.error || "เริ่มชำระเงินด้วยบัตรไม่สำเร็จ");
      }
      window.location.href = data.checkoutUrl;
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "เริ่มชำระเงินด้วยบัตรไม่สำเร็จ");
    } finally {
      setStripeLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#081120] text-slate-100">
      <div className="mx-auto max-w-5xl px-4 py-10 space-y-8">
        {submitCancelled && (
          <div className="rounded-3xl border border-amber-500/40 bg-amber-950/25 p-5 text-center">
            <h2 className="text-lg font-semibold text-amber-200">ยกเลิกการชำระเงิน</h2>
            <p className="mt-2 text-sm text-slate-300">
              ยังไม่มีการตัดเงินจาก Stripe คุณสามารถตรวจสอบแพ็กเกจแล้วกดชำระใหม่ได้ทันที
            </p>
          </div>
        )}
        {submitSuccess && (
          <div className="rounded-3xl border border-emerald-500/50 bg-emerald-950/30 p-6 text-center">
            <h2 className="text-xl font-semibold text-emerald-300">ชำระเงินสำเร็จ</h2>
            <p className="mt-2 text-sm text-slate-300">
              ระบบจะอัปเดตแพ็กเกจและโควตาจาก Stripe อัตโนมัติภายไม่กี่นาที
              <br />
              หากยังไม่เห็นการเปลี่ยนแปลง ลองรีเฟรชหน้าแอปหรือล็อกอินใหม่
            </p>
            <div
              className={`mt-4 rounded-2xl px-4 py-3 text-sm ${
                checkoutStatus.state === "confirmed"
                  ? "border border-emerald-500/40 bg-emerald-900/20 text-emerald-100"
                  : checkoutStatus.state === "failed"
                  ? "border border-rose-500/40 bg-rose-900/20 text-rose-100"
                  : "border border-amber-500/40 bg-amber-900/20 text-amber-100"
              }`}
            >
              <div className="font-medium">
                {checkoutStatus.state === "confirmed"
                  ? "ยืนยันจากระบบสมาชิกแล้ว"
                  : checkoutStatus.state === "failed"
                  ? "ตรวจสอบสถานะล่าสุดไม่สำเร็จ"
                  : "กำลังตรวจสอบสถานะล่าสุดจาก backend"}
              </div>
              <div className="mt-1 text-xs text-current/90">
                {checkoutStatus.message ||
                  "ระบบกำลังตรวจสอบสิทธิ์ใช้งานล่าสุดจากฝั่ง server เพื่อยืนยันผลหลังชำระเงิน"}
              </div>
            </div>
            <div className="mt-5 flex flex-wrap justify-center gap-3">
              <Link
                href="/app"
                className="rounded-2xl bg-cyan-500 px-5 py-2.5 text-sm font-medium text-white hover:bg-cyan-600"
              >
                ไปหน้าสรุปชาร์จ
              </Link>
              <Link
                href="/"
                className="rounded-2xl border border-slate-600 bg-slate-800/80 px-5 py-2.5 text-sm font-medium text-slate-200 hover:bg-slate-700"
              >
                ไปหน้าแรก
              </Link>
            </div>
          </div>
        )}

        <section className="rounded-2xl border border-white/5 bg-white/[0.02] p-6 md:p-8">
          <h1 className="text-3xl font-semibold tracking-tight text-white md:text-4xl">
            เลือกแพ็กเกจตามปริมาณงาน
          </h1>
          <p className="mt-3 max-w-2xl text-sm text-slate-400 md:text-base">
            โปรโมชั่นช่วงเปิดตัว: จ่ายแบบรายเดือนหรือรายปี — ตัวเลขต่อวันด้านล่างเป็น{" "}
            <span className="text-slate-300">เพดาน Fair Use โดยประมาณ</span> (ไม่ได้รับประกันจำนวนข้อความต่อเดือน)
            และยังมี <span className="text-slate-300">เพดานการใช้งานรายเดือน</span> ของระบบแยกต่างหาก
          </p>
          <p className="mt-2 text-xs text-slate-500">
            ราคาอัปเดตล่าสุดในหน้านี้เสมอ — หากมีแคมเปญใหม่ ระบบจะแสดงที่หน้านี้ก่อนช่องทางอื่น
          </p>

          <div className="mt-8 rounded-2xl border border-cyan-500/20 bg-cyan-950/15 p-5 md:p-6">
            <h2 className="text-lg font-semibold text-cyan-100">มากกว่าการสรุปข้อความ</h2>
            <p className="mt-3 text-sm leading-relaxed text-slate-300">
              ทุกแพ็กเกจช่วยให้คุณสรุปเคสได้เร็วขึ้น พร้อมตัวช่วยค้นหา diagnosis/procedure ที่อาจตกหล่น
              และแสดงจุดที่ควรทบทวนก่อนนำไปใช้จริง
            </p>
            <p className="mt-2 text-xs leading-relaxed text-slate-500">
              หมายเหตุ: DischargeX เป็นเครื่องมือช่วยทบทวนและประเมินเชิงสนับสนุน ไม่ใช่การรับรองผลการเบิกจ่าย
              และควรมีผู้ใช้งานตรวจสอบข้อมูลก่อนเสมอ
            </p>
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <span className="text-xs font-medium text-slate-400">มุมมองราคา</span>
            <div className="inline-flex rounded-full border border-slate-600 bg-slate-900/60 p-1">
              <button
                type="button"
                onClick={() => setBillingView("monthly")}
                className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
                  billingView === "monthly" ? "bg-white/10 text-white" : "text-slate-300 hover:text-white"
                }`}
              >
                รายเดือน
              </button>
              <button
                type="button"
                onClick={() => setBillingView("yearly")}
                className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
                  billingView === "yearly" ? "bg-white/10 text-white" : "text-slate-300 hover:text-white"
                }`}
              >
                รายปี
              </button>
            </div>
            <span className="text-[11px] text-slate-500">
              รายปี = จ่ายล่วงหน้า 365 วัน และประหยัดกว่ารายเดือนโดยเฉลี่ย
            </span>
          </div>

          <div className="mt-4 md:hidden">
            <MobilePlanPicker
              id="pricing-plan-mobile-hero"
              value={selectedPlanRequested}
              onChange={applyPlanFromPicker}
            />
            <p className="mt-1 text-[11px] text-slate-500">
              เลือกแพ็กจากรายการนี้ได้ทันที — ไม่ต้องเลื่อนลงไปที่ชำระเงิน
            </p>
          </div>

          <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5 shadow-sm transition hover:border-white/15">
              <h2 className="text-lg font-semibold text-white">Trial</h2>
              <p className="mt-1 text-sm text-slate-400">ลองก่อน ตัดสินใจทีหลัง</p>
              <p className="mt-4 text-3xl font-bold text-white">0฿</p>
              <p className="text-xs text-slate-400">ทดลองใช้ฟรี 14 วัน (ใช้งานเต็มช่วงทดลอง)</p>
              <ul className="mt-4 space-y-2 text-sm text-slate-200">
                <li>- ไม่มีผูกมัด</li>
                <li>- ใช้ได้ 1 ครั้งต่อบัญชี</li>
                <li>- จำกัด Fair Use: AI Chat ~20 ครั้ง/วัน · สรุปชาร์จ ~2 เคส/วัน</li>
                <li>- มีเพดานการใช้งานรายเดือนของระบบ (โควตา token โดยประมาณ)</li>
              </ul>
            </div>

            <div
              role="button"
              tabIndex={0}
              onClick={() => applyPlanFromPicker(tierToPlanId("basic", billingView))}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  applyPlanFromPicker(tierToPlanId("basic", billingView));
                }
              }}
              className={`cursor-pointer rounded-2xl p-5 text-left shadow-sm transition ${
                selectedPlanTier === "basic"
                  ? "border-2 border-cyan-400/70 bg-cyan-500/15 ring-2 ring-cyan-400/20"
                  : "border border-white/10 bg-white/[0.04] hover:border-white/15"
              }`}
            >
              <h2 className="text-lg font-semibold text-white">Basic</h2>
              <p className="mt-1 text-sm text-slate-400">ช่วยคิด diagnosis</p>
              <p className="mt-4 text-3xl font-bold text-white">
                {billingView === "yearly" ? "2,990฿" : "299฿"}
              </p>
              <p className="text-xs text-slate-400">
                {billingView === "yearly"
                  ? "เฉลี่ยประมาณ 249฿/เดือน · ใช้งานได้ต่อเนื่อง 365 วัน"
                  : "ใช้งานแบบรายเดือน 30 วัน"}
              </p>
              <ul className="mt-4 space-y-2 text-sm text-slate-200">
                <li>- AI Chat ~40 ครั้ง/วัน (1 ครั้ง = ส่งข้อความแล้วได้คำตอบจาก AI 1 ครั้ง)</li>
                <li>- สร้างสรุปชาร์จได้ประมาณ 4 เคส/วัน</li>
                <li>- Principal / Comorbidity / Complication</li>
                <li>- แนะนำ ICD-10 / ICD-9</li>
                <li>- เหมาะสำหรับเริ่มใช้งานจริง</li>
              </ul>
            </div>

            <div
              role="button"
              tabIndex={0}
              onClick={() => applyPlanFromPicker(tierToPlanId("standard", billingView))}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  applyPlanFromPicker(tierToPlanId("standard", billingView));
                }
              }}
              className={`relative cursor-pointer rounded-2xl p-5 text-left shadow-sm transition ${
                selectedPlanTier === "standard"
                  ? "border-2 border-cyan-400/70 bg-cyan-500/15 shadow-lg shadow-cyan-900/30 ring-2 ring-cyan-400/20"
                  : "border border-white/10 bg-white/[0.04] hover:border-white/15"
              }`}
            >
              <span className="absolute -top-2.5 right-4 rounded-full bg-cyan-500 px-3 py-0.5 text-xs font-semibold text-white shadow">
                แนะนำ
              </span>
              <h2 className="text-lg font-semibold text-white">Standard</h2>
              <p className="mt-1 text-sm text-cyan-100">ครบ ใช้จริงทุกวัน — แพ็กหลักสำหรับทำสรุปชาร์จ</p>
              <p className="mt-4 text-3xl font-bold text-white">
                {billingView === "yearly" ? "5,990฿" : "590฿"}
              </p>
              <p className="text-xs text-cyan-200/90">
                {billingView === "yearly"
                  ? "เฉลี่ยประมาณ 499฿/เดือน · ใช้งานได้ต่อเนื่อง 365 วัน"
                  : "ใช้งานแบบรายเดือน 30 วัน"}
              </p>
              <ul className="mt-4 space-y-2 text-sm text-slate-100">
                <li>- AI Chat ~140 ครั้ง/วัน (1 ครั้ง = ส่งข้อความแล้วได้คำตอบจาก AI 1 ครั้ง)</li>
                <li>- สร้างสรุปชาร์จได้ประมาณ 14 เคส/วัน</li>
                <li>- Diagnosis ครบ + Admit / Discharge</li>
                <li>- Investigations, Treatment, Outcome, Home medication</li>
                <li>- เหมาะสำหรับทำสรุปชาร์จจริง</li>
              </ul>
            </div>

            <div
              role="button"
              tabIndex={0}
              onClick={() => applyPlanFromPicker(tierToPlanId("pro", billingView))}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  applyPlanFromPicker(tierToPlanId("pro", billingView));
                }
              }}
              className={`cursor-pointer rounded-2xl p-5 text-left shadow-sm transition ${
                selectedPlanTier === "pro"
                  ? "border-2 border-cyan-400/70 bg-cyan-500/15 ring-2 ring-cyan-400/20"
                  : "border border-amber-400/40 bg-amber-500/10 hover:border-amber-400/50"
              }`}
            >
              <h2 className="text-lg font-semibold text-white">Pro</h2>
              <p className="mt-1 text-sm text-slate-200">สำหรับ optimize งานและ coding</p>
              <p className="mt-4 text-3xl font-bold text-white">
                {billingView === "yearly" ? "10,990฿" : "1,090฿"}
              </p>
              <p className="text-xs text-slate-200">
                {billingView === "yearly"
                  ? "เฉลี่ยประมาณ 916฿/เดือน · ใช้งานได้ต่อเนื่อง 365 วัน"
                  : "ใช้งานแบบรายเดือน 30 วัน"}
              </p>
              <ul className="mt-4 space-y-2 text-sm text-slate-100">
                <li>- AI Chat ~420 ครั้ง/วัน (1 ครั้ง = ส่งข้อความแล้วได้คำตอบจาก AI 1 ครั้ง)</li>
                <li>- สร้างสรุปชาร์จได้ประมาณ 42 เคส/วัน</li>
                <li>- ทุกอย่างใน Standard</li>
                <li>- วิเคราะห์เชิงลึกมากขึ้นสำหรับเคสซับซ้อน</li>
                <li>- แนะนำเติมข้อความใน order sheet (รวมผล lab/รังสีในหน้า) เพื่อรองรับรหัส (AdjRW ประมาณการ ไม่รับประกันการเบิกจ่าย)</li>
                <li>- คำแนะนำเชิงกลยุทธ์เพื่อปรับปรุง coding</li>
                <li>- ช่วยลดการตกหล่นของ coding</li>
                <li>- Case history / Export text</li>
              </ul>
            </div>
          </div>

          <div className="mt-8 overflow-x-auto rounded-2xl border border-white/10 bg-slate-950/50 shadow-inner">
            <table className="min-w-full text-sm">
              <thead className="bg-white/[0.06]">
                <tr className="text-left text-slate-200">
                  <th className="px-4 py-3 font-semibold">ความสามารถ</th>
                  <th
                    className={`px-4 py-3 font-semibold ${
                      selectedPlanTier === "basic" ? "bg-cyan-500/10 text-cyan-200" : ""
                    }`}
                  >
                    Basic
                  </th>
                  <th
                    className={`px-4 py-3 font-semibold ${
                      selectedPlanTier === "standard" ? "bg-cyan-500/10 text-cyan-200" : "text-cyan-200"
                    }`}
                  >
                    Standard (แนะนำ)
                  </th>
                  <th
                    className={`px-4 py-3 font-semibold ${
                      selectedPlanTier === "pro" ? "bg-cyan-500/10 text-cyan-200" : "text-amber-200"
                    }`}
                  >
                    Pro
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10 text-slate-300 [&>tr]:transition [&>tr:hover]:bg-white/[0.03]">
                <tr>
                  <td className="px-4 py-3">AI Chat ข้อความ→คำตอบ (โดยประมาณ/วัน)</td>
                  <td className={`px-4 py-3 ${selectedPlanTier === "basic" ? "bg-cyan-500/5 text-cyan-100" : ""}`}>~40 ครั้ง</td>
                  <td className={`px-4 py-3 ${selectedPlanTier === "standard" ? "bg-cyan-500/5 text-cyan-100" : ""}`}>~140 ครั้ง</td>
                  <td className={`px-4 py-3 ${selectedPlanTier === "pro" ? "bg-cyan-500/5 text-cyan-100" : ""}`}>~420 ครั้ง</td>
                </tr>
                <tr>
                  <td className="px-4 py-3">สร้างสรุปชาร์จได้ประมาณต่อวัน</td>
                  <td className={`px-4 py-3 ${selectedPlanTier === "basic" ? "bg-cyan-500/5 text-cyan-100" : ""}`}>~4 เคส</td>
                  <td className={`px-4 py-3 ${selectedPlanTier === "standard" ? "bg-cyan-500/5 text-cyan-100" : ""}`}>~14 เคส</td>
                  <td className={`px-4 py-3 ${selectedPlanTier === "pro" ? "bg-cyan-500/5 text-cyan-100" : ""}`}>~42 เคส</td>
                </tr>
                <tr>
                  <td className="px-4 py-3">ช่วยคิด Principal / Comorbidity / Complication</td>
                  <td className={`px-4 py-3 ${selectedPlanTier === "basic" ? "bg-cyan-500/5 text-cyan-100" : ""}`}>✓</td>
                  <td className={`px-4 py-3 ${selectedPlanTier === "standard" ? "bg-cyan-500/5 text-cyan-100" : ""}`}>✓</td>
                  <td className={`px-4 py-3 ${selectedPlanTier === "pro" ? "bg-cyan-500/5 text-cyan-100" : ""}`}>✓</td>
                </tr>
                <tr>
                  <td className="px-4 py-3">สรุปชาร์จครบส่วนหลัก</td>
                  <td className={`px-4 py-3 ${selectedPlanTier === "basic" ? "bg-cyan-500/5 text-cyan-100" : ""}`}>-</td>
                  <td className={`px-4 py-3 ${selectedPlanTier === "standard" ? "bg-cyan-500/5 text-cyan-100" : ""}`}>✓</td>
                  <td className={`px-4 py-3 ${selectedPlanTier === "pro" ? "bg-cyan-500/5 text-cyan-100" : ""}`}>✓</td>
                </tr>
                <tr>
                  <td className="px-4 py-3">AI ช่วยประเมินความครบของข้อมูล</td>
                  <td className={`px-4 py-3 ${selectedPlanTier === "basic" ? "bg-cyan-500/5 text-cyan-100" : ""}`}>-</td>
                  <td className={`px-4 py-3 ${selectedPlanTier === "standard" ? "bg-cyan-500/5 text-cyan-100" : ""}`}>-</td>
                  <td className={`px-4 py-3 ${selectedPlanTier === "pro" ? "bg-cyan-500/5 text-cyan-100" : ""}`}>✓</td>
                </tr>
                <tr>
                  <td className="px-4 py-3">
                    แนะนำเติมข้อความใน order sheet (รวมผล lab/รังสีในหน้า) เพื่อรองรับรหัส (AdjRW ประมาณการ)
                  </td>
                  <td className={`px-4 py-3 ${selectedPlanTier === "basic" ? "bg-cyan-500/5 text-cyan-100" : ""}`}>-</td>
                  <td className={`px-4 py-3 ${selectedPlanTier === "standard" ? "bg-cyan-500/5 text-cyan-100" : ""}`}>-</td>
                  <td className={`px-4 py-3 ${selectedPlanTier === "pro" ? "bg-cyan-500/5 text-cyan-100" : ""}`}>✓</td>
                </tr>
                <tr>
                  <td className="px-4 py-3">Case history / Export text</td>
                  <td className={`px-4 py-3 ${selectedPlanTier === "basic" ? "bg-cyan-500/5 text-cyan-100" : ""}`}>-</td>
                  <td className={`px-4 py-3 ${selectedPlanTier === "standard" ? "bg-cyan-500/5 text-cyan-100" : ""}`}>-</td>
                  <td className={`px-4 py-3 ${selectedPlanTier === "pro" ? "bg-cyan-500/5 text-cyan-100" : ""}`}>✓</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-xs leading-relaxed text-slate-500">
            ตัวเลขต่อวันเป็นเพดาน Fair Use ที่ระบบใช้จริง — ไม่ได้แปลงมาจาก token ทีละข้อความโดยตรง ผู้ใช้งานหนักอาจถึงเพดานรายเดือนก่อนตัวเลขต่อวัน
            <br />
            ทดลองใช้ (Trial) รวมฟีเจอร์ &quot;แนะนำเติม chart / AdjRW ประมาณการ&quot; เช่นเดียวกับ Pro ในขอบเขตที่ระบบกำหนด
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link href="/chat" className="rounded-xl border border-cyan-500/40 px-3 py-2 text-xs text-cyan-200 hover:bg-cyan-500/10">
              เริ่มที่ AI Chat
            </Link>
            <Link href="/app" className="rounded-xl border border-slate-600 px-3 py-2 text-xs text-slate-200 hover:bg-slate-800">
              ไปหน้าสรุปชาร์จ
            </Link>
            <Link href="/guidelines" className="rounded-xl border border-slate-600 px-3 py-2 text-xs text-slate-200 hover:bg-slate-800">
              ดูแนวทางใช้งาน
            </Link>
          </div>
        </section>

        <section className="rounded-2xl border border-cyan-500/15 bg-gradient-to-br from-cyan-950/20 to-transparent p-6">
          <h2 className="text-lg font-semibold text-white tracking-tight">รับโควตาโบนัสเพิ่มเติม</h2>
          <p className="mt-2 text-sm text-slate-300">
            ส่ง feedback ที่มีประโยชน์ต่อการพัฒนาระบบ หรือแนะนำเพื่อนมาใช้งานจริง
            เพื่อรับโควตาโบนัสตามเงื่อนไข
          </p>
          <ul className="mt-3 space-y-1 text-sm text-slate-200">
            <li>- โบนัส feedback พิจารณาตามคุณภาพของข้อเสนอ (ไม่รับประกันทุกรายการ)</li>
            <li>- โบนัสแนะนำเพื่อนได้เมื่อเพื่อนเริ่มใช้งานจริง/ซื้อแพ็กเกจครั้งแรก</li>
            <li>- ทีมงานขอสงวนสิทธิ์ปรับโควตาโบนัสตามความเหมาะสม</li>
          </ul>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link href="/app/profile" className="rounded-xl border border-cyan-400/40 px-3 py-2 text-sm text-cyan-200 hover:bg-cyan-500/10">
              ดูโควตาโบนัสของฉัน
            </Link>
            <Link href="/app?feedback=report" className="rounded-xl border border-slate-600 px-3 py-2 text-sm text-slate-200 hover:bg-slate-800">
              ไปส่ง feedback
            </Link>
          </div>
        </section>

        <section className="rounded-3xl border border-white/10 bg-gradient-to-b from-white/[0.04] to-transparent p-6 md:p-8 backdrop-blur">
          <h2 className="text-xl font-semibold text-white tracking-tight">ชำระเงิน (Stripe)</h2>
          <p className="mt-2 text-sm text-slate-400">
            เลือกแพ็กเกจหรือ Boost เสริมช่วงพีค แล้วไปหน้า Stripe เพื่อชำระ—สิทธิ์และโควตาอัปเดตอัตโนมัติหลังชำระสำเร็จ
          </p>
          <p className="mt-3 rounded-xl border border-cyan-500/25 bg-cyan-500/10 px-3 py-2 text-xs text-cyan-100">
            นี่คือหน้าสั่งเปิดแพ็กหรือเติมโควตาเสริมอย่างเป็นทางการของ DischargeX เท่านั้น
          </p>

          {!isLoggedIn ? (
            <div className="mt-6 rounded-2xl border border-amber-500/40 bg-amber-950/20 p-8 text-center">
              <p className="text-amber-200 font-medium">กรุณาเข้าสู่ระบบก่อนจึงจะส่งคำขอเปิดแพ็กเกจได้</p>
              <p className="mt-2 text-sm text-slate-400">ใช้อีเมลที่สมัครไว้เพื่อยืนยันตัวตน</p>
              <Link
                href="/login"
                data-telemetry-click="pricing_require_login"
                className="mt-4 inline-block rounded-2xl bg-cyan-500 px-5 py-2.5 text-sm font-semibold text-white hover:bg-cyan-600 transition hover:brightness-110"
              >
                เข้าสู่ระบบ
              </Link>
            </div>
          ) : (
          <>
          <div className="mt-4 rounded-2xl border border-cyan-500/30 bg-cyan-950/20 p-4 text-sm text-cyan-100">
            ระบบใช้ Stripe ทั้งหมดแบบอัตโนมัติแล้ว (ไม่มีการโอนสลิป/รอแอดมินอนุมัติ)
          </div>

          {isExistingPlan && (
            <div className="mt-4 rounded-2xl border border-cyan-500/30 bg-cyan-950/20 px-4 py-3 text-sm text-cyan-200">
              บัญชีนี้มีแผน <span className="font-semibold">{hasPlan}</span> อยู่แล้ว
              เมื่อกดดำเนินการ ระบบจะพาไป Stripe เพื่อจัดการแพ็กเกจ/ต่ออายุอัตโนมัติ
            </div>
          )}

          {submitError && (
            <div className="mt-4 rounded-2xl border border-red-500/50 bg-red-950/30 px-4 py-3 text-sm text-red-200">
              {submitError}
            </div>
          )}

          {requestType === "plan" ? (
            <div className="mt-4 md:hidden">
              <MobilePlanPicker
                id="pricing-plan-mobile-stripe"
                value={selectedPlanRequested}
                onChange={applyPlanFromPicker}
              />
            </div>
          ) : null}

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <div className="space-y-3 md:col-span-2">
              <label className="text-xs text-slate-300">ประเภทคำขอ</label>
              <div className="flex gap-4">
                <label className="flex cursor-pointer items-center gap-2">
                  <input
                    type="radio"
                    name="requestType"
                    checked={requestType === "plan"}
                    onChange={() => setRequestType("plan")}
                    className="h-4 w-4 border-slate-600 bg-slate-900 text-cyan-500"
                  />
                  <span className="text-sm text-slate-200">เปลี่ยน/อัปเกรดแผน</span>
                </label>
                <label className="flex cursor-pointer items-center gap-2">
                  <input
                    type="radio"
                    checked={requestType === "add_credits"}
                    onChange={() => setRequestType("add_credits")}
                    className="h-4 w-4 border-slate-600 bg-slate-900 text-cyan-500"
                  />
                  <span className="text-sm text-slate-200">ซื้อ Boost เพิ่ม</span>
                </label>
              </div>

              {requestType === "plan" ? (
                <div className="hidden space-y-1 md:block">
                  <label className="text-xs text-slate-400">เลือกแพ็กเกจ (ตามมุมมองรายเดือน/รายปีด้านบน)</label>
                  <select
                    name="planRequested"
                    required={requestType === "plan"}
                    value={selectedPlanRequested}
                    onChange={(e) => {
                      const v = e.target.value;
                      setBillingView(billingViewFromPlanId(v));
                      setSelectedPlanRequested(v);
                    }}
                    className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-cyan-500"
                  >
                    {PLAN_SELECT_OPTIONS[billingView].map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <div className="space-y-1">
                  <label className="text-xs text-slate-400">เลือกแพ็ก Boost เสริม</label>
                  <select
                    value={addCreditsOption}
                    onChange={(e) => setAddCreditsOption(Number(e.target.value))}
                    className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-cyan-500"
                  >
                    {ADD_CREDIT_OPTIONS.map((opt, i) => (
                      <option key={opt.credits} value={i}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                  <input
                    type="hidden"
                    name="addCredits"
                    value={ADD_CREDIT_OPTIONS[addCreditsOption].credits}
                  />
                  <input type="hidden" name="planRequested" value="add_credits" />
                </div>
              )}
            </div>

            <div className="md:col-span-2 rounded-2xl border border-emerald-500/25 bg-emerald-950/10 p-4 text-sm text-emerald-100">
              <div className="text-xs font-medium uppercase tracking-wide text-emerald-300/90">ยอดที่ต้องชำระ</div>
              <div className="mt-1 text-2xl font-bold text-emerald-300">
                {quote?.finalAmount != null ? `${quote.finalAmount.toLocaleString("th-TH")} บาท` : "—"}
              </div>
              {quoteError ? <div className="mt-1 text-xs text-amber-300">{quoteError}</div> : null}
              <div className="mt-3 rounded-2xl border border-indigo-500/30 bg-indigo-950/20 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-indigo-100">ชำระผ่าน Stripe</div>
                    <div className="text-xs text-indigo-200/80">
                      ระบบจะเปิดแพ็กเกจ/ต่ออายุอัตโนมัติจาก webhook ทันทีเมื่อชำระสำเร็จ
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => void startStripeCheckout()}
                    disabled={stripeLoading}
                    data-telemetry-click="pricing_stripe_checkout"
                    className="rounded-xl bg-indigo-500 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-400 disabled:opacity-60"
                  >
                    {stripeLoading ? "กำลังเชื่อม Stripe..." : "ไปหน้า Stripe"}
                  </button>
                </div>
              </div>
            </div>
          </div>
          </>
          )}
        </section>
      </div>
    </main>
  );
}

export default function PricingPage() {
  return (
    <React.Suspense fallback={<main className="min-h-screen bg-[#081120] text-slate-100" />}>
      <PricingPageContent />
    </React.Suspense>
  );
}

