import type { Metadata } from "next";
import Link from "next/link";

const PAGE_URL = "https://dischargex.net/summary-charge";
const PAGE_TITLE = "สรุปชาร์จ คืออะไร? วิธีทำให้เร็วและครบ สำหรับงาน IPD | DischargeX";
const PAGE_DESCRIPTION =
  "คู่มือสรุปชาร์จสำหรับโรงพยาบาลไทย: แนวทางทำสรุปชาร์จให้ครบขึ้น, ลดตกหล่น coding/ICD-10, พร้อม checklist และตัวอย่างการใช้งานจริง.";

export const metadata: Metadata = {
  title: { absolute: PAGE_TITLE },
  description: PAGE_DESCRIPTION,
  alternates: { canonical: "/summary-charge" },
  keywords: [
    "สรุปชาร์จ",
    "สรุปชาร์จ คือ",
    "วิธีทำสรุปชาร์จ",
    "ICD-10",
    "Thai DRG",
    "เวชระเบียน IPD",
  ],
  openGraph: {
    title: PAGE_TITLE,
    description: PAGE_DESCRIPTION,
    url: PAGE_URL,
    siteName: "DischargeX",
    locale: "th_TH",
    type: "article",
  },
  twitter: {
    card: "summary_large_image",
    title: PAGE_TITLE,
    description: PAGE_DESCRIPTION,
  },
};

function SummaryChargeJsonLd() {
  const data = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "FAQPage",
        mainEntity: [
          {
            "@type": "Question",
            name: "สรุปชาร์จ คืออะไร?",
            acceptedAnswer: {
              "@type": "Answer",
              text: "สรุปชาร์จ คือการสรุปข้อมูลสำคัญจากเวชระเบียนเพื่อนำไปใช้ทบทวนการจัดโครง coding และเลือก ICD-10/หัตถการที่เกี่ยวข้องอย่างเป็นระบบ ก่อนใช้งานจริง.",
            },
          },
          {
            "@type": "Question",
            name: "ทำสรุปชาร์จให้เร็วขึ้นได้อย่างไร?",
            acceptedAnswer: {
              "@type": "Answer",
              text: "เริ่มจาก checklist ข้อมูลที่ต้องมี, จัดหัวข้อหลักให้คงที่, และใช้เครื่องมือช่วยทบทวน diagnosis/ICD-10 เพื่อลดการตกหล่นก่อนส่งต่อหน้างาน.",
            },
          },
          {
            "@type": "Question",
            name: "DischargeX แทนการตัดสินใจทางการแพทย์หรือการเบิกจ่ายอย่างเป็นทางการหรือไม่?",
            acceptedAnswer: {
              "@type": "Answer",
              text: "ไม่ใช่ DischargeX เป็นเครื่องมือช่วยทบทวนข้อมูล ผู้ใช้งานยังต้องตรวจความถูกต้องกับเวชระเบียนและแนวทางของหน่วยงานก่อนใช้งานจริง.",
            },
          },
        ],
      },
      {
        "@type": "HowTo",
        name: "วิธีทำสรุปชาร์จแบบเป็นระบบ",
        step: [
          {
            "@type": "HowToStep",
            name: "เตรียมข้อมูลจากเวชระเบียน",
            text: "รวบรวมข้อมูลสำคัญ เช่น diagnosis หลัก โรคร่วม ภาวะแทรกซ้อน การตรวจ และการรักษา.",
          },
          {
            "@type": "HowToStep",
            name: "จัดโครงสรุปชาร์จตามหัวข้อมาตรฐาน",
            text: "จัดลำดับหัวข้อให้ชัดเจนเพื่อช่วยตรวจความครบถ้วนและลดจุดตกหล่น.",
          },
          {
            "@type": "HowToStep",
            name: "ทบทวน ICD-10 และหลักฐานสนับสนุน",
            text: "เช็กความสอดคล้องระหว่างข้อความสรุปกับ ICD-10 ก่อนนำผลลัพธ์ไปใช้ใน workflow จริง.",
          },
        ],
      },
    ],
  };
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }} />;
}

export default function SummaryChargePage() {
  return (
    <main className="min-h-screen bg-[#081120] text-slate-100">
      <SummaryChargeJsonLd />
      <section className="border-b border-white/10 bg-gradient-to-b from-slate-900/60 via-[#0a1628] to-[#081120]">
        <div className="mx-auto max-w-5xl px-4 py-14 md:py-16">
          <p className="inline-flex rounded-full border border-cyan-500/40 bg-cyan-500/10 px-3 py-1 text-xs font-semibold text-cyan-100">
            คู่มือสรุปชาร์จสำหรับงาน IPD
          </p>
          <h1 className="mt-5 text-3xl font-bold tracking-tight text-white md:text-4xl">
            สรุปชาร์จ คืออะไร และทำอย่างไรให้เร็วขึ้นแต่ยังครบถ้วน
          </h1>
          <p className="mt-4 max-w-3xl text-base leading-relaxed text-slate-300">
            หน้านี้สรุปหลักคิดการทำสรุปชาร์จแบบใช้งานจริงในโรงพยาบาลไทย พร้อม checklist และแนวทางลดจุดตกหล่นของ diagnosis/ICD-10
            ก่อนนำไปใช้ในงานเวชระเบียน.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href="/app"
              className="rounded-xl bg-cyan-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-cyan-500"
            >
              ไปหน้าสรุปชาร์จ
            </Link>
            <Link
              href="/chat"
              className="rounded-xl border border-cyan-500/50 bg-cyan-500/10 px-5 py-2.5 text-sm font-semibold text-cyan-100 transition hover:bg-cyan-500/20"
            >
              เริ่มคุยกับ AI Chat
            </Link>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-4 py-10">
        <h2 className="text-xl font-semibold text-white md:text-2xl">Checklist การสรุปชาร์จที่ควรมี</h2>
        <ul className="mt-4 list-disc space-y-2 pl-5 text-slate-200">
          <li>Principal diagnosis ที่สอดคล้องกับข้อมูลใน chart</li>
          <li>Comorbidity/Complication ที่มีหลักฐานสนับสนุน</li>
          <li>Investigation และ treatment สำคัญที่เกี่ยวข้องกับการดูแลจริง</li>
          <li>ทบทวนรหัส ICD-10/หัตถการก่อนใช้งานจริง</li>
        </ul>
      </section>

      <section className="mx-auto max-w-5xl px-4 pb-10">
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
          <h2 className="text-xl font-semibold text-white md:text-2xl">คำถามที่พบบ่อย</h2>
          <div className="mt-4 space-y-4 text-sm leading-relaxed text-slate-300">
            <div>
              <h3 className="font-semibold text-slate-100">สรุปชาร์จต่างจากการสรุป discharge summary ทั่วไปไหม?</h3>
              <p className="mt-1">ต่างในเป้าหมายหลัก โดยสรุปชาร์จจะเน้นความครบถ้วนด้าน coding และข้อมูลที่ใช้ทบทวนรหัส.</p>
            </div>
            <div>
              <h3 className="font-semibold text-slate-100">เครื่องมือ AI ช่วยอะไรได้บ้าง?</h3>
              <p className="mt-1">ช่วยจัดโครงสรุป, ชี้จุดข้อมูลที่อาจตกหล่น, และเสนอแนวทางทบทวน ICD-10 อย่างเป็นระบบ.</p>
            </div>
            <div>
              <h3 className="font-semibold text-slate-100">ต้องตรวจทานโดยคนอีกไหม?</h3>
              <p className="mt-1">ต้องตรวจทานเสมอ โดยแพทย์หรือผู้รับผิดชอบ เพื่อยืนยันความถูกต้องก่อนใช้งานจริง.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="border-t border-white/10">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-3 px-4 py-8 text-sm">
          <Link href="/" className="text-cyan-300 underline-offset-2 hover:underline">
            กลับหน้าหลัก
          </Link>
          <span className="text-slate-600">·</span>
          <Link href="/guidelines" className="text-cyan-300 underline-offset-2 hover:underline">
            ดูแนวทางใช้งาน
          </Link>
          <span className="text-slate-600">·</span>
          <Link href="/icd10-review" className="text-cyan-300 underline-offset-2 hover:underline">
            ทบทวน ICD-10
          </Link>
          <span className="text-slate-600">·</span>
          <Link href="/knowledge" className="text-cyan-300 underline-offset-2 hover:underline">
            Clinical Knowledge
          </Link>
          <span className="text-slate-600">·</span>
          <Link href="/pricing" className="text-cyan-300 underline-offset-2 hover:underline">
            ดูราคาและแพ็กเกจ
          </Link>
        </div>
      </section>
    </main>
  );
}
