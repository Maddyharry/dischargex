import type { Metadata } from "next";
import Link from "next/link";
import { ImpactStats } from "./components/ImpactStats";
import { ValueCalculator } from "./components/ValueCalculator";

export const metadata: Metadata = {
  title: { absolute: "DischargeX — สรุปชาร์จ เริ่มลองได้ทันที" },
  description: "จัดข้อมูลจาก Order Sheet เป็นร่างสรุปที่อ่านและตรวจทานง่าย ลองขั้นตอนด้วยข้อมูลตัวอย่างได้ทันที",
  alternates: { canonical: "/" },
  openGraph: {
    title: "DischargeX — สรุปชาร์จ เริ่มลองได้ทันที",
    description: "ดูภาพรวม ลอง flow ด้วยข้อมูลตัวอย่าง แล้วเลือกแพ็กเกจให้เหมาะกับงานของคุณ",
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

      <section className="relative isolate border-b border-white/10 bg-[radial-gradient(ellipse_at_80%_0%,_rgba(8,145,178,.3),_transparent_45%),linear-gradient(145deg,#0b1b2c_0%,#07111f_58%,#0b2130_100%)]">
        <div aria-hidden="true" className="pointer-events-none absolute -right-28 top-24 h-80 w-80 rounded-full bg-cyan-400/10 blur-3xl" />
        <div className="relative mx-auto grid max-w-7xl items-center gap-12 px-5 py-14 sm:px-8 sm:py-20 lg:grid-cols-[.9fr_1.1fr] lg:gap-16 lg:py-24">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full border border-cyan-200/20 bg-cyan-100/5 px-3 py-1.5 text-sm text-cyan-100">
              <span aria-hidden="true" className="h-2 w-2 rounded-full bg-cyan-300" /> ผู้ช่วยจัดร่างสรุปชาร์จบนเว็บ
            </p>
            <h1 className="mt-6 max-w-2xl text-4xl font-semibold leading-[1.13] tracking-tight sm:text-5xl lg:text-6xl">
              จาก Order Sheet<br />สู่ร่างสรุปที่ <span className="bg-gradient-to-r from-cyan-200 to-teal-200 bg-clip-text text-transparent">ตรวจทานง่าย</span>
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-slate-300">
              ดูขั้นตอนจริงผ่านวิดีโอ แล้วลอง flow ด้วยข้อมูลตัวอย่างได้เลย ก่อนตัดสินใจสมัครหรือเลือกแพ็กเกจ
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link href={demoHref} className={primary}>ลองตัวอย่างทันที ไม่ต้องสมัคร <span aria-hidden="true" className="ml-2">→</span></Link>
              <Link href="/pricing" className="inline-flex items-center justify-center rounded-xl border border-white/20 bg-white/[.04] px-6 py-3.5 font-medium text-slate-100 transition hover:border-cyan-200/50 hover:bg-white/[.08] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-cyan-300">ดูแพ็กเกจและราคา</Link>
            </div>
            <p className="mt-4 text-sm text-slate-400">ใช้ข้อมูลตัวอย่างในโหมดทดลอง · ผลลัพธ์เป็นร่างสำหรับตรวจทาน</p>
            <div className="mt-9 flex flex-wrap gap-x-6 gap-y-2 text-sm text-slate-300">
              <span className="inline-flex items-center gap-2"><span aria-hidden="true" className="text-cyan-300">✓</span> เริ่มดูได้โดยไม่สมัคร</span>
              <span className="inline-flex items-center gap-2"><span aria-hidden="true" className="text-cyan-300">✓</span> เห็นขั้นตอนก่อนเลือกแพ็กเกจ</span>
            </div>
          </div>

          <div className="relative mx-auto w-full max-w-3xl">
            <div className="absolute -inset-3 rounded-[1.7rem] bg-gradient-to-br from-cyan-400/20 via-blue-500/10 to-teal-300/10 blur-xl" aria-hidden="true" />
            <div className="relative overflow-hidden rounded-2xl border border-white/15 bg-slate-950 shadow-2xl shadow-black/50">
              <div className="flex items-center justify-between gap-3 border-b border-white/10 bg-slate-900/90 px-4 py-3 sm:px-5">
                <div><p className="text-sm font-semibold text-white">ดูตัวอย่างการใช้งาน</p><p className="mt-0.5 text-xs text-slate-400">วิดีโอแนะนำ · ไม่มีเสียง</p></div>
                <span className="rounded-full border border-emerald-300/20 bg-emerald-300/10 px-2.5 py-1 text-xs text-emerald-200">เริ่มง่าย</span>
              </div>
              <video controls playsInline preload="metadata" muted className="aspect-video w-full bg-black object-contain" aria-label="วิดีโอแนะนำวิธีเริ่มใช้ DischargeX ไม่มีเสียง">
                <source src="/media/getting-started.mp4" type="video/mp4" />
                เบราว์เซอร์นี้ไม่รองรับวิดีโอ สามารถ <a href="/media/getting-started.mp4" className="underline">เปิดไฟล์วิดีโอ</a> ได้
              </video>
              <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-5">
                <p className="text-xs text-slate-400">ดูภาพรวมก่อน แล้วลองทำตามด้วยข้อมูลตัวอย่าง</p>
                <Link href={demoHref} className="text-sm font-medium text-cyan-200 underline decoration-cyan-300/40 underline-offset-4 hover:text-white">ไปหน้าทดลอง →</Link>
              </div>
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
