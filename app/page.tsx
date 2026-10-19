import type { Metadata } from "next";
import Link from "next/link";
import { ImpactStats } from "./components/ImpactStats";
import { ValueCalculator } from "./components/ValueCalculator";

export const metadata: Metadata = {
  title: { absolute: "DischargeX — สรุปชาร์จและทบทวน coding สำหรับงาน IPD" },
  description: "ตัวช่วยจัดร่าง discharge summary เสนอ diagnosis และ procedure ให้ทบทวน พร้อมประมาณผลต่อ coding review และ AdjRW ด้วยข้อมูลตัวอย่างให้ลองได้ทันที",
  alternates: { canonical: "/" },
  openGraph: {
    title: "DischargeX — สรุปชาร์จและทบทวน coding สำหรับงาน IPD",
    description: "ดูวิธีจัดร่างสรุปชาร์จและทบทวน coding แล้วลองด้วยข้อมูลตัวอย่างได้ทันที",
    url: "https://dischargex.net", locale: "th_TH", type: "website",
  },
};

const demoHref = "/app/guest?tutorial=1";
const primary = "inline-flex items-center justify-center rounded-xl bg-cyan-300 px-6 py-3.5 font-semibold text-slate-950 shadow-lg shadow-cyan-950/30 transition hover:-translate-y-0.5 hover:bg-cyan-200 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-cyan-300";

const steps = [
  { number: "01", title: "ใส่ข้อมูลต้นทาง", text: "เริ่มจาก Order Sheet และตรวจข้อมูลก่อนสร้างร่างสรุป" },
  { number: "02", title: "ดูร่างที่จัดเป็นหมวด", text: "ไล่อ่านการวินิจฉัย การรักษา ผลการรักษา และแผนติดตาม" },
  { number: "03", title: "ตรวจทานก่อนนำไปใช้", text: "แก้ไขให้ตรงกับบันทึกและบริบทของเคสทุกครั้ง" },
];

export default function Home() {
  return (
    <main className="min-h-screen overflow-hidden bg-[#07111f] text-slate-100">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
        "@context": "https://schema.org", "@type": "SoftwareApplication", name: "DischargeX", url: "https://dischargex.net",
        applicationCategory: "HealthApplication", operatingSystem: "Web", description: "ผู้ช่วยสร้างร่างสรุปชาร์จให้ผู้ใช้ตรวจทาน",
      }) }} />

      <section className="relative isolate overflow-hidden border-b border-white/10 bg-[radial-gradient(ellipse_at_50%_0%,_rgba(8,145,178,.28),_transparent_48%),linear-gradient(180deg,#0a1728_0%,#07111f_72%,#091a28_100%)]">
        <div aria-hidden="true" className="pointer-events-none absolute left-1/2 top-36 h-96 w-[42rem] -translate-x-1/2 rounded-full bg-cyan-400/[.07] blur-3xl" />
        <div className="relative mx-auto max-w-5xl px-5 pb-14 pt-12 text-center sm:px-8 sm:pb-16 sm:pt-16 lg:pb-20 lg:pt-20">
          <p className="mx-auto inline-flex items-center gap-2 rounded-full border border-cyan-300/25 bg-cyan-300/[.07] px-4 py-2 text-xs font-medium tracking-wide text-cyan-100 sm:text-sm">
            <span aria-hidden="true" className="h-2 w-2 rounded-full bg-cyan-300 shadow-[0_0_12px_rgba(103,232,249,.8)]" />
            AI สำหรับสรุปชาร์จ · เวชระเบียน IPD · ทบทวน ICD-10
          </p>
          <h1 className="mt-6 text-6xl font-bold leading-none tracking-[-.065em] text-white sm:text-7xl md:text-8xl lg:text-[7.5rem]">
            Discharge<span className="bg-gradient-to-br from-cyan-300 to-sky-500 bg-clip-text text-transparent">X</span>
          </h1>
          <h2 className="mx-auto mt-5 max-w-4xl text-2xl font-semibold leading-snug tracking-tight text-slate-50 sm:text-3xl lg:text-4xl">
            สรุปชาร์จไวขึ้น <span className="text-cyan-300">·</span> จัดโครง coding เป็นระบบมากขึ้น
          </h2>
          <p className="mx-auto mt-5 max-w-3xl text-base leading-8 text-slate-300 sm:text-lg">
            ช่วยจัดร่าง discharge summary เสนอการจัดกลุ่ม diagnosis และชี้จุด diagnosis หรือ procedure ที่อาจตกหล่น
            พร้อมประมาณผลต่อ coding review และ AdjRW ให้ผู้ใช้ตรวจทานกับเวชระเบียนต้นทาง
          </p>

          <div className="mt-8 grid gap-3 text-left sm:grid-cols-2">
            {[
              "ช่วยลดเวลาจัดทำร่างสรุปชาร์จ",
              "ช่วยชี้ข้อมูลสำคัญที่อาจพิมพ์ผิดหรือตกหล่น",
              "เสนอ ICD ที่สอดคล้องกับข้อมูลเพื่อให้ทบทวน",
              "ชี้จุดที่ควรตรวจทานก่อนนำไปใช้งานจริง",
            ].map((benefit) => (
              <div key={benefit} className="flex min-h-12 items-center gap-3 rounded-xl border border-white/10 bg-white/[.045] px-4 py-3 text-sm leading-relaxed text-slate-200 shadow-sm shadow-black/10 sm:px-5">
                <span aria-hidden="true" className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-cyan-400/15 text-xs font-bold text-cyan-300">✓</span>
                <span>{benefit}</span>
              </div>
            ))}
          </div>

          <p className="mx-auto mt-6 max-w-3xl text-sm leading-6 text-slate-400">
            อ้างอิงหลักการจาก ICD-10, Thai DRG และแนวทาง coding ที่เกี่ยวข้อง ผลลัพธ์เป็นร่าง ข้อเสนอ หรือค่าประมาณ
            ควรตรวจทานกับข้อมูลต้นทางและหลักเกณฑ์ของหน่วยงานก่อนใช้งาน ไม่ใช่การรับรองผลการเบิกจ่าย
          </p>

          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row sm:flex-wrap">
            <Link href={demoHref} className={primary}>ลองใช้ข้อมูลตัวอย่าง ไม่ต้องสมัคร <span aria-hidden="true" className="ml-2">→</span></Link>
            <Link href="/pricing" className="inline-flex items-center justify-center rounded-xl border border-white/20 bg-white/[.04] px-6 py-3.5 font-medium text-slate-100 transition hover:border-cyan-200/50 hover:bg-white/[.08] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-cyan-300">ดูแพ็กเกจและราคา</Link>
            <Link href="/learn" className="inline-flex items-center justify-center rounded-xl px-5 py-3.5 font-medium text-cyan-100 underline decoration-cyan-300/40 underline-offset-4 transition hover:text-white focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-cyan-300">ดูวิธีทำงาน</Link>
          </div>
          <p className="mt-4 text-sm text-slate-400">เริ่มดูขั้นตอนด้วยข้อมูลตัวอย่างได้ทันที · ผลสรุปทุกครั้งต้องตรวจทาน</p>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 py-14 sm:px-8 sm:py-16" aria-labelledby="video-heading">
        <div className="mx-auto mb-7 max-w-2xl text-center">
          <p className="text-sm font-medium tracking-wide text-cyan-300">เห็นภาพก่อนเริ่ม</p>
          <h2 id="video-heading" className="mt-2 text-2xl font-semibold tracking-tight text-white sm:text-3xl">ดูตัวอย่างการใช้งาน DischargeX</h2>
          <p className="mt-3 leading-relaxed text-slate-400">ชมขั้นตอน แล้วลองทำตามด้วยข้อมูลตัวอย่างได้เลย</p>
        </div>
        <div className="relative mx-auto w-full max-w-4xl">
          <div className="absolute -inset-3 rounded-[1.7rem] bg-gradient-to-br from-cyan-400/15 via-blue-500/10 to-teal-300/10 blur-xl" aria-hidden="true" />
          <div className="relative overflow-hidden rounded-2xl border border-white/15 bg-slate-950 shadow-2xl shadow-black/40">
            <video controls playsInline preload="metadata" muted className="aspect-video w-full bg-black object-contain" aria-label="วิดีโอแนะนำวิธีเริ่มใช้ DischargeX ไม่มีเสียง">
              <source src="/media/getting-started.mp4" type="video/mp4" />
              เบราว์เซอร์นี้ไม่รองรับวิดีโอ สามารถ <a href="/media/getting-started.mp4" className="underline">เปิดไฟล์วิดีโอ</a> ได้
            </video>
            <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-5">
              <p className="text-sm text-slate-400">วิดีโอแนะนำแบบไม่มีเสียง · ใช้ข้อมูลตัวอย่างในโหมดทดลอง</p>
              <Link href={demoHref} className="text-sm font-medium text-cyan-200 underline decoration-cyan-300/40 underline-offset-4 hover:text-white">ลองด้วยตัวเอง →</Link>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 py-16 sm:px-8 lg:py-20" aria-labelledby="steps-heading">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-medium tracking-wide text-cyan-300">เริ่มจากเคสตัวอย่าง</p>
          <h2 id="steps-heading" className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">เห็นงานตั้งแต่ต้นจนจบ</h2>
          <p className="mt-4 leading-relaxed text-slate-400">ลองดูหน้าจอและรูปแบบผลลัพธ์ก่อนตัดสินใจใช้งาน</p>
        </div>
        <div className="mt-10 grid gap-4 md:grid-cols-3">
          {steps.map((step) => <article key={step.number} className="rounded-2xl border border-white/10 bg-gradient-to-b from-white/[.055] to-white/[.02] p-6 shadow-lg shadow-black/10">
            <span className="text-sm font-semibold tracking-widest text-cyan-300">{step.number}</span>
            <h3 className="mt-4 text-xl font-semibold text-white">{step.title}</h3>
            <p className="mt-3 leading-relaxed text-slate-400">{step.text}</p>
          </article>)}
        </div>
        <div className="mt-8 text-center"><Link href={demoHref} className="font-medium text-cyan-200 underline decoration-cyan-300/40 underline-offset-4 hover:text-white">ลองตัวอย่างทันที ไม่ต้องสมัคร →</Link></div>
      </section>

      <div className="border-y border-white/10 bg-white/[.025]"><ImpactStats /></div>
      <ValueCalculator />

      <section className="mx-auto grid max-w-7xl gap-5 px-5 py-14 sm:px-8 md:grid-cols-2 lg:py-16">
        <article className="rounded-2xl border border-white/10 bg-slate-900/60 p-6 sm:p-8">
          <p className="text-sm font-medium text-cyan-300">ตรวจทานเป็นขั้นตอน</p>
          <h2 className="mt-3 text-2xl font-semibold">ร่างช่วยจัดข้อมูล<br />ผู้ใช้เป็นคนยืนยัน</h2>
          <p className="mt-4 leading-relaxed text-slate-300">ตรวจความครบถ้วนและความถูกต้องเทียบกับบันทึกต้นทางก่อนนำผลไปใช้ทุกครั้ง</p>
          <Link href="/learn" className="mt-6 inline-flex text-cyan-200 underline underline-offset-4">อ่านคู่มือการเริ่มต้น →</Link>
        </article>
        <article className="rounded-2xl border border-cyan-200/15 bg-gradient-to-br from-cyan-950/60 to-slate-900/80 p-6 sm:p-8">
          <p className="text-sm font-medium text-cyan-300">เลือกตามจังหวะงาน</p>
          <h2 className="mt-3 text-2xl font-semibold">เริ่มทดลอง แล้วค่อยเลือกแพ็กเกจ</h2>
          <p className="mt-4 leading-relaxed text-slate-300">ดูราคา โควตา และรายละเอียดสิทธิ์ของแต่ละแพ็กเกจก่อนเริ่มใช้งานกับบัญชีของคุณ</p>
          <div className="mt-6 flex flex-wrap gap-3"><Link href="/pricing" className="rounded-lg border border-cyan-200/30 px-4 py-2.5 text-cyan-100 hover:bg-cyan-100/10">ดูแพ็กเกจ</Link><Link href="/knowledge" className="rounded-lg border border-white/15 px-4 py-2.5 text-slate-200 hover:bg-white/5">คลังความรู้</Link></div>
        </article>
      </section>

      <section className="border-t border-white/10 bg-[radial-gradient(ellipse_at_center,_rgba(8,145,178,.14),_transparent_65%)] px-5 py-16 text-center sm:px-8">
        <p className="text-sm font-medium text-cyan-300">พร้อมลองหรือยัง</p>
        <h2 className="mx-auto mt-3 max-w-2xl text-3xl font-semibold tracking-tight sm:text-4xl">ลองดูขั้นตอนและผลตัวอย่างด้วยตัวเอง</h2>
        <p className="mx-auto mt-4 max-w-xl leading-relaxed text-slate-300">เริ่มด้วยข้อมูลตัวอย่างได้ทันที ไม่ต้องสมัคร</p>
        <Link href={demoHref} className={`${primary} mt-7`}>ลองตัวอย่างทันที ไม่ต้องสมัคร <span aria-hidden="true" className="ml-2">→</span></Link>
      </section>
    </main>
  );
}
