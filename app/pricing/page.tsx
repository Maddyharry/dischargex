"use client";

import React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";

const ADD_CREDIT_OPTIONS = [
  { credits: 50, price: 200, label: "50 เครดิต (200฿)" },
  { credits: 100, price: 350, label: "100 เครดิต (350฿)" },
] as const;

const PLAN_SELECT_OPTIONS = {
  monthly: [
    { value: "basic_monthly", label: "Basic Monthly (299฿ / 50 เครดิต / 30 วัน)" },
    { value: "standard_monthly", label: "Standard Monthly (699฿ / 120 เครดิต / 30 วัน) — แนะนำ" },
    { value: "pro_monthly", label: "Pro Monthly (1,490฿ / 250 เครดิต / 30 วัน)" },
  ],
  yearly: [
    { value: "basic_yearly", label: "Basic Yearly (2,990฿ / 50 เครดิต ต่อรอบ 30 วัน)" },
    { value: "standard_yearly", label: "Standard Yearly (6,990฿ / 120 เครดิต ต่อรอบ 30 วัน) — แนะนำ" },
    { value: "pro_yearly", label: "Pro Yearly (14,900฿ / 250 เครดิต ต่อรอบ 30 วัน)" },
  ],
} as const;

function validateBirthDateBE(value: string): string | null {
  const s = (value || "").trim();
  if (!s) return "กรุณากรอกวันเกิด";
  const match = s.match(/^(\d{1,2})\s*\/\s*(\d{1,2})\s*\/\s*(\d{4})$/);
  if (!match) return "รูปแบบไม่ถูกต้อง ใช้ วว/ดด/ปี พ.ศ. (เช่น 15/8/2543)";
  const day = parseInt(match[1], 10);
  const month = parseInt(match[2], 10);
  const yearBE = parseInt(match[3], 10);
  if (yearBE < 2468 || yearBE > 2580) return "ปี พ.ศ. ควรอยู่ช่วง 2468–2580";
  if (month < 1 || month > 12) return "เดือนต้องอยู่ระหว่าง 1–12";
  if (day < 1 || day > 31) return "วันต้องอยู่ระหว่าง 1–31";
  const daysInMonth = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  const yearCE = yearBE - 543;
  const isLeap = (y: number) => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
  const maxDay = month === 2 ? (isLeap(yearCE) ? 29 : 28) : daysInMonth[month - 1];
  if (day > maxDay) return `วันในเดือนนี้ต้องไม่เกิน ${maxDay}`;
  return null;
}

function PricingPageContent() {
  const searchParams = useSearchParams();
  const { data: session, status: sessionStatus } = useSession();
  const isLoggedIn = sessionStatus === "authenticated" && !!session?.user?.email;
  const sessionName = session?.user?.name ?? "";

  const [billingView, setBillingView] = React.useState<"monthly" | "yearly">("monthly");
  const [qrOpen, setQrOpen] = React.useState(false);
  const [birthDateError, setBirthDateError] = React.useState<string | null>(null);
  const [submitError, setSubmitError] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);
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
  const [formPrefill, setFormPrefill] = React.useState<{
    fullName: string;
    birthDate: string;
    hospitalName: string;
    province: string;
    phone: string;
  } | null>(null);
  const [formData, setFormData] = React.useState({
    fullName: "",
    birthDate: "",
    hospitalName: "",
    province: "",
    phone: "",
  });

  React.useEffect(() => {
    if (!isLoggedIn) return;
    let cancelled = false;
    fetch("/api/me")
      .then((r) => r.json())
      .then((data) => {
        if (cancelled || !data.ok || !data.user) return;
        const u = data.user;
        setFormPrefill({
          fullName: u.name ?? "",
          birthDate: u.birthDate ?? "",
          hospitalName: u.hospitalName ?? "",
          province: u.province ?? "",
          phone: u.phone ?? "",
        });
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [isLoggedIn]);

  React.useEffect(() => {
    if (formPrefill) {
      setFormData(formPrefill);
    }
  }, [formPrefill]);

  React.useEffect(() => {
    if (sessionName && !formPrefill && formData.fullName === "") {
      setFormData((prev) => ({ ...prev, fullName: sessionName }));
    }
  }, [sessionName, formPrefill, formData.fullName]);

  const [addCreditsOption, setAddCreditsOption] = React.useState(0);
  const submitSuccess = searchParams.get("status") === "success";
  const hasPlan = (session?.user as { plan?: string } | undefined)?.plan;
  const isExistingPlan = hasPlan && hasPlan !== "trial";
  const defaultPlanRequested = billingView === "yearly" ? "standard_yearly" : "standard_monthly";
  const selectedPlanTier = selectedPlanRequested.startsWith("basic")
    ? "basic"
    : selectedPlanRequested.startsWith("pro")
    ? "pro"
    : "standard";

  React.useEffect(() => {
    setSelectedPlanRequested(defaultPlanRequested);
  }, [defaultPlanRequested]);

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

  React.useEffect(() => {
    if (!qrOpen) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setQrOpen(false);
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [qrOpen]);

  return (
    <main className="min-h-screen bg-[#081120] text-slate-100">
      <div className="mx-auto max-w-5xl px-4 py-10 space-y-8">
        {submitSuccess && (
          <div className="rounded-3xl border border-emerald-500/50 bg-emerald-950/30 p-6 text-center">
            <h2 className="text-xl font-semibold text-emerald-300">ส่งคำขอแล้ว</h2>
            <p className="mt-2 text-sm text-slate-300">
              ทีมงานจะตรวจสอบสลิปและเปิดแพ็กเกจภายใน 24 ชั่วโมง
              <br />
              รออัปเดตหรือไปใช้งานด้านล่างได้เลย
            </p>
            <div className="mt-5 flex flex-wrap justify-center gap-3">
              <Link
                href="/app"
                className="rounded-2xl bg-cyan-500 px-5 py-2.5 text-sm font-medium text-white hover:bg-cyan-600"
              >
                ไปหน้าแอป (workspace)
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
            1 เครดิต = 1 เคส (รองรับเคสทั่วไป) · เคสยาวมากอาจใช้มากกว่า 1 เครดิต
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
              รายปี = จ่ายล่วงหน้า 365 วัน แต่ให้เครดิตเป็นรอบ ๆ (ไม่ใช่ก้อนใหญ่ทีเดียว)
            </span>
          </div>

          <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5 shadow-sm transition hover:border-white/15">
              <h2 className="text-lg font-semibold text-white">Trial</h2>
              <p className="mt-1 text-sm text-slate-400">ลองก่อน ตัดสินใจทีหลัง</p>
              <p className="mt-4 text-3xl font-bold text-white">0฿</p>
              <p className="text-xs text-slate-400">10 เครดิต / 7 วัน</p>
              <ul className="mt-4 space-y-2 text-sm text-slate-200">
                <li>- ไม่มีผูกมัด</li>
                <li>- ใช้ได้ 1 ครั้งต่อบัญชี</li>
              </ul>
            </div>

            <div
              className={`rounded-2xl p-5 shadow-sm transition ${
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
                  ? "50 เครดิต / รอบ 30 วัน · อายุแพ็กเกจ 365 วัน"
                  : "50 เครดิต / 30 วัน"}
              </p>
              <ul className="mt-4 space-y-2 text-sm text-slate-200">
                <li>- Principal / Comorbidity / Complication</li>
                <li>- แนะนำ ICD-10 / ICD-9</li>
                <li>- เหมาะสำหรับช่วยคิด diagnosis บางเคส</li>
              </ul>
            </div>

            <div
              className={`relative rounded-2xl p-5 shadow-sm transition ${
                selectedPlanTier === "standard"
                  ? "border-2 border-cyan-400/70 bg-cyan-500/15 shadow-lg shadow-cyan-900/30 ring-2 ring-cyan-400/20"
                  : "border border-white/10 bg-white/[0.04] hover:border-white/15"
              }`}
            >
              <span className="absolute -top-2.5 right-4 rounded-full bg-cyan-500 px-3 py-0.5 text-xs font-semibold text-white shadow">
                แนะนำ
              </span>
              <h2 className="text-lg font-semibold text-white">Standard</h2>
              <p className="mt-1 text-sm text-cyan-100">ครบ ใช้จริงทุกวัน — แพ็กหลักสำหรับทำ discharge summary</p>
              <p className="mt-4 text-3xl font-bold text-white">
                {billingView === "yearly" ? "6,990฿" : "699฿"}
              </p>
              <p className="text-xs text-cyan-200/90">
                {billingView === "yearly"
                  ? "120 เครดิต / รอบ 30 วัน · อายุแพ็กเกจ 365 วัน"
                  : "120 เครดิต / 30 วัน"}
              </p>
              <ul className="mt-4 space-y-2 text-sm text-slate-100">
                <li>- Diagnosis ครบ + Admit / Discharge</li>
                <li>- Investigations, Treatment, Outcome, Home medication</li>
                <li>- เหมาะสำหรับทำ discharge summary จริง</li>
              </ul>
            </div>

            <div
              className={`rounded-2xl p-5 shadow-sm transition ${
                selectedPlanTier === "pro"
                  ? "border-2 border-cyan-400/70 bg-cyan-500/15 ring-2 ring-cyan-400/20"
                  : "border border-amber-400/40 bg-amber-500/10 hover:border-amber-400/50"
              }`}
            >
              <h2 className="text-lg font-semibold text-white">Pro</h2>
              <p className="mt-1 text-sm text-slate-200">สำหรับ optimize งานและ coding</p>
              <p className="mt-4 text-3xl font-bold text-white">
                {billingView === "yearly" ? "14,900฿" : "1,490฿"}
              </p>
              <p className="text-xs text-slate-200">
                {billingView === "yearly"
                  ? "250 เครดิต / รอบ 30 วัน · อายุแพ็กเกจ 365 วัน"
                  : "250 เครดิต / 30 วัน"}
              </p>
              <ul className="mt-4 space-y-2 text-sm text-slate-100">
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
                  <td className="px-4 py-3">เครดิตต่อรอบ</td>
                  <td className={`px-4 py-3 ${selectedPlanTier === "basic" ? "bg-cyan-500/5 text-cyan-100" : ""}`}>50</td>
                  <td className={`px-4 py-3 ${selectedPlanTier === "standard" ? "bg-cyan-500/5 text-cyan-100" : ""}`}>120</td>
                  <td className={`px-4 py-3 ${selectedPlanTier === "pro" ? "bg-cyan-500/5 text-cyan-100" : ""}`}>250</td>
                </tr>
                <tr>
                  <td className="px-4 py-3">ช่วยคิด Principal / Comorbidity / Complication</td>
                  <td className={`px-4 py-3 ${selectedPlanTier === "basic" ? "bg-cyan-500/5 text-cyan-100" : ""}`}>✓</td>
                  <td className={`px-4 py-3 ${selectedPlanTier === "standard" ? "bg-cyan-500/5 text-cyan-100" : ""}`}>✓</td>
                  <td className={`px-4 py-3 ${selectedPlanTier === "pro" ? "bg-cyan-500/5 text-cyan-100" : ""}`}>✓</td>
                </tr>
                <tr>
                  <td className="px-4 py-3">สรุป Discharge Summary ครบส่วนหลัก</td>
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
          <p className="mt-2 text-xs text-slate-500">
            เครดิตฐานรีเฟรชเป็นรอบ 30 วัน และโบนัสเครดิตอยู่ในกลุ่มเครดิตเสริมตามเงื่อนไขระบบ
            <br />
            ทดลองใช้ (Trial) รวมฟีเจอร์ &quot;แนะนำเติม chart / AdjRW ประมาณการ&quot; เช่นเดียวกับ Pro ในขอบเขตที่ระบบกำหนด
          </p>
        </section>

        <section className="rounded-2xl border border-cyan-500/15 bg-gradient-to-br from-cyan-950/20 to-transparent p-6">
          <h2 className="text-lg font-semibold text-white tracking-tight">รับเครดิตโบนัสเพิ่มเติม</h2>
          <p className="mt-2 text-sm text-slate-300">
            ส่ง feedback ที่มีประโยชน์ต่อการพัฒนาระบบ หรือแนะนำเพื่อนมาใช้งานจริง
            เพื่อรับเครดิตโบนัสตามเงื่อนไข
          </p>
          <ul className="mt-3 space-y-1 text-sm text-slate-200">
            <li>- โบนัส feedback พิจารณาตามคุณภาพของข้อเสนอ (ไม่รับประกันทุกรายการ)</li>
            <li>- โบนัสแนะนำเพื่อนได้เมื่อเพื่อนเริ่มใช้งานจริง/ซื้อแพ็กเกจครั้งแรก</li>
            <li>- ทีมงานขอสงวนสิทธิ์ปรับเครดิตตามความเหมาะสม</li>
          </ul>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link href="/app/profile" className="rounded-xl border border-cyan-400/40 px-3 py-2 text-sm text-cyan-200 hover:bg-cyan-500/10">
              ดูเครดิตโบนัสของฉัน
            </Link>
            <Link href="/app?feedback=report" className="rounded-xl border border-slate-600 px-3 py-2 text-sm text-slate-200 hover:bg-slate-800">
              ไปส่ง feedback
            </Link>
          </div>
        </section>

        <section className="rounded-3xl border border-white/10 bg-gradient-to-b from-white/[0.04] to-transparent p-6 md:p-8 backdrop-blur">
          <h2 className="text-xl font-semibold text-white tracking-tight">ชำระเงินผ่าน PromptPay</h2>
          <p className="mt-2 text-sm text-slate-400">
            เลือกแพ็กเกจหรือเครดิตเพิ่ม แล้วโอนตามยอดที่แสดง จากนั้นกรอกข้อมูลและแนบสลิปด้านล่าง
          </p>

          {qrOpen && process.env.NEXT_PUBLIC_PROMPTPAY_QR_URL ? (
            <div
              className="fixed inset-0 z-[200] flex items-center justify-center bg-black/85 p-4 backdrop-blur-sm"
              onMouseDown={(e) => {
                if (e.target === e.currentTarget) setQrOpen(false);
              }}
              role="dialog"
              aria-modal="true"
            >
              <div className="relative w-full max-w-sm">
                <button
                  type="button"
                  onClick={() => setQrOpen(false)}
                  className="absolute -top-11 right-0 rounded-xl border border-slate-600 bg-slate-800/90 px-4 py-2 text-sm font-medium text-slate-200 hover:bg-slate-700 transition"
                >
                  ปิด (ESC)
                </button>
                <img
                  src={process.env.NEXT_PUBLIC_PROMPTPAY_QR_URL}
                  alt="PromptPay QR (ขยาย)"
                  className="mx-auto w-full max-w-xs rounded-2xl border border-slate-600 bg-white object-contain p-4 shadow-2xl"
                />
              </div>
            </div>
          ) : null}

          {!isLoggedIn ? (
            <div className="mt-6 rounded-2xl border border-amber-500/40 bg-amber-950/20 p-8 text-center">
              <p className="text-amber-200 font-medium">กรุณาเข้าสู่ระบบก่อนจึงจะส่งคำขอเปิดแพ็กเกจได้</p>
              <p className="mt-2 text-sm text-slate-400">ใช้อีเมลที่สมัครไว้เพื่อยืนยันตัวตน</p>
              <Link
                href="/login"
                className="mt-4 inline-block rounded-2xl bg-cyan-500 px-5 py-2.5 text-sm font-semibold text-white hover:bg-cyan-600 transition hover:brightness-110"
              >
                เข้าสู่ระบบ
              </Link>
            </div>
          ) : (
          <>
          {isExistingPlan && (
            <div className="mt-4 rounded-2xl border border-cyan-500/30 bg-cyan-950/20 px-4 py-3 text-sm text-cyan-200">
              บัญชีนี้มีแผน <span className="font-semibold">{hasPlan}</span> อยู่แล้ว
              ส่งฟอร์มด้านล่างได้ถ้าต้องการอัปเกรดหรือต่ออายุ
            </div>
          )}

          {submitError && (
            <div className="mt-4 rounded-2xl border border-red-500/50 bg-red-950/30 px-4 py-3 text-sm text-red-200">
              {submitError}
            </div>
          )}

          <form
            className="mt-6 grid gap-4 md:grid-cols-2"
            encType="multipart/form-data"
            onSubmit={async (e) => {
              e.preventDefault();
              setSubmitError(null);
              const form = e.currentTarget;
              const birthInput = form.querySelector<HTMLInputElement>('input[name="birthDate"]');
              const err = validateBirthDateBE(birthInput?.value ?? "");
              if (err) {
                setBirthDateError(err);
                birthInput?.focus();
                return;
              }
              setBirthDateError(null);
              setSubmitting(true);
              try {
                const fd = new FormData(form);
                const res = await fetch("/api/billing/request", {
                  method: "POST",
                  body: fd,
                });
                if (!res.ok) {
                  const text = await res.text();
                  let msg: string | null = null;
                  try {
                    const parsed = text ? (JSON.parse(text) as { error?: unknown }) : null;
                    if (parsed && typeof parsed === "object" && typeof parsed.error === "string") {
                      msg = parsed.error;
                    }
                  } catch {
                    // ignore
                  }
                  setSubmitError(msg || text || `ส่งคำขอไม่สำเร็จ (${res.status})`);
                  return;
                }
                const text = await res.text();
                let redirectUrl = "/pricing?status=success";
                try {
                  const parsed = text ? (JSON.parse(text) as { redirectUrl?: unknown }) : null;
                  if (parsed && typeof parsed === "object" && typeof parsed.redirectUrl === "string") {
                    redirectUrl = parsed.redirectUrl;
                  }
                } catch {
                  // ignore
                }
                window.location.href = redirectUrl;
              } catch {
                setSubmitError("ส่งคำขอไม่สำเร็จ กรุณาลองใหม่");
              } finally {
                setSubmitting(false);
              }
            }}
          >
            <div className="space-y-1">
              <label className="text-xs text-slate-300">ชื่อ-นามสกุล</label>
              <input
                name="fullName"
                required
                value={formData.fullName}
                onChange={(e) => setFormData((prev) => ({ ...prev, fullName: e.target.value }))}
                className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-cyan-500"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs text-slate-300">อีเมล (จากบัญชีที่ล็อกอิน)</label>
              <div className="rounded-2xl border border-slate-700 bg-slate-950/50 px-4 py-3 text-sm text-slate-300">
                {session?.user?.email ?? "-"}
              </div>
              <p className="text-[11px] text-slate-500">ใช้อีเมลนี้ยืนยันตัวตน ไม่ต้องกรอก</p>
            </div>

            <div className="space-y-1">
              <label className="text-xs text-slate-300">วันเกิด (วว/ดด/ปี พ.ศ.)</label>
              <input
                type="text"
                name="birthDate"
                required
                value={formData.birthDate}
                onChange={(e) => {
                  setFormData((prev) => ({ ...prev, birthDate: e.target.value }));
                  if (birthDateError != null) setBirthDateError(null);
                }}
                placeholder="เช่น 15/8/2543"
                title="กรุณากรอกเป็นวันเดือนปี พ.ศ. เช่น 15/8/2543"
                className={`w-full rounded-2xl border px-3 py-2 text-sm text-slate-100 outline-none focus:border-cyan-500 ${
                  birthDateError ? "border-red-500 bg-red-950/20" : "border-slate-700 bg-slate-950"
                }`}
                onBlur={(e) => {
                  const err = validateBirthDateBE(e.target.value);
                  setBirthDateError(err);
                }}
              />
              {birthDateError ? (
                <p className="text-xs text-red-400">{birthDateError}</p>
              ) : (
                <p className="text-[11px] text-slate-500">กรุณากรอกปี พ.ศ. เท่านั้น (เช่น พ.ศ. 2543)</p>
              )}
            </div>

            <div className="space-y-1">
              <label className="text-xs text-slate-300">โรงพยาบาล / หน่วยงาน</label>
              <input
                name="hospitalName"
                required
                value={formData.hospitalName}
                onChange={(e) => setFormData((prev) => ({ ...prev, hospitalName: e.target.value }))}
                className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-cyan-500"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs text-slate-300">จังหวัด</label>
              <select
                name="province"
                required
                value={formData.province}
                onChange={(e) => setFormData((prev) => ({ ...prev, province: e.target.value }))}
                className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-cyan-500"
              >
                <option value="">-- เลือกจังหวัด --</option>
                <option value="กรุงเทพมหานคร">กรุงเทพมหานคร</option>
                <option value="กระบี่">กระบี่</option>
                <option value="กาญจนบุรี">กาญจนบุรี</option>
                <option value="กาฬสินธุ์">กาฬสินธุ์</option>
                <option value="กำแพงเพชร">กำแพงเพชร</option>
                <option value="ขอนแก่น">ขอนแก่น</option>
                <option value="จันทบุรี">จันทบุรี</option>
                <option value="ฉะเชิงเทรา">ฉะเชิงเทรา</option>
                <option value="ชลบุรี">ชลบุรี</option>
                <option value="ชัยนาท">ชัยนาท</option>
                <option value="ชัยภูมิ">ชัยภูมิ</option>
                <option value="ชุมพร">ชุมพร</option>
                <option value="เชียงราย">เชียงราย</option>
                <option value="เชียงใหม่">เชียงใหม่</option>
                <option value="ตรัง">ตรัง</option>
                <option value="ตราด">ตราด</option>
                <option value="ตาก">ตาก</option>
                <option value="นครนายก">นครนายก</option>
                <option value="นครปฐม">นครปฐม</option>
                <option value="นครพนม">นครพนม</option>
                <option value="นครราชสีมา">นครราชสีมา</option>
                <option value="นครศรีธรรมราช">นครศรีธรรมราช</option>
                <option value="นครสวรรค์">นครสวรรค์</option>
                <option value="นนทบุรี">นนทบุรี</option>
                <option value="นราธิวาส">นราธิวาส</option>
                <option value="น่าน">น่าน</option>
                <option value="บึงกาฬ">บึงกาฬ</option>
                <option value="บุรีรัมย์">บุรีรัมย์</option>
                <option value="ปทุมธานี">ปทุมธานี</option>
                <option value="ประจวบคีรีขันธ์">ประจวบคีรีขันธ์</option>
                <option value="ปราจีนบุรี">ปราจีนบุรี</option>
                <option value="ปัตตานี">ปัตตานี</option>
                <option value="พระนครศรีอยุธยา">พระนครศรีอยุธยา</option>
                <option value="พะเยา">พะเยา</option>
                <option value="พังงา">พังงา</option>
                <option value="พัทลุง">พัทลุง</option>
                <option value="พิจิตร">พิจิตร</option>
                <option value="พิษณุโลก">พิษณุโลก</option>
                <option value="เพชรบุรี">เพชรบุรี</option>
                <option value="เพชรบูรณ์">เพชรบูรณ์</option>
                <option value="แพร่">แพร่</option>
                <option value="ภูเก็ต">ภูเก็ต</option>
                <option value="มหาสารคาม">มหาสารคาม</option>
                <option value="มุกดาหาร">มุกดาหาร</option>
                <option value="แม่ฮ่องสอน">แม่ฮ่องสอน</option>
                <option value="ยโสธร">ยโสธร</option>
                <option value="ยะลา">ยะลา</option>
                <option value="ร้อยเอ็ด">ร้อยเอ็ด</option>
                <option value="ระนอง">ระนอง</option>
                <option value="ระยอง">ระยอง</option>
                <option value="ราชบุรี">ราชบุรี</option>
                <option value="ลพบุรี">ลพบุรี</option>
                <option value="ลำปาง">ลำปาง</option>
                <option value="ลำพูน">ลำพูน</option>
                <option value="เลย">เลย</option>
                <option value="ศรีสะเกษ">ศรีสะเกษ</option>
                <option value="สกลนคร">สกลนคร</option>
                <option value="สงขลา">สงขลา</option>
                <option value="สตูล">สตูล</option>
                <option value="สมุทรปราการ">สมุทรปราการ</option>
                <option value="สมุทรสาคร">สมุทรสาคร</option>
                <option value="สมุทรสงคราม">สมุทรสงคราม</option>
                <option value="สระแก้ว">สระแก้ว</option>
                <option value="สระบุรี">สระบุรี</option>
                <option value="สิงห์บุรี">สิงห์บุรี</option>
                <option value="สุโขทัย">สุโขทัย</option>
                <option value="สุพรรณบุรี">สุพรรณบุรี</option>
                <option value="สุราษฎร์ธานี">สุราษฎร์ธานี</option>
                <option value="สุรินทร์">สุรินทร์</option>
                <option value="หนองคาย">หนองคาย</option>
                <option value="หนองบัวลำภู">หนองบัวลำภู</option>
                <option value="อ่างทอง">อ่างทอง</option>
                <option value="อำนาจเจริญ">อำนาจเจริญ</option>
                <option value="อุดรธานี">อุดรธานี</option>
                <option value="อุตรดิตถ์">อุตรดิตถ์</option>
                <option value="อุทัยธานี">อุทัยธานี</option>
                <option value="อุบลราชธานี">อุบลราชธานี</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-xs text-slate-300">เบอร์โทร</label>
              <input
                name="phone"
                required
                value={formData.phone}
                onChange={(e) => setFormData((prev) => ({ ...prev, phone: e.target.value }))}
                className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-cyan-500"
              />
            </div>

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
                    name="requestType"
                    checked={requestType === "add_credits"}
                    onChange={() => setRequestType("add_credits")}
                    className="h-4 w-4 border-slate-600 bg-slate-900 text-cyan-500"
                  />
                  <span className="text-sm text-slate-200">ซื้อเครดิตเพิ่ม</span>
                </label>
              </div>

              {requestType === "plan" ? (
                <div className="space-y-1">
                  <label className="text-xs text-slate-400">เลือกแพ็กเกจ</label>
                  <select
                    name="planRequested"
                    required={requestType === "plan"}
                    value={selectedPlanRequested}
                    onChange={(e) => setSelectedPlanRequested(e.target.value)}
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
                  <label className="text-xs text-slate-400">จำนวนเครดิตที่ซื้อเพิ่ม</label>
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

            {isLoggedIn && (
              <>
                <div className="md:col-span-2 rounded-2xl border border-emerald-500/25 bg-emerald-950/10 p-4 text-sm text-emerald-100">
                  <div className="text-xs font-medium uppercase tracking-wide text-emerald-300/90">ยอดที่ต้องโอน</div>
                  <div className="mt-1 text-2xl font-bold text-emerald-300">
                    {quote?.finalAmount != null ? `${quote.finalAmount.toLocaleString("th-TH")} บาท` : "—"}
                  </div>
                  {quoteError ? <div className="mt-1 text-xs text-amber-300">{quoteError}</div> : null}
                  {quote?.paymentType === "upgrade" && quote.remainingValue != null && quote.remainingDays != null ? (
                    <div className="mt-1 text-xs text-slate-300">
                      อัปเกรดจะหัก มูลค่าที่เหลือ ตามจำนวนวันที่เหลือ {quote.remainingDays} วัน (ประมาณ {quote.remainingValue.toLocaleString("th-TH")} บาท)
                    </div>
                  ) : quote?.paymentType === "downgrade" ? (
                    <div className="mt-1 text-xs text-slate-300">
                      ดาวน์เกรดจะมีผลรอบถัดไป (ไม่ต้องโอน ยอด = 0)
                    </div>
                  ) : null}
                </div>
                <div className="md:col-span-2">
                  {process.env.NEXT_PUBLIC_PROMPTPAY_QR_URL ? (
                    <div className="rounded-2xl border border-slate-600/80 bg-slate-950/60 p-4">
                      <p className="text-xs font-medium text-slate-400 mb-2">QR โอนเงิน</p>
                      <button
                        type="button"
                        onClick={() => setQrOpen(true)}
                        className="flex items-center justify-center rounded-xl border border-slate-600 bg-white p-3 transition hover:border-cyan-500/50 hover:shadow-md"
                        title="คลิกเพื่อขยาย"
                      >
                        <img
                          src={process.env.NEXT_PUBLIC_PROMPTPAY_QR_URL}
                          alt="PromptPay QR"
                          className="h-28 w-28 object-contain"
                        />
                      </button>
                      <p className="mt-2 text-[11px] text-slate-500">คลิกเพื่อขยาย</p>
                    </div>
                  ) : (
                    <div className="rounded-2xl border border-dashed border-slate-600 bg-slate-950/30 px-4 py-3 text-xs text-slate-400">
                      ไม่พบ PromptPay QR
                    </div>
                  )}
                </div>
              </>
            )}
            <div className="space-y-1 md:col-span-2">
              <label className="text-xs text-slate-300">แนบสลิปการโอน (ภาพ)</label>
              <input
                type="file"
                name="slip"
                accept="image/*"
                required
                className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none file:mr-3 file:rounded-xl file:border-none file:bg-slate-800 file:px-3 file:py-1 file:text-xs file:text-slate-100 focus:border-cyan-500"
              />
            </div>

            <div className="md:col-span-2">
              <button
                type="submit"
                disabled={submitting}
                className="w-full rounded-2xl bg-gradient-to-r from-emerald-500 to-cyan-500 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-emerald-900/40 transition hover:brightness-110 disabled:opacity-60"
              >
                {submitting
                  ? "กำลังส่ง..."
                  : requestType === "add_credits"
                  ? "ส่งคำขอซื้อเครดิตเพิ่ม"
                  : "ส่งคำขอเปิดแพ็กเกจ"}
              </button>
            </div>
          </form>

          <p className="mt-3 text-xs text-slate-500">
            หลังจากส่งคำขอแล้ว ทีมงานจะตรวจสอบสลิปและเปิดใช้งานแพ็กเกจภายใน 24 ชั่วโมง
          </p>
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

