import type { Metadata } from "next";
import Link from "next/link";

const PAGE_URL = "https://dischargex.net/automator";
const PAGE_TITLE = "Automator — โปรแกรมกรอก HOSxP อัตโนมัติจากสรุปชาร์จ AI | DischargeX";
const PAGE_DESCRIPTION =
  "โปรแกรมบนคอมพิวเตอร์ที่ดึงข้อมูล doctor order sheet, สรุปชาร์จด้วย AI เครื่องเดียวกับเว็บ, แล้วกรอกเข้า HOSxP ให้ต่อเนื่องหลายเคสโดยไม่ต้องนั่งเฝ้าทีละเคส สำหรับโรงพยาบาลที่ใช้ HOSxP.";

export const metadata: Metadata = {
  title: { absolute: PAGE_TITLE },
  description: PAGE_DESCRIPTION,
  alternates: { canonical: "/automator" },
  keywords: [
    "automator HOSxP",
    "กรอกเวชระเบียนอัตโนมัติ",
    "สรุปชาร์จอัตโนมัติ",
    "HOSxP automation",
    "RPA โรงพยาบาล",
  ],
  openGraph: {
    title: PAGE_TITLE,
    description: PAGE_DESCRIPTION,
    url: PAGE_URL,
    siteName: "DischargeX",
    locale: "th_TH",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: PAGE_TITLE,
    description: PAGE_DESCRIPTION,
  },
};

function AutomatorJsonLd() {
  const data = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "SoftwareApplication",
        name: "DischargeX Automator",
        applicationCategory: "HealthApplication",
        operatingSystem: "Windows",
        description: PAGE_DESCRIPTION,
        url: PAGE_URL,
      },
      {
        "@type": "FAQPage",
        mainEntity: [
          {
            "@type": "Question",
            name: "Automator ใช้ได้กับระบบเวชระเบียนอื่นนอกจาก HOSxP ไหม?",
            acceptedAnswer: {
              "@type": "Answer",
              text: "ตอนนี้รองรับเฉพาะ HOSxP เท่านั้น เพราะขั้นตอนการกรอกถูกออกแบบมาตามหน้าจอ HOSxP โดยเฉพาะ ยังไม่รองรับระบบเวชระเบียนอื่น",
            },
          },
          {
            "@type": "Question",
            name: "ต้องตรวจทานผลลัพธ์เองไหม?",
            acceptedAnswer: {
              "@type": "Answer",
              text: "ต้องตรวจทานเสมอ โปรแกรมมีโหมด Dry-run ให้ทดสอบก่อนกรอกเข้า HOSxP จริง และผู้ใช้งาน (แพทย์/เจ้าหน้าที่) เป็นผู้รับผิดชอบผลลัพธ์สุดท้ายก่อนบันทึกเข้าเวชระเบียน",
            },
          },
          {
            "@type": "Question",
            name: "ต้องตั้งค่าอะไรก่อนใช้งานครั้งแรก?",
            acceptedAnswer: {
              "@type": "Answer",
              text: "ต้อง calibrate ตำแหน่งปุ่มบนหน้าจอ HOSxP ของเครื่องนั้นครั้งแรก (ขึ้นกับความละเอียดจอและตำแหน่งหน้าต่าง) และล็อกอินด้วยบัญชี DischargeX เดียวกับที่ใช้บนเว็บ",
            },
          },
          {
            "@type": "Question",
            name: "แพ็กไหนใช้ Automator ได้?",
            acceptedAnswer: {
              "@type": "Answer",
              text: "ปลดล็อกตั้งแต่แพ็ก Pro ขึ้นไป ดูรายละเอียดที่หน้าราคาและแพ็กเกจ",
            },
          },
        ],
      },
    ],
  };
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }} />;
}

export default function AutomatorPage() {
  return (
    <main className="min-h-screen bg-[#081120] text-slate-100">
      <AutomatorJsonLd />
      <section className="border-b border-white/10 bg-gradient-to-b from-slate-900/60 via-[#0a1628] to-[#081120]">
        <div className="mx-auto max-w-5xl px-4 py-14 md:py-16">
          <p className="inline-flex rounded-full border border-cyan-500/40 bg-cyan-500/10 px-3 py-1 text-xs font-semibold text-cyan-100">
            สำหรับโรงพยาบาลที่ใช้ HOSxP
          </p>
          <h1 className="mt-5 text-3xl font-bold tracking-tight text-white md:text-4xl">
            Automator — สรุปชาร์จและกรอก HOSxP ต่อเนื่องหลายเคส โดยไม่ต้องนั่งเฝ้า
          </h1>
          <p className="mt-4 max-w-3xl text-base leading-relaxed text-slate-300">
            โปรแกรมบนคอมพิวเตอร์ที่ดึงข้อความจาก doctor order sheet, สรุปชาร์จด้วย AI เครื่องเดียวกับที่ใช้บนเว็บ
            แล้วกรอกเข้า HOSxP ให้ต่อเนื่องทีละคิว — ตั้งจำนวนเคส กดเริ่ม แล้วกลับมาตรวจผลทีหลังได้
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href="/pricing"
              className="rounded-xl bg-cyan-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-cyan-500"
            >
              ดูแพ็กที่ปลดล็อก Automator
            </Link>
            <Link
              href="/app/guest?tutorial=1"
              className="rounded-xl border border-cyan-500/50 bg-cyan-500/10 px-5 py-2.5 text-sm font-semibold text-cyan-100 transition hover:bg-cyan-500/20"
            >
              ลองสรุปชาร์จบนเว็บก่อน (ไม่ต้องสมัคร)
            </Link>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-4 py-10">
        <h2 className="text-xl font-semibold text-white md:text-2xl">Automator ทำอะไรให้บ้าง</h2>
        <ul className="mt-4 list-disc space-y-2 pl-5 text-slate-200">
          <li>ดึงข้อความ doctor order sheet จากคิวผู้ป่วยใน HOSxP ให้อัตโนมัติ</li>
          <li>สรุปชาร์จด้วย AI เครื่องเดียวกับเว็บ (de-identify ข้อมูลผู้ป่วยก่อนส่งประมวลผลทุกครั้ง)</li>
          <li>กรอกผลลัพธ์กลับเข้า HOSxP ต่อเนื่องได้หลายเคสในรอบเดียว</li>
          <li>มีโหมด Dry-run ให้ทดสอบก่อนกรอกเข้าเวชระเบียนจริง</li>
          <li>ล็อกอินด้วยบัญชี DischargeX เดียวกับเว็บ ไม่ต้องมี API key ของตัวเอง</li>
        </ul>
      </section>

      <section className="mx-auto max-w-5xl px-4 pb-10">
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
          <h2 className="text-xl font-semibold text-white md:text-2xl">คำถามที่พบบ่อย</h2>
          <div className="mt-4 space-y-4 text-sm leading-relaxed text-slate-300">
            <div>
              <h3 className="font-semibold text-slate-100">ใช้ได้กับระบบเวชระเบียนอื่นนอกจาก HOSxP ไหม?</h3>
              <p className="mt-1">ตอนนี้รองรับเฉพาะ HOSxP เท่านั้น เพราะขั้นตอนกรอกออกแบบมาตามหน้าจอ HOSxP โดยเฉพาะ</p>
            </div>
            <div>
              <h3 className="font-semibold text-slate-100">ต้องตรวจทานผลลัพธ์เองไหม?</h3>
              <p className="mt-1">
                ต้องตรวจทานเสมอ มีโหมด Dry-run ให้ทดสอบก่อน และผู้ใช้งานเป็นผู้รับผิดชอบผลลัพธ์สุดท้ายก่อนบันทึกจริง
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-slate-100">ต้องตั้งค่าอะไรก่อนใช้งานครั้งแรก?</h3>
              <p className="mt-1">
                ต้อง calibrate ตำแหน่งปุ่มบนหน้าจอ HOSxP ของเครื่องนั้นครั้งแรก (ขึ้นกับความละเอียดจอ/ตำแหน่งหน้าต่าง)
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-slate-100">แพ็กไหนใช้ Automator ได้?</h3>
              <p className="mt-1">
                ปลดล็อกตั้งแต่แพ็ก Pro ขึ้นไป ดูรายละเอียดที่{" "}
                <Link href="/pricing" className="text-cyan-300 underline hover:text-cyan-200">
                  หน้าราคาและแพ็กเกจ
                </Link>
              </p>
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
          <Link href="/summary-charge" className="text-cyan-300 underline-offset-2 hover:underline">
            สรุปชาร์จคืออะไร
          </Link>
          <span className="text-slate-600">·</span>
          <Link href="/guidelines" className="text-cyan-300 underline-offset-2 hover:underline">
            ดูแนวทางใช้งาน
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
