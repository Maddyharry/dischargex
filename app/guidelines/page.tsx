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

        <div className="mt-6 rounded-2xl border border-cyan-500/25 bg-cyan-950/20 p-4 text-sm leading-relaxed text-cyan-50/95">
          <p className="font-medium text-cyan-100">คู่มือ SEO (อ่านเพิ่มได้)</p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-cyan-50/90">
            <li>
              <Link href="/summary-charge" className="text-cyan-200 underline underline-offset-2 hover:text-white">
                สรุปชาร์จคืออะไร — checklist และวิธีทำให้ครบ
              </Link>
            </li>
            <li>
              <Link href="/icd10-review" className="text-cyan-200 underline underline-offset-2 hover:text-white">
                ทบทวน ICD-10 ก่อนลงสรุปชาร์จ
              </Link>
            </li>
          </ul>
        </div>

        <section className="mt-8 rounded-2xl border border-white/10 bg-white/[0.03] p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-white">วิดีโอสอนใช้งานเบื้องต้น</h2>
            <a
              href="https://www.youtube.com/watch?v=_mIpiKuYrV4"
              target="_blank"
              rel="noreferrer"
              className="text-sm text-cyan-300 hover:text-cyan-200 hover:underline"
            >
              เปิดใน YouTube
            </a>
          </div>
          <p className="mt-2 text-sm text-slate-400">
            แนะนำให้ดูวิดีโอก่อนเริ่มใช้งานจริง เพื่อเข้าใจขั้นตอนการวางข้อมูลและตรวจทานผลลัพธ์
          </p>
          <div className="mt-3 overflow-hidden rounded-xl border border-slate-700/70 bg-slate-950/70">
            <iframe
              className="aspect-video w-full"
              src="https://www.youtube.com/embed/_mIpiKuYrV4"
              title="DischargeX basic usage tutorial"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              referrerPolicy="strict-origin-when-cross-origin"
              allowFullScreen
            />
          </div>
        </section>

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
                DischargeX เป็นเครื่องมือ<span className="font-medium text-amber-200">ช่วยสรุปและทบทวน coding</span>{" "}
                ไม่ใช่เครื่องมือวินิจฉัยหรือตัดสินใจแทนแพทย์ และไม่ใช่ระบบจัดกลุ่มอย่างเป็นทางการ
              </li>
              <li>
                ผลลัพธ์ทุกช่อง (รวม Principal, Comorbidity, Complication, ICD-9, Outcome, Follow-up) ควร{" "}
                <span className="font-medium text-amber-200">ทบทวนร่วมกับเวชระเบียนโดยแพทย์หรือผู้ตรวจรหัส</span>{" "}
                ก่อนนำไปใช้งานจริง
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
                <span className="font-medium text-slate-100">เข้าหน้าสรุปชาร์จ</span> — ไปที่{" "}
                <Link href="/app" className="text-cyan-300 underline hover:text-cyan-200">/app</Link>{" "}
                เพื่อสร้างสรุปชาร์จ
              </li>
              <li>
                <span className="font-medium text-slate-100">วางข้อความ</span> — Copy ข้อความจาก doctor order sheet หรือเวชระเบียนมา Paste ในช่องกรอกเคส (Clinical input) (ช่อง Lab / อื่นๆ เป็น optional)
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
              แพ็กเกจและโควตา: ดูได้ที่{" "}
              <Link href="/pricing" className="text-cyan-400 hover:underline">แพ็กเกจ</Link>
              {" "}และ{" "}
              <Link href="/app/profile" className="text-cyan-400 hover:underline">ข้อมูลของฉัน</Link>
              {" "}(หลังล็อกอิน)
            </p>
          </section>

          <section className="rounded-2xl border border-cyan-500/20 bg-cyan-950/10 p-6">
            <h2 className="text-lg font-semibold text-cyan-200">
              คำถามที่พบบ่อย (FAQ)
            </h2>
            <p className="mt-2 text-sm text-slate-400">
              รวมคำถามที่ผู้ใช้มักค้นหาเกี่ยวกับ AI สรุปชาร์จและการทบทวน ICD-10
            </p>
            <div className="mt-5 space-y-4">
              <details className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
                <summary className="cursor-pointer text-sm font-medium text-slate-100">
                  DischargeX ใช้แทนแพทย์หรือ coder ได้ไหม?
                </summary>
                <p className="mt-2 text-sm leading-6 text-slate-300">
                  ไม่ได้ DischargeX เป็นเครื่องมือช่วยทบทวนเท่านั้น ไม่ใช่ผู้ตัดสินใจแทนแพทย์หรือผู้ตรวจรหัส
                  ผลลัพธ์ทุกครั้งต้องทบทวนกับเวชระเบียนจริงก่อนใช้งานจริง
                </p>
              </details>
              <details className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
                <summary className="cursor-pointer text-sm font-medium text-slate-100">
                  ใช้กับงานสรุปชาร์จภาษาไทยได้ไหม?
                </summary>
                <p className="mt-2 text-sm leading-6 text-slate-300">
                  ได้ ระบบออกแบบมาสำหรับ workflow โรงพยาบาลไทย โดยเน้นข้อความจากเวชระเบียน IPD
                  และช่วยจัดโครง diagnosis/coding ให้ทบทวนได้ง่ายขึ้น
                </p>
              </details>
              <details className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
                <summary className="cursor-pointer text-sm font-medium text-slate-100">
                  ทำไมผลลัพธ์ ICD-10 หรือ diagnosis บางเคสยังต้องแก้เอง?
                </summary>
                <p className="mt-2 text-sm leading-6 text-slate-300">
                  AI ประเมินจากข้อความที่ผู้ใช้วางเข้ามาเท่านั้น หากข้อมูลไม่ครบหรือถ้อยคำใน chart ไม่ชัด
                  ระบบอาจเสนอ diagnosis ที่ต้องปรับเพิ่มโดยผู้ใช้งาน
                </p>
              </details>
              <details className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
                <summary className="cursor-pointer text-sm font-medium text-slate-100">
                  เริ่มต้นใช้งานต้องดูหน้าไหนก่อน?
                </summary>
                <p className="mt-2 text-sm leading-6 text-slate-300">
                  แนะนำเริ่มจาก{" "}
                  <Link href="/" className="text-cyan-300 underline hover:text-cyan-200">
                    หน้าแรก DischargeX
                  </Link>{" "}
                  เพื่อดูภาพรวม และดู{" "}
                  <Link href="/pricing" className="text-cyan-300 underline hover:text-cyan-200">
                    ราคาและแพ็กเกจ DischargeX
                  </Link>{" "}
                  เพื่อเลือกแผนที่เหมาะกับปริมาณงาน
                </p>
              </details>
            </div>
          </section>

          <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
            <h2 className="text-lg font-semibold text-cyan-200">
              หน้าไหนใช้ทำอะไร (สรุปเร็ว)
            </h2>
            <ul className="mt-4 space-y-3 text-sm leading-6 text-slate-300 list-disc list-inside">
              <li><span className="font-medium text-slate-100">หน้าแรก</span> (<Link href="/" className="text-cyan-300 underline hover:text-cyan-200">/</Link>) — ดูภาพรวมว่าระบบมีอะไรและเริ่มจากจุดไหน</li>
              <li><span className="font-medium text-slate-100">สรุปชาร์จ</span> (<Link href="/app" className="text-cyan-300 underline hover:text-cyan-200">/app</Link>) — วางข้อความจาก chart เพื่อสร้างสรุปและทบทวน coding</li>
              <li>
                <span className="font-medium text-slate-100">คู่มือสรุปชาร์จ (SEO)</span> (
                <Link href="/summary-charge" className="text-cyan-300 underline hover:text-cyan-200">/summary-charge</Link>
                ) — นิยาม สรุปชาร์จ checklist และลิงก์ไปหน้าใช้งานจริง
              </li>
              <li>
                <span className="font-medium text-slate-100">ทบทวน ICD-10 (SEO)</span> (
                <Link href="/icd10-review" className="text-cyan-300 underline hover:text-cyan-200">/icd10-review</Link>
                ) — checklist ทบทวนรหัสก่อนลงสรุปชาร์จ
              </li>
              <li><span className="font-medium text-slate-100">แพ็กเกจ/ราคา</span> (<Link href="/pricing" className="text-cyan-300 underline hover:text-cyan-200">/pricing</Link>) — ดูราคาอัปเดตล่าสุดและช่องทางชำระเงิน</li>
              <li><span className="font-medium text-slate-100">โปรไฟล์และแจ้งเตือน</span> (<Link href="/app/profile" className="text-cyan-300 underline hover:text-cyan-200">/app/profile</Link>) — ตรวจสถานะบัญชี แพ็กเกจ และการแจ้งเตือนจากทีม</li>
            </ul>
          </section>
        </div>

        <p className="mt-10 text-center text-xs text-slate-500">
          มีคำถามหรือข้อเสนอแนะ? ใช้ช่องแชทในหน้าสรุปชาร์จ หรือติดต่อทีมงานได้ตามช่องทางที่แจ้งไว้
        </p>
      </div>
    </main>
  );
}
