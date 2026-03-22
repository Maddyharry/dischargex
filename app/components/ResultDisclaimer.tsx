import { REFERENCE_SET_NAME, LAST_REVIEWED_DATE } from "@/lib/reference-info";

export function ResultDisclaimer() {
  return (
    <section
      className="rounded-3xl border border-white/10 bg-slate-950/60 p-5 text-sm leading-relaxed text-slate-300"
      aria-label="ข้อความแจ้งเตือนการใช้ผลลัพธ์"
    >
      <p className="font-medium text-slate-200">ข้อความสำคัญเกี่ยวกับผลลัพธ์</p>
      <p className="mt-3">
        ผลลัพธ์นี้เป็นเครื่องมือช่วยสรุปและทบทวน coding โดยอ้างอิงหลักการจากเอกสารมาตรฐานที่เกี่ยวข้อง
        แต่ไม่ใช่ผลการจัดกลุ่มหรือการรับรองการเบิกจ่ายอย่างเป็นทางการ
      </p>
      <p className="mt-3 text-slate-400">
        ผลลัพธ์นี้เป็นการช่วยประเมินเชิงสนับสนุน ไม่ใช่ผลจากระบบจัดกลุ่มอย่างเป็นทางการ และไม่รับประกันผลการเบิกจ่าย
        ควรมีแพทย์หรือผู้ตรวจรหัสทบทวนก่อนใช้งานจริง
      </p>
      <p className="mt-4 border-t border-white/10 pt-4 text-xs text-slate-500">
        Reference set used: {REFERENCE_SET_NAME}
        <br />
        Last reviewed: {LAST_REVIEWED_DATE}
      </p>
    </section>
  );
}
