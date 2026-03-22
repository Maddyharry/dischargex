import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Reference & Legal Notice — DischargeX",
  description: "Reference materials and legal notice for DischargeX.",
};

export default function LegalPage() {
  return (
    <main className="min-h-screen bg-[#081120] text-slate-100">
      <div className="mx-auto max-w-3xl px-4 py-12">
        <Link href="/" className="mb-6 inline-block text-sm text-slate-400 hover:text-white">
          ← กลับหน้าแรก
        </Link>
        <h1 className="text-3xl font-semibold tracking-tight text-white">Reference &amp; Legal Notice</h1>
        <div className="mt-8 space-y-6 text-sm leading-7 text-slate-300">
          <p>
            DischargeX อ้างอิงหลักการจากเอกสารและมาตรฐานที่เผยแพร่สาธารณะ เช่น ICD-10, Thai DRG
            และแนวทาง coding/audit ที่เกี่ยวข้อง เพื่อใช้เป็นฐานในการพัฒนา logic สำหรับช่วยสรุปและทบทวน coding
          </p>
          <p>
            DischargeX ไม่ได้เป็นระบบทางการของหน่วยงานรัฐ ไม่ได้เป็นผลิตภัณฑ์ที่ได้รับการรับรองหรือรับรองร่วมโดย WHO, สปสช.,
            TCMC หรือหน่วยงานเจ้าของเอกสารอ้างอิงอื่นใด เว้นแต่จะมีการระบุไว้เป็นลายลักษณ์อักษรอย่างชัดเจน
          </p>
          <p>
            ชื่อเอกสาร ชื่อหน่วยงาน และหมายเลขเวอร์ชันที่ปรากฏในระบบ ใช้เพื่อการอ้างอิงแหล่งที่มาของหลักการเท่านั้น
            ไม่ได้สื่อถึงความเป็นหุ้นส่วน การรับรอง หรือการรับประกันผลการใช้งาน
          </p>
          <p>
            ผลลัพธ์จากระบบเป็นเพียงการประเมินเชิงสนับสนุน ผู้ใช้งานต้องพิจารณาความเหมาะสมของผลลัพธ์ร่วมกับข้อมูลในเวชระเบียน
            เอกสารต้นฉบับ และกฎเกณฑ์ที่มีผลใช้บังคับในช่วงเวลานั้น
          </p>
          <p>
            เนื้อหา ภาพ ตาราง หรือเอกสารอ้างอิงจากบุคคลภายนอกยังคงเป็นลิขสิทธิ์ของเจ้าของผลงานเดิมตามเงื่อนไขของแต่ละแหล่งที่มา
            ผู้ใช้งานควรตรวจสอบสิทธิการนำไปใช้ซ้ำจากเจ้าของลิขสิทธิ์โดยตรงเมื่อจำเป็น
          </p>
        </div>
        <p className="mt-10 text-sm text-slate-500">
          <Link href="/about" className="text-cyan-400 hover:underline">
            About DischargeX
          </Link>
        </p>
      </div>
    </main>
  );
}
