import type { Metadata } from "next";
import Link from "next/link";
import { GuidePlayer as InteractiveGuidePlayer } from "../components/GuidePlayer";
import { GuideVideo } from "../components/GuideVideo";

function GuidePlayer() {
  return <><GuideVideo /><InteractiveGuidePlayer /></>;
}

export const metadata: Metadata = {
  title: "คู่มือเริ่มใช้ DischargeX",
  description: "ดูวิดีโอและขั้นตอนสรุปชาร์จ พร้อมทดลองใช้ DischargeX ด้วยข้อมูลตัวอย่าง",
  alternates: { canonical: "/learn" },
};

export default function Learn() {
  return (
    <main className="mx-auto max-w-6xl px-6 py-12 text-slate-100">
      <p className="text-sm text-cyan-300">คู่มือเริ่มต้น</p>
      <h1 className="mt-3 text-4xl font-semibold">เริ่มใช้ DischargeX</h1>
      <p className="mb-8 mt-4 max-w-2xl text-lg leading-relaxed text-slate-300">
        ดูวิดีโอหรืออ่านขั้นตอน แล้วลองหน้าสรุปด้วยข้อมูลตัวอย่างก่อนเริ่มใช้งานจริง
      </p>
      <GuidePlayer />
      <div className="my-8 flex flex-wrap gap-3">
        <Link href="/app/guest?tutorial=1" className="rounded bg-cyan-300 px-5 py-3 font-semibold text-slate-950">
          ทดลองใช้ด้วยข้อมูลตัวอย่าง →
        </Link>
        <Link href="/pricing" className="rounded border border-slate-600 px-5 py-3">
          ดูแพ็กเกจและราคา
        </Link>
      </div>
      <section className="mt-12 space-y-4">
        <h2 className="text-2xl font-semibold">ก่อนนำผลไปใช้</h2>
        <details className="rounded border border-slate-700 p-4">
          <summary>ถ้าข้อมูลบางส่วนไม่ครบ</summary>
          <p className="mt-3 leading-relaxed text-slate-300">
            ตรวจข้อความต้นทางและเติมข้อมูลที่ขาดด้วยตนเอง ผลสรุปเป็นเพียงตัวช่วย ต้องตรวจเทียบกับเวชระเบียนก่อนนำไปใช้
          </p>
        </details>
        <details className="rounded border border-slate-700 p-4">
          <summary>เริ่มทดลองใช้งานอย่างไร</summary>
          <p className="mt-3 leading-relaxed text-slate-300">
            ทดลองด้วยข้อมูลตัวอย่างได้โดยไม่สมัคร หากใช้กับข้อมูลจริง ให้เข้าสู่ระบบ ตรวจสิทธิ์คงเหลือ และทบทวนผลทุกครั้ง
          </p>
        </details>
      </section>
    </main>
  );
}
