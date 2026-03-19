"use client";

import Link from "next/link";

export default function GuidelinesPage() {
  return (
    <main className="min-h-screen bg-[#081120] text-slate-100">
      <div className="mx-auto max-w-3xl px-4 py-10">
        <Link
          href="/"
          className="inline-block text-sm text-slate-400 hover:text-white mb-6"
        >
          ← กลับหน้าแรก
        </Link>

        <h1 className="text-2xl font-semibold text-white">
          แนวทางใช้งานและข้อจำกัด DischargeX
        </h1>
        <p className="mt-2 text-sm text-slate-400">
          กรุณาอ่านก่อนใช้งาน เพื่อความปลอดภัยของผู้ป่วยและความถูกต้องของงาน
        </p>

        <div className="mt-10 space-y-10">
          {/* การปกปิดความลับผู้ป่วย */}
          <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
            <h2 className="text-lg font-semibold text-cyan-300">
              การปกปิดความลับผู้ป่วย
            </h2>
            <ul className="mt-4 space-y-3 text-sm leading-6 text-slate-300 list-disc list-inside">
              <li>
                ข้อมูลจากเวชระเบียนและ order sheet ที่คุณวางในระบบเป็น{" "}
                <span className="font-medium text-slate-100">ข้อมูลส่วนบุคคลของผู้ป่วย (Personal Health Information)</span>{" "}
                ผู้ใช้ต้องปฏิบัติตามนโยบายความลับของหน่วยงานและกฎหมายที่เกี่ยวข้อง
              </li>
              <li>
                ใช้ข้อมูลเฉพาะในขอบเขตการทำงานที่ได้รับมอบหมาย และไม่นำไปใช้หรือเปิดเผยในทางที่ผิดวัตถุประสงค์
              </li>
              <li>
                ระบบออกแบบเพื่อช่วยสรุปและจัดโครงสร้างข้อมูลใน session การใช้งานของคุณ
                ทางทีมพัฒนาพยายามออกแบบให้การส่งข้อมูลไปประมวลผลเป็นไปตามวัตถุประสงค์การให้บริการเท่านั้น
              </li>
            </ul>
          </section>

          {/* ข้อจำกัดการใช้งาน */}
          <section className="rounded-2xl border border-amber-900/40 bg-amber-950/20 p-6">
            <h2 className="text-lg font-semibold text-amber-300">
              ข้อจำกัดการใช้งาน
            </h2>
            <ul className="mt-4 space-y-3 text-sm leading-6 text-slate-300 list-disc list-inside">
              <li>
                DischargeX เป็น{" "}
                <span className="font-medium text-amber-200">AI assistant</span>{" "}
                เพื่อช่วยสรุปข้อมูลและจัดกลุ่ม diagnosis เท่านั้น{" "}
                <span className="font-medium text-slate-100">ไม่ใช่เครื่องมือวินิจฉัยหรือตัดสินใจแทนแพทย์</span>
              </li>
              <li>
                ผลลัพธ์ทุกช่อง (รวม Principal, Comorbidity, Complication, ICD-9, Outcome, Follow-up) ต้อง{" "}
                <span className="font-medium text-amber-200">ได้รับการตรวจสอบซ้ำโดยแพทย์หรือ coder</span>{" "}
                ก่อนนำไปใช้งานจริงในเวชระเบียนหรือส่งต่อ
              </li>
              <li>
                โดยเฉพาะ Principal diagnosis และ ICD ต้องอ้างอิงจากเวชระเบียนจริงเสมอ
                AI แนะนำเฉพาะจากข้อความที่คุณวางไว้ อาจไม่ครบหรือไม่ตรงกับ chart
              </li>
              <li>
                การใช้งานถือว่ายอมรับว่า AI เป็นเพียงผู้ช่วย และผู้ใช้เป็นผู้รับผิดชอบต่อความถูกต้องของข้อมูลที่นำไปใช้
              </li>
            </ul>
          </section>

          {/* วิธีใช้เบื้องต้น */}
          <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
            <h2 className="text-lg font-semibold text-emerald-300">
              วิธีใช้เบื้องต้น
            </h2>
            <ol className="mt-4 space-y-4 text-sm leading-6 text-slate-300 list-decimal list-inside">
              <li>
                <span className="font-medium text-slate-100">เข้าสู่ระบบ</span> — ล็อกอินด้วย Google หรืออีเมล/รหัสผ่านจากหน้า Login
              </li>
              <li>
                <span className="font-medium text-slate-100">เข้า Workspace</span> — หลังล็อกอินไปที่เมนู &quot;Workspace&quot; หรือหน้าแอปหลัก
              </li>
              <li>
                <span className="font-medium text-slate-100">วางข้อความ</span> — Copy ข้อความจาก doctor order sheet หรือเวชระเบียนมา Paste ในช่อง &quot;Clinical Input Workspace&quot; (ช่อง Lab / อื่นๆ เป็น optional)
              </li>
              <li>
                <span className="font-medium text-slate-100">กดสร้างสรุป</span> — กดปุ่ม &quot;สร้างสรุป&quot; รอสักครู่ ระบบจะเติมผลลัพธ์ลงในช่องต่างๆ
              </li>
              <li>
                <span className="font-medium text-slate-100">ตรวจและแก้ไข</span> — ตรวจสอบทุกช่อง โดยเฉพาะ diagnosis และ ICD-9 แก้ไขหรือลากจัดกลุ่มใน &quot;Diagnosis Reorder Studio&quot; ตามความเหมาะสม
              </li>
              <li>
                <span className="font-medium text-slate-100">คัดลอกหรือส่งต่อ</span> — เมื่อมั่นใจแล้วใช้ปุ่ม &quot;คัดลอก&quot; แต่ละส่วนหรือ &quot;คัดลอกทั้งหมด&quot; ไปวางในระบบของหน่วยงานหรือส่งต่อตาม workflow
              </li>
            </ol>
            <p className="mt-4 text-xs text-slate-500">
              แพ็กเกจและเครดิต: ดูได้ที่{" "}
              <Link href="/pricing" className="text-cyan-400 hover:underline">แพ็กเกจ</Link>
              {" "}และ{" "}
              <Link href="/app/profile" className="text-cyan-400 hover:underline">ข้อมูลของฉัน</Link>
              {" "}(หลังล็อกอิน)
            </p>
          </section>
        </div>

        <p className="mt-10 text-center text-xs text-slate-500">
          มีคำถามหรือข้อเสนอแนะ? ใช้ช่องแชทใน Workspace หรือติดต่อทีมงานได้ตามช่องทางที่แจ้งไว้
        </p>
      </div>
    </main>
  );
}
