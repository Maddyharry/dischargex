import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import LandingPricingPreview from "./components/LandingPricingPreview";

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
const primaryCta = "inline-flex min-h-12 items-center justify-center rounded-xl bg-cyan-300 px-6 py-3 font-semibold text-slate-950 shadow-lg shadow-cyan-950/30 transition hover:-translate-y-0.5 hover:bg-cyan-200 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-cyan-300 motion-reduce:transform-none";
const features = [
  { icon: "✳", title: "ร่างสรุปจำหน่าย", text: "ช่วยจัดโครงสร้างข้อมูลเป็นร่าง discharge summary เพื่อให้อ่านและตรวจทานได้เป็นส่วน ๆ" },
  { icon: "⌕", title: "ทบทวน diagnosis", text: "แสดงข้อเสนอ diagnosis และรหัส ICD ที่สัมพันธ์กับข้อมูล เพื่อให้ผู้ใช้พิจารณา" },
  { icon: "▤", title: "Coding และ AdjRW", text: "ช่วยชี้จุดสำหรับทบทวน coding พร้อมค่าประมาณประกอบการตรวจสอบ" },
];
const steps = [
  { number: "01", title: "ใส่ข้อมูลต้นทาง", text: "เริ่มจาก Order Sheet และตรวจข้อมูลก่อนสร้างร่างสรุป" },
  { number: "02", title: "ดูร่างที่จัดเป็นหมวด", text: "ไล่อ่านการวินิจฉัย การรักษา ผลการรักษา และแผนติดตาม" },
  { number: "03", title: "ตรวจทานก่อนนำไปใช้", text: "แก้ไขให้ตรงกับบันทึกและบริบทของเคสทุกครั้ง" },
];

export default function Home() {
  return (
    <main className="min-h-screen overflow-hidden bg-[#07111f] text-slate-100 motion-reduce:[&_*]:transition-none">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
        "@context": "https://schema.org", "@type": "SoftwareApplication", name: "DischargeX", url: "https://dischargex.net",
        applicationCategory: "HealthApplication", operatingSystem: "Web", description: "ผู้ช่วยสร้างร่างสรุปชาร์จให้ผู้ใช้ตรวจทาน",
      }) }} />

      <section className="relative isolate overflow-hidden border-b border-white/10 bg-[radial-gradient(ellipse_at_50%_0%,_rgba(8,145,178,.23),_transparent_48%),linear-gradient(180deg,#0a1728_0%,#07111f_75%,#091a28_100%)]">
        <div aria-hidden="true" className="pointer-events-none absolute -right-40 top-20 h-96 w-96 rounded-full bg-cyan-400/[.08] blur-3xl" />
        <div className="relative mx-auto max-w-7xl px-5 pb-14 pt-8 sm:px-8 sm:pb-20 sm:pt-10">
          <div className="grid items-center gap-11 pt-14 lg:grid-cols-[.88fr_1.12fr] lg:gap-12 lg:pt-16">
            <div className="relative z-10 text-center lg:text-left">
              <p className="mx-auto inline-flex items-center gap-2 rounded-full border border-cyan-300/25 bg-cyan-300/[.07] px-4 py-2 text-xs font-medium tracking-wide text-cyan-100 sm:text-sm lg:mx-0">
                <span aria-hidden="true" className="h-2 w-2 rounded-full bg-cyan-300 shadow-[0_0_12px_rgba(103,232,249,.8)]" />
                ผู้ช่วยจัดร่างสรุปชาร์จและทบทวน coding สำหรับ IPD
              </p>
              <h1 className="mt-6 text-5xl font-bold leading-tight tracking-[-.045em] text-white sm:text-6xl lg:text-7xl">จัดร่างให้เป็นระบบ<br /><span className="bg-gradient-to-r from-cyan-200 via-cyan-300 to-sky-400 bg-clip-text text-transparent">ตรวจทานได้ชัดเจน</span></h1>
              <p className="mx-auto mt-5 max-w-xl text-base leading-8 text-slate-300 sm:text-lg lg:mx-0">DischargeX ช่วยจัดร่าง discharge summary เสนอ diagnosis และจุดสำหรับทบทวน coding โดยผู้ใช้ตรวจสอบกับเวชระเบียนต้นทางก่อนนำไปใช้</p>
              <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row lg:justify-start">
                <Link href={demoHref} className={primaryCta}>ลองตัวอย่างทันที ไม่ต้องสมัคร <span aria-hidden="true" className="ml-2">→</span></Link>
                <Link href="/pricing" className="inline-flex min-h-12 items-center justify-center rounded-xl border border-white/20 bg-white/[.04] px-6 py-3 font-medium text-slate-100 transition hover:border-cyan-200/50 hover:bg-white/[.08] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-cyan-300">ดูแพ็กเกจ</Link>
              </div>
              <div className="mt-8 flex flex-wrap justify-center gap-x-5 gap-y-2 text-xs text-slate-400 lg:justify-start sm:text-sm"><span>จัดร่างเป็นหมวดหมู่</span><span aria-hidden="true" className="text-cyan-300">·</span><span>มีจุดประกอบการตรวจทาน</span><span aria-hidden="true" className="text-cyan-300">·</span><span>เริ่มจากข้อมูลตัวอย่างได้</span></div>
            </div>

            <div className="relative mx-auto w-full max-w-3xl lg:pl-2">
              <div className="absolute -inset-5 rounded-[2rem] bg-cyan-400/[.12] blur-2xl" aria-hidden="true" />
              <div className="relative overflow-hidden rounded-2xl border border-cyan-200/30 bg-[#0b1d31] p-2.5 shadow-2xl shadow-black/50 sm:rounded-3xl sm:p-3">
                <div className="flex h-9 items-center gap-2 border-b border-white/10 px-2 sm:h-10"><span className="h-2.5 w-2.5 rounded-full bg-rose-400/80"/><span className="h-2.5 w-2.5 rounded-full bg-amber-300/80"/><span className="h-2.5 w-2.5 rounded-full bg-emerald-300/80"/><span className="ml-2 truncate rounded-md bg-slate-950/70 px-3 py-1 text-[10px] text-slate-500 sm:text-xs">app.dischargex.net · ตัวอย่างหน้าจอ</span></div>
                <Image src="/landing/dischargex-real-app.png" alt="ตัวอย่างหน้าจอ DischargeX สำหรับจัดร่างสรุปและตรวจทาน" width={1600} height={1000} priority sizes="(max-width: 1024px) 100vw, 58vw" className="mt-2 h-auto w-full rounded-lg object-cover object-top sm:rounded-xl" />
              </div>
              <p className="mt-3 text-center text-xs text-slate-500">ภาพตัวอย่างหน้าจอผลิตภัณฑ์</p>
            </div>
          </div>
        </div>
      </section>

      <section id="features" className="mx-auto max-w-7xl scroll-mt-8 px-5 py-14 sm:px-8 sm:py-16" aria-labelledby="features-heading">
        <div className="mx-auto max-w-2xl text-center"><p className="text-sm font-medium tracking-wide text-cyan-300">เครื่องมือช่วยจัดและทบทวน</p><h2 id="features-heading" className="mt-3 text-3xl font-semibold tracking-tight text-white sm:text-4xl">เห็นข้อมูลสำคัญในรูปแบบที่อ่านง่าย</h2><p className="mt-4 leading-relaxed text-slate-400">ใช้ข้อเสนอจากระบบเป็นจุดเริ่มต้น แล้วตรวจทานให้ตรงกับเอกสารและบริบทของผู้ป่วย</p></div>
        <div className="mt-9 grid gap-4 md:grid-cols-3">{features.map((feature) => <article key={feature.title} className="rounded-2xl border border-white/10 bg-gradient-to-b from-white/[.055] to-white/[.02] p-6 shadow-lg shadow-black/10"><span aria-hidden="true" className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-cyan-200/15 bg-cyan-300/10 text-xl text-cyan-200">{feature.icon}</span><h3 className="mt-5 text-lg font-semibold text-white">{feature.title}</h3><p className="mt-2 text-sm leading-7 text-slate-400">{feature.text}</p></article>)}</div>
        <div className="mt-5 grid gap-3 sm:grid-cols-2">{["ช่วยจัดโครงสร้างร่างสรุปชาร์จ", "แสดงข้อมูลสำคัญเพื่อให้ผู้ใช้พิจารณา", "เสนอ ICD เพื่อให้ตรวจทาน", "แสดงจุดประกอบการทบทวนก่อนนำไปใช้"].map((item) => <p key={item} className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[.025] px-4 py-3 text-sm text-slate-300"><span aria-hidden="true" className="text-cyan-300">✓</span>{item}</p>)}</div>
      </section>

      <section id="video" className="border-y border-white/10 bg-white/[.02]" aria-labelledby="video-heading">
        <div className="mx-auto grid max-w-7xl items-center gap-8 px-5 py-14 sm:px-8 lg:grid-cols-[.7fr_1.3fr] lg:py-16">
          <div><p className="text-sm font-medium tracking-wide text-cyan-300">เห็นภาพก่อนเริ่ม</p><h2 id="video-heading" className="mt-3 text-2xl font-semibold tracking-tight text-white sm:text-3xl">ดูตัวอย่างการใช้งาน DischargeX</h2><p className="mt-3 leading-relaxed text-slate-400">ทำความรู้จักขั้นตอน แล้วลองด้วยข้อมูลตัวอย่างได้ทันที</p><Link href={demoHref} className="mt-6 inline-flex text-sm font-medium text-cyan-200 underline decoration-cyan-300/40 underline-offset-4 hover:text-white">ลองตัวอย่าง ไม่ต้องสมัคร →</Link></div>
          <div className="relative"><div className="absolute -inset-3 rounded-[1.7rem] bg-gradient-to-br from-cyan-400/15 via-blue-500/10 to-teal-300/10 blur-xl" aria-hidden="true"/><div className="relative overflow-hidden rounded-2xl border border-white/15 bg-slate-950 shadow-2xl shadow-black/40"><iframe className="aspect-video w-full bg-black" src="https://www.youtube-nocookie.com/embed/_mIpiKuYrV4" title="วิดีโอแนะนำวิธีเริ่มใช้ DischargeX" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerPolicy="strict-origin-when-cross-origin" allowFullScreen/><div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-5"><p className="text-sm text-slate-400">วิดีโอแนะนำการใช้งาน</p><a href="https://youtu.be/_mIpiKuYrV4?si=6-msUGWTH_9h4lQV" target="_blank" rel="noreferrer" className="text-sm text-cyan-200 underline">เปิดวิดีโอใน YouTube</a></div></div></div>
        </div>
      </section>

      <section id="how-it-works" className="mx-auto max-w-7xl scroll-mt-8 px-5 py-16 sm:px-8 lg:py-20" aria-labelledby="steps-heading"><div className="mx-auto max-w-2xl text-center"><p className="text-sm font-medium tracking-wide text-cyan-300">เริ่มจากเคสตัวอย่าง</p><h2 id="steps-heading" className="mt-3 text-3xl font-semibold tracking-tight text-white sm:text-4xl">เริ่มต้นได้ใน 3 ขั้นตอน</h2><p className="mt-4 leading-relaxed text-slate-400">ทดลองขั้นตอนและดูรูปแบบผลลัพธ์ก่อนสมัคร</p></div><div className="mt-10 grid gap-4 md:grid-cols-3">{steps.map((step) => <article key={step.number} className="rounded-2xl border border-white/10 bg-gradient-to-b from-white/[.055] to-white/[.02] p-6 shadow-lg shadow-black/10"><span className="text-sm font-semibold tracking-widest text-cyan-300">{step.number}</span><h3 className="mt-4 text-xl font-semibold text-white">{step.title}</h3><p className="mt-3 leading-relaxed text-slate-400">{step.text}</p></article>)}</div></section>

      <div className="border-y border-white/10 bg-gradient-to-r from-cyan-950/30 via-white/[.025] to-blue-950/30"><div className="mx-auto grid max-w-7xl gap-4 px-5 py-6 text-center sm:grid-cols-3 sm:px-8 sm:py-7"><p className="text-sm text-slate-300">เริ่มทดลองด้วยข้อมูลตัวอย่าง</p><p className="text-sm text-slate-300">ระบบช่วยจัดร่างและแสดงข้อเสนอ</p><p className="text-sm text-slate-300">ผู้ใช้ตรวจทานก่อนนำไปใช้</p></div></div>

      <LandingPricingPreview />

      <section className="mx-auto grid max-w-7xl gap-5 px-5 pb-14 sm:px-8 md:grid-cols-2 lg:pb-16"><article className="rounded-2xl border border-white/10 bg-slate-900/60 p-6 sm:p-8"><p className="text-sm font-medium text-cyan-300">ตรวจทานเป็นขั้นตอน</p><h2 className="mt-3 text-2xl font-semibold text-white">ร่างช่วยจัดข้อมูล<br/>ผู้ใช้เป็นคนยืนยัน</h2><p className="mt-4 leading-relaxed text-slate-300">ตรวจผลกับเวชระเบียนต้นทางและหลักเกณฑ์ของหน่วยงานก่อนนำไปใช้ทุกครั้ง</p><Link href="/learn" className="mt-6 inline-flex text-cyan-200 underline underline-offset-4">อ่านคู่มือการเริ่มต้น →</Link></article><article className="rounded-2xl border border-cyan-200/15 bg-gradient-to-br from-cyan-950/60 to-slate-900/80 p-6 sm:p-8"><p className="text-sm font-medium text-cyan-300">ทดลองก่อนเลือก</p><h2 className="mt-3 text-2xl font-semibold text-white">เริ่มจากข้อมูลตัวอย่าง</h2><p className="mt-4 leading-relaxed text-slate-300">ลองดูขั้นตอนโดยไม่ต้องสมัคร แล้วตรวจสอบรายละเอียดแพ็กเกจได้เมื่อพร้อม</p><Link href={demoHref} className="mt-6 inline-flex rounded-lg border border-cyan-200/30 px-4 py-2.5 text-cyan-100 hover:bg-cyan-100/10">ลองใช้งาน →</Link></article></section>

      <section id="review-note" className="scroll-mt-8 border-t border-white/10 bg-[radial-gradient(ellipse_at_center,_rgba(8,145,178,.14),_transparent_65%)] px-5 py-16 text-center sm:px-8"><p className="text-sm font-medium text-cyan-300">แนวทางใช้งาน</p><h2 className="mx-auto mt-3 max-w-2xl text-3xl font-semibold tracking-tight text-white sm:text-4xl">ผลลัพธ์เป็นร่างสำหรับตรวจทาน</h2><p className="mx-auto mt-4 max-w-3xl leading-relaxed text-slate-300">ข้อเสนอ diagnosis, coding และค่าประมาณ AdjRW ไม่ใช่การวินิจฉัย การรับรอง DRG อย่างเป็นทางการ หรือการรับประกันผลเบิกจ่าย โปรดตรวจสอบความถูกต้องกับเวชระเบียนต้นทางและเกณฑ์ของหน่วยงานก่อนใช้งาน</p><p className="mx-auto mt-3 max-w-3xl text-sm leading-relaxed text-slate-400">ข้อมูลที่ส่งให้ AI อาจมีข้อมูลสุขภาพ โปรดตรวจและลดข้อมูลระบุตัวตนตามแนวทางของหน่วยงานก่อนส่ง ระบบไม่ได้รับรองการลบข้อมูลระบุตัวตนหรือการรับรอง PDPA</p><div className="mt-7 flex flex-wrap justify-center gap-3"><Link href="/signup" className={primaryCta}>สมัครทดลองฟรี</Link><Link href={demoHref} className="inline-flex min-h-12 items-center justify-center rounded-xl border border-white/20 px-6 py-3 font-medium text-slate-100 hover:bg-white/5">ลองข้อมูลตัวอย่าง</Link></div><p className="mt-4 text-sm text-slate-400">ทดลอง 14 วัน · รวม 5 เคส · สูงสุดวันละ 2 เคส</p></section>

    </main>
  );
}
