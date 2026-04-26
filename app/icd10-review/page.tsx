import type { Metadata } from "next";
import Link from "next/link";

const PAGE_URL = "https://dischargex.net/icd10-review";
const PAGE_TITLE = "ทบทวน ICD-10 ก่อนลงสรุปชาร์จ: checklist และแนวทาง | DischargeX";
const PAGE_DESCRIPTION =
  "คู่มือทบทวน ICD-10 สำหรับงานเวชระเบียนไทย: หลักฐานที่ควรมี, การจับคู่ diagnosis กับรหัส, และการใช้ AI เป็นเครื่องมือช่วยทบทวน — ไม่ใช่การจัดกลุ่มอย่างเป็นทางการ.";

export const metadata: Metadata = {
  title: { absolute: PAGE_TITLE },
  description: PAGE_DESCRIPTION,
  alternates: { canonical: "/icd10-review" },
  keywords: [
    "ICD-10",
    "ทบทวน ICD-10",
    "coding เวชระเบียน",
    "สรุปชาร์จ",
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

function Icd10ReviewJsonLd() {
  const data = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "FAQPage",
        mainEntity: [
          {
            "@type": "Question",
            name: "ทำไมต้องทบทวน ICD-10 ก่อนลงสรุปชาร์จ?",
            acceptedAnswer: {
              "@type": "Answer",
              text: "รหัส ICD-10 ต้องสอดคล้องกับหลักฐานในเวชระเบียน การทบทวนก่อนลงช่วยลดความเสี่ยงจากรหัสกว้างเกินไป รหัสที่ไม่ตรงกับข้อเท็จจริงใน chart หรือการลงรหัสซ้ำซ้อนโดยไม่จำเป็น.",
            },
          },
          {
            "@type": "Question",
            name: "AI ช่วยทบทวน ICD-10 ได้อย่างไร?",
            acceptedAnswer: {
              "@type": "Answer",
              text: "AI ช่วยเสนอแนวทางและ checklist จากข้อความที่ผู้ใช้วางเข้ามา แต่ผู้ตรวจรหัสหรือแพทย์ยังเป็นผู้ยืนยันความถูกต้องกับเวชระเบียนจริงก่อนใช้งาน.",
            },
          },
          {
            "@type": "Question",
            name: "ควรอ้างอิงเอกสารมาตรฐานใด?",
            acceptedAnswer: {
              "@type": "Answer",
              text: "ควรอิงคู่มือหรือประกาศของหน่วยงานที่เกี่ยวข้อง (เช่น แนวทาง สปสช. หรือคู่มือ ICD-10 ที่หน่วยงานกำหนด) และบันทึกแหล่งอ้างอิงตามนโยบายของโรงพยาบาล.",
            },
          },
        ],
      },
      {
        "@type": "HowTo",
        name: "ขั้นตอนทบทวน ICD-10 ก่อนใช้งานจริง",
        step: [
          {
            "@type": "HowToStep",
            name: "ตรวจ Principal diagnosis กับ chart",
            text: "ยืนยันว่าชื่อโรคหลักสอดคล้องกับอาการ การตรวจ และการรักษาที่บันทึกไว้.",
          },
          {
            "@type": "HowToStep",
            name: "ตรวจ Comorbidity และ Complication",
            text: "แยกบทบาทโรคให้ชัด และมีหลักฐานสนับสนุนแต่ละรหัส.",
          },
          {
            "@type": "HowToStep",
            name: "ตรวจความจำเพาะของรหัส",
            text: "หลีกเลี่ยงรหัสกว้างเกินไปเมื่อ chart ระบุได้ชัดเจนกว่า และตรวจสอบกับคู่มือที่หน่วยงานใช้.",
          },
        ],
      },
    ],
  };
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }} />;
}

export default function Icd10ReviewPage() {
  return (
    <main className="min-h-screen bg-[#081120] text-slate-100">
      <Icd10ReviewJsonLd />
      <section className="border-b border-white/10 bg-gradient-to-b from-slate-900/60 via-[#0a1628] to-[#081120]">
        <div className="mx-auto max-w-5xl px-4 py-14 md:py-16">
          <p className="inline-flex rounded-full border border-violet-500/40 bg-violet-500/10 px-3 py-1 text-xs font-semibold text-violet-100">
            คู่มือทบทวน ICD-10 สำหรับงาน IPD
          </p>
          <h1 className="mt-5 text-3xl font-bold tracking-tight text-white md:text-4xl">
            ทบทวน ICD-10 ก่อนลงสรุปชาร์จ: checklist และแนวทางใช้งานจริง
          </h1>
          <p className="mt-4 max-w-3xl text-base leading-relaxed text-slate-300">
            หน้านี้เชื่อมกับ workflow สรุปชาร์จ: เน้นหลักฐานใน chart, การแยกบทบาทโรค, และการใช้เครื่องมือช่วยทบทวนอย่างมี accountability
            — ผลลัพธ์ยังต้องผ่านการตรวจทานโดยผู้รับผิดชอบเสมอ.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href="/app"
              className="rounded-xl bg-violet-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-violet-500"
            >
              ไปหน้าสรุปชาร์จ
            </Link>
            <Link
              href="/knowledge"
              className="rounded-xl border border-violet-500/50 bg-violet-500/10 px-5 py-2.5 text-sm font-semibold text-violet-100 transition hover:bg-violet-500/20"
            >
              Clinical Knowledge
            </Link>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-4 py-10">
        <h2 className="text-xl font-semibold text-white md:text-2xl">Checklist ทบทวน ICD-10</h2>
        <ul className="mt-4 list-disc space-y-2 pl-5 text-slate-200">
          <li>รหัสหลักสอดคล้องกับ Principal diagnosis ในเวชระเบียน</li>
          <li>โรคร่วมและภาวะแทรกซ้อนมีหลักฐานสนับสนุนแยกจากโรคหลัก</li>
          <li>ไม่ใช้รหัสกว้างเกินความจำเป็นเมื่อ chart ระบุระดับที่เฉพาะเจาะจงได้</li>
          <li>ตรวจความสอดคล้องกับหัตถการและเอกสารอ้างอิงของหน่วยงาน</li>
        </ul>
      </section>

      <section className="mx-auto max-w-5xl px-4 pb-10">
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
          <h2 className="text-xl font-semibold text-white md:text-2xl">คำถามที่พบบ่อย</h2>
          <div className="mt-4 space-y-4 text-sm leading-relaxed text-slate-300">
            <div>
              <h3 className="font-semibold text-slate-100">DischargeX จัดกลุ่ม DRG ให้ไหม?</h3>
              <p className="mt-1">ไม่ใช่ DischargeX เป็นเครื่องมือช่วยทบทวนการสรุปและ coding เท่านั้น.</p>
            </div>
            <div>
              <h3 className="font-semibold text-slate-100">ควรเริ่มจากสรุปชาร์จหรือทบทวนรหัสก่อน?</h3>
              <p className="mt-1">
                แนะนำจัดโครงสรุปชาร์จให้ชัดก่อน แล้วค่อยทบทวน ICD-10 ทีละบรรทัดกับ chart — ดู{" "}
                <Link href="/summary-charge" className="text-cyan-300 underline hover:text-cyan-200">
                  คู่มือสรุปชาร์จ
                </Link>
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="border-t border-white/10">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-3 px-4 py-8 text-sm">
          <Link href="/summary-charge" className="text-cyan-300 underline-offset-2 hover:underline">
            สรุปชาร์จคืออะไร
          </Link>
          <span className="text-slate-600">·</span>
          <Link href="/guidelines" className="text-cyan-300 underline-offset-2 hover:underline">
            แนวทางใช้งาน
          </Link>
          <span className="text-slate-600">·</span>
          <Link href="/" className="text-cyan-300 underline-offset-2 hover:underline">
            หน้าหลัก
          </Link>
        </div>
      </section>
    </main>
  );
}
