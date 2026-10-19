import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "ดาวน์โหลด DischargeX Portable",
  description: "ดาวน์โหลด DischargeX Portable สำหรับ Windows พร้อมวิธีเริ่มใช้งานแบบย่อ",
  alternates: { canonical: "/downloads" },
};

const portableDownload = "https://github.com/Maddyharry/dischargex/releases/download/v0.12.9/DischargeX_Windows_v0.12.9.zip";

export default function Downloads() {
  return (
    <main className="mx-auto max-w-4xl px-6 py-14 text-slate-100">
      <p className="text-sm text-cyan-300">DischargeX Portable · Windows 64-bit</p>
      <h1 className="mt-3 text-4xl font-semibold">ดาวน์โหลด DischargeX Portable</h1>
      <p className="mt-5 max-w-2xl text-lg leading-relaxed text-slate-300">
        ใช้บัญชี DischargeX เดียวกับบนเว็บ โปรแกรมต้องเชื่อมต่ออินเทอร์เน็ตเพื่อเข้าสู่ระบบและสร้างสรุป
      </p>
      <section className="my-8 rounded-xl border border-cyan-300/25 bg-slate-900 p-6">
        <h2 className="text-2xl font-semibold">เวอร์ชัน 0.12.9</h2>
        <a href={portableDownload} className="mt-5 inline-block rounded-lg bg-cyan-300 px-6 py-3 font-semibold text-slate-950">
          ดาวน์โหลดสำหรับ Windows (.zip)
        </a>
        <p className="mt-3 text-sm text-slate-400">ดาวน์โหลด ZIP แล้วแตกไฟล์ทั้งโฟลเดอร์ จากนั้นเปิด DischargeXPortable.exe และเข้าสู่ระบบ</p>
        <p className="mt-2 text-sm text-slate-400">อัปเดตโปรแกรม: ปิดโปรแกรม สำรองโฟลเดอร์เดิม แล้วคัดลอกโฟลเดอร์ profiles ไปยังรุ่นใหม่บนเครื่องเดิม</p>
      </section>
      <p className="text-sm leading-relaxed text-slate-400">
        ก่อนใช้ข้อมูลจริง โปรดปกปิดข้อมูลที่ระบุตัวผู้ป่วยได้ และตรวจทานผลกับเวชระเบียนก่อนนำไปใช้ทุกครั้ง
      </p>
      <div className="mt-8 flex flex-wrap gap-6">
        <Link className="text-cyan-300 underline" href="/learn">ดูคู่มือเริ่มต้น</Link>
        <Link className="text-cyan-300 underline" href="/pricing">ดูแพ็กเกจและราคา</Link>
        <a className="text-cyan-300 underline" href="https://github.com/Maddyharry/dischargex/releases/tag/v0.12.9">รายละเอียดเวอร์ชัน</a>
      </div>
    </main>
  );
}
