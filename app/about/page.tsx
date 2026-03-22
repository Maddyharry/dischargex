import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "About — DischargeX",
  description: "Discharge summary and coding review decision-support tool.",
};

export default function AboutPage() {
  return (
    <main className="min-h-screen bg-[#081120] text-slate-100">
      <div className="mx-auto max-w-3xl px-4 py-12">
        <Link href="/" className="mb-6 inline-block text-sm text-slate-400 hover:text-white">
          ← กลับหน้าแรก
        </Link>
        <h1 className="text-3xl font-semibold tracking-tight text-white">About DischargeX</h1>
        <div className="mt-8 space-y-6 text-sm leading-7 text-slate-300">
          <p>
            DischargeX คือเครื่องมือช่วยสรุป discharge summary และทบทวนการจัดโครง coding สำหรับงานเวชระเบียนและงานสรุปชาร์จ
          </p>
          <p>
            ระบบช่วยดึงข้อมูลสำคัญจากข้อความในเวชระเบียน, จัดกลุ่มวินิจฉัยตามบทบาท, ค้นหารายการที่อาจตกหล่น
            และช่วยประเมินผลต่อการ coding review และ AdjRW แบบประมาณการ เพื่อให้ผู้ใช้งานทำงานได้เร็วขึ้นและเป็นระบบมากขึ้น
          </p>
          <p>
            DischargeX ถูกออกแบบให้เป็นเครื่องมือช่วยตัดสินใจ ไม่ใช่ผู้แทนแพทย์ ไม่ใช่ผู้แทน coder
            และไม่ใช่ระบบจัดกลุ่มอย่างเป็นทางการ ผู้ใช้งานควรทบทวนผลลัพธ์ร่วมกับข้อมูลในเวชระเบียนทุกครั้งก่อนนำไปใช้งานจริง
          </p>
          <p>
            ระบบพัฒนาตามหลักการจากเอกสารอ้างอิงที่เผยแพร่สาธารณะ เช่น ICD-10, Thai DRG และแนวทาง coding ที่เกี่ยวข้อง
            โดยมีการระบุชุดอ้างอิงและเวอร์ชันที่ใช้งานในระบบ เพื่อให้ตรวจสอบย้อนหลังได้
          </p>
        </div>
        <p className="mt-10 text-sm text-slate-500">
          รายละเอียดทางกฎหมายและการอ้างอิง:{" "}
          <Link href="/legal" className="text-cyan-400 hover:underline">
            Reference &amp; Legal Notice
          </Link>
        </p>
      </div>
    </main>
  );
}
