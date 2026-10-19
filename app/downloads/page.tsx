import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "เริ่มใช้ DischargeX บนเว็บ",
  description: "ทดลองสรุปชาร์จด้วยข้อมูลตัวอย่าง หรือเลือกแพ็กเกจเพื่อเริ่มใช้งาน DischargeX",
  alternates: { canonical: "/downloads" },
};

export default function Downloads() {
  return (
    <main className="mx-auto max-w-4xl px-6 py-14 text-slate-100">
      <p className="text-sm text-cyan-300">DischargeX · ใช้งานผ่านเว็บ</p>
      <h1 className="mt-3 text-4xl font-semibold">เริ่มใช้งานได้เลย ไม่ต้องดาวน์โหลดโปรแกรม</h1>
      <p className="mt-5 max-w-2xl text-lg leading-relaxed text-slate-300">
        ทดลองหน้าสรุปด้วยข้อมูลตัวอย่างก่อน หรือสมัครเพื่อใช้กับงานของคุณและตรวจสอบแพ็กเกจได้ในบัญชี
      </p>
      <section className="my-8 rounded-xl border border-cyan-300/25 bg-slate-900 p-6">
        <h2 className="text-2xl font-semibold">เริ่มจากสิ่งที่สะดวก</h2>
        <div className="mt-5 flex flex-wrap gap-3">
          <Link href="/app/guest?tutorial=1" className="rounded-lg bg-cyan-300 px-6 py-3 font-semibold text-slate-950">
            ทดลองด้วยข้อมูลตัวอย่าง
          </Link>
          <Link href="/pricing" className="rounded-lg border border-slate-600 px-6 py-3 font-semibold text-slate-100">
            ดูแพ็กเกจและราคา
          </Link>
        </div>
      </section>
      <p className="text-sm leading-relaxed text-slate-400">
        ก่อนใช้กับข้อมูลจริง โปรดปกปิดข้อมูลที่ระบุตัวผู้ป่วยได้ และตรวจทานผลกับเวชระเบียนทุกครั้ง
      </p>
      <div className="mt-8 flex flex-wrap gap-6">
        <Link className="text-cyan-300 underline" href="/learn">ดูคู่มือเริ่มต้น</Link>
        <Link className="text-cyan-300 underline" href="/signup">สมัครใช้งาน</Link>
      </div>
    </main>
  );
}
