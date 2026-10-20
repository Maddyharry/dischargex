"use client";

import { useState } from "react";
import Link from "next/link";

type BillingCycle = "monthly" | "yearly";

const plans = [
  { name: "Basic", monthly: "299", yearly: "2,990", average: "249", daily: 5, cases: "15–18", detail: "Principal / Comorbidity / Complication · แนะนำ ICD-10 / ICD-9" },
  { name: "Standard", monthly: "590", yearly: "5,990", average: "499", daily: 10, cases: "30–35", detail: "Diagnosis พร้อม Admit / Discharge และส่วนประกอบสรุปชาร์จ", featured: true },
  { name: "Pro", monthly: "1,090", yearly: "10,990", average: "916", daily: 20, cases: "55–65", detail: "ทุกอย่างใน Standard พร้อมเครื่องมือทบทวน coding และ AdjRW ประมาณการ" },
];

export default function LandingPricingPreview() {
  const [cycle, setCycle] = useState<BillingCycle>("monthly");

  return (
    <section id="pricing" className="mx-auto max-w-7xl scroll-mt-8 px-5 py-16 sm:px-8 lg:py-20" aria-labelledby="pricing-heading">
      <div className="mx-auto max-w-2xl text-center">
        <p className="text-sm font-medium tracking-wide text-cyan-300">เลือกให้ตรงกับปริมาณงาน</p>
        <h2 id="pricing-heading" className="mt-3 text-3xl font-semibold tracking-tight text-white sm:text-4xl">แพ็กเกจใช้งาน</h2>
        <p className="mt-4 leading-relaxed text-slate-400">ทดลองฟรีก่อน แล้วเลือกแพ็กเกจที่เหมาะกับงานของคุณ</p>
        <div className="mt-7 inline-flex rounded-xl border border-white/10 bg-slate-950/70 p-1" role="group" aria-label="เลือกรอบการชำระเงิน">
          {(["monthly", "yearly"] as const).map((value) => {
            const active = cycle === value;
            return <button key={value} type="button" aria-pressed={active} onClick={() => setCycle(value)} className={`min-h-11 rounded-lg px-4 text-sm font-medium transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300 ${active ? "bg-cyan-300 text-slate-950" : "text-slate-300 hover:bg-white/5"}`}>
              {value === "monthly" ? "รายเดือน" : "รายปี · เฉลี่ยต่อเดือน"}
            </button>;
          })}
        </div>
      </div>

      <div className="mt-9 grid items-stretch gap-4 md:grid-cols-2 lg:grid-cols-4">
        <article className="flex flex-col rounded-2xl border border-white/10 bg-white/[.035] p-6">
          <p className="text-sm font-medium text-cyan-200">Trial</p><h3 className="mt-2 text-2xl font-semibold text-white">ฟรี</h3>
          <p className="mt-1 text-sm text-slate-400">ทดลอง 14 วัน</p>
          <ul className="mt-5 flex-1 space-y-3 text-sm leading-relaxed text-slate-300"><li>รวม 5 เคสตลอดช่วงทดลอง</li><li>สูงสุดวันละ 2 เคส</li><li>ทดลองฟีเจอร์ตามเงื่อนไขของระบบ</li></ul>
          <Link href="/signup" className="mt-6 inline-flex min-h-11 items-center justify-center rounded-xl border border-white/15 px-4 text-sm font-medium text-white transition hover:bg-white/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300">สมัครทดลองฟรี</Link>
        </article>
        {plans.map((plan) => <article key={plan.name} className={`relative flex flex-col rounded-2xl p-6 ${plan.featured ? "border border-cyan-300/50 bg-gradient-to-b from-cyan-950/70 to-slate-950 shadow-xl shadow-cyan-950/30" : "border border-white/10 bg-white/[.035]"}`}>
          {plan.featured ? <span className="absolute -top-3 right-5 rounded-full bg-cyan-300 px-3 py-1 text-xs font-semibold text-slate-950">แนะนำ</span> : null}
          <p className="text-sm font-medium text-cyan-200">{plan.name}</p>
          <h3 className="mt-3 text-3xl font-bold tracking-tight text-white" aria-live="polite">฿{cycle === "monthly" ? plan.monthly : plan.yearly}</h3>
          <p className="mt-1 text-sm text-slate-400">{cycle === "monthly" ? "ต่อเดือน" : `ต่อปี · เฉลี่ย ฿${plan.average}/เดือน`}</p>
          <p className="mt-4 rounded-lg bg-white/[.045] px-3 py-2 text-sm text-slate-200">สูงสุด {plan.daily} เคส/วัน</p>
          <p className="mt-3 text-sm leading-relaxed text-slate-400">โดยประมาณ {plan.cases} เคส/เดือน</p>
          <p className="mt-4 flex-1 text-sm leading-relaxed text-slate-300">{plan.detail}</p>
          <Link href="/pricing" className={`mt-6 inline-flex min-h-11 items-center justify-center rounded-xl px-4 text-sm font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300 ${plan.featured ? "bg-cyan-300 text-slate-950 hover:bg-cyan-200" : "border border-white/15 text-white hover:bg-white/5"}`}>ดูรายละเอียด {plan.name}</Link>
        </article>)}
      </div>
      <div className="mt-5 flex flex-col gap-3 rounded-2xl border border-white/10 bg-white/[.025] p-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div><h3 className="font-semibold text-white">มี Boost เป็นส่วนเสริมเมื่อพร้อมใช้งาน</h3><p className="mt-1 text-sm leading-relaxed text-slate-400">5 สิทธิ์ ฿109 หรือ 15 สิทธิ์ ฿299 · เคสยาวหรือมีรูปอาจใช้สิทธิ์มากขึ้น</p></div>
        <Link href="/pricing" className="shrink-0 text-sm font-medium text-cyan-200 underline underline-offset-4">รายละเอียดแพ็กเกจและ Boost →</Link>
      </div>
      <p className="mx-auto mt-5 max-w-4xl text-center text-xs leading-relaxed text-slate-500">จำนวนเคสต่อเดือนเป็นค่าประมาณจากวงเงิน AI ไม่ใช่โควตารับประกัน การใช้งานขึ้นกับความยาวข้อความและจำนวนภาพ รายปีชำระเต็มรอบ และรายละเอียดราคา/สิทธิ์ที่หน้าแพ็กเกจเป็นข้อมูลอ้างอิงล่าสุด</p>
    </section>
  );
}
