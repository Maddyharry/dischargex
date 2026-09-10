import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "ดาวน์โหลด DischargeX Auto สำหรับ HOSxP",
  description: "ดาวน์โหลด DischargeX Desktop สำหรับ Windows พร้อมคู่มือเริ่มต้นและตั้งค่าเครื่อง",
  alternates: { canonical: "/downloads" },
};
const download = "https://github.com/Maddyharry/dischargex/releases/download/v0.12.9/DischargeX_Windows_v0.12.9.zip";
export default function Downloads() {
  return <main className="mx-auto max-w-4xl px-6 py-14 text-slate-100">
    <p className="text-sm text-cyan-300">DischargeX Desktop · Windows 64-bit</p>
    <h1 className="mt-3 text-4xl font-semibold">ดาวน์โหลด แล้วเริ่มจากการตั้งค่าเครื่อง</h1>
    <p className="mt-5 text-lg leading-relaxed text-slate-300">ใช้บัญชีเดียวกับ dischargex.net เพื่อสร้างร่างสรุปและช่วยกรอกข้อมูลใน HOSxP</p>
    <section className="my-8 rounded-xl border border-cyan-300/25 bg-slate-900 p-6">
      <h2 className="text-2xl font-semibold">รุ่น 0.12.9</h2>
      <p className="mt-3 text-slate-300">ปรับหน้าล็อกอิน แก้ปัญหาเปิดโปรแกรม และเพิ่มการตรวจรุ่นใหม่</p>
      <a href={download} className="mt-6 inline-block rounded-lg bg-cyan-300 px-6 py-3 font-semibold text-slate-950">ดาวน์โหลดสำหรับ Windows (.zip)</a>
      <p className="mt-3 text-sm text-slate-400">ต้องใช้อินเทอร์เน็ตสำหรับสร้างสรุปและเข้าสู่ระบบ</p>
      <a className="mt-4 inline-block text-cyan-300 underline" href="https://github.com/Maddyharry/dischargex/releases/tag/v0.12.9">ดูรายละเอียดรุ่นและไฟล์ทางการ</a>
    </section>
    <h2 className="text-2xl font-semibold">เริ่มใช้งาน 4 ขั้นตอน</h2>
    <ol className="mt-6 list-decimal space-y-4 pl-6 leading-relaxed text-slate-300">
      <li>แตก ZIP ทั้งโฟลเดอร์ แล้วเปิด DischargeXPortable.exe</li>
      <li>เข้าสู่ระบบด้วยบัญชี DischargeX แล้วตั้งค่าหน้าจอและลำดับการกดให้ตรงกับเครื่อง</li>
      <li>ทดสอบทีละช่วงและทีละเคส ตรวจร่างสรุปและตำแหน่งกรอกข้อมูลก่อนบันทึก</li>
      <li>พักหรือทำต่อด้วย F9 หยุดด้วย F10 เมื่อต้องตรวจหน้าจอ</li>
    </ol>
    <p className="mt-7 rounded-lg bg-slate-900 p-5 leading-relaxed text-slate-300">เปลี่ยนจากรุ่นเดิม: ปิดโปรแกรมและสำรองโฟลเดอร์เดิมก่อน คัดลอกโฟลเดอร์ profiles มาไว้ในรุ่นใหม่บนเครื่องเดิม เพื่อเก็บการตั้งค่าเครื่องและบัญชีของคุณ</p>
    <p className="mt-6 text-sm text-slate-400">ระบบตรวจรุ่นใหม่แจ้งเมื่อมีไฟล์เผยแพร่ ผู้ใช้เป็นผู้ดาวน์โหลดและเปลี่ยนรุ่น โปรแกรมยังไม่ติดตั้งอัปเดตให้เอง</p>
    <div className="mt-8 flex flex-wrap gap-6"><Link className="text-cyan-300 underline" href="/learn">ดูคู่มือภาพทีละขั้น</Link><Link className="text-cyan-300 underline" href="/app/guest?tutorial=1">ลองตัวอย่างบนเว็บ</Link></div>
  </main>;
}
