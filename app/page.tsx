import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen bg-[#081120] text-slate-100">
      <section className="relative overflow-hidden border-b border-white/5 bg-gradient-to-b from-slate-900/50 via-[#0a1628] to-transparent">
        <div className="pointer-events-none absolute -top-20 right-0 h-72 w-72 rounded-full bg-cyan-500/10 blur-3xl" />
        <div className="pointer-events-none absolute bottom-0 left-0 h-64 w-64 rounded-full bg-emerald-500/10 blur-3xl" />
        <div className="mx-auto max-w-6xl px-4 py-14 md:py-24">
          <div className="mx-auto max-w-4xl text-center">
            <p className="inline-flex rounded-full border border-cyan-500/30 bg-cyan-500/10 px-3 py-1 text-xs font-medium text-cyan-200">
              AI-assisted discharge workflow
            </p>
            <h1 className="mt-4 text-4xl font-bold tracking-tight text-white md:text-6xl">
              Discharge<span className="text-cyan-400">X</span>
            </h1>
            <h2 className="mx-auto mt-5 max-w-4xl text-3xl font-semibold tracking-tight text-white md:text-5xl md:leading-tight">
              ลดเวลาในการสรุปชาร์จ
              <span className="hidden md:inline"> </span>
              <br className="hidden md:block" />
              พร้อมช่วยให้ข้อมูลสำคัญครบถ้วนยิ่งขึ้น
            </h2>
            <p className="mx-auto mt-5 max-w-3xl text-sm leading-7 text-slate-300 md:text-base">
              ระบบช่วยจัดเรียงและสรุปข้อมูลผู้ป่วยอย่างเป็นระบบ ลดความเสี่ยงจากการพิมพ์ตกหล่น
              ช่วยค้นหา ICD-10 ที่เหมาะสม และสนับสนุนการสรุปชาร์จได้ภายในเวลาไม่ถึง 1 นาทีต่อเคส
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <Link
                href="/signup"
                className="rounded-2xl bg-cyan-500 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-cyan-900/30 hover:bg-cyan-600"
              >
                ทดลองใช้ฟรี
              </Link>
              <Link
                href="/guidelines"
                className="rounded-2xl border border-slate-600 bg-slate-800/80 px-6 py-3 text-sm font-medium text-slate-200 hover:bg-slate-700"
              >
                ดูวิธีใช้งาน
              </Link>
            </div>
            <div className="mt-4">
              <Link href="/pricing" className="text-sm text-cyan-300 hover:text-cyan-200 hover:underline">
                ดูแพ็กเกจและราคา
              </Link>
            </div>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-2 text-xs">
              <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-slate-200">
                เฉลี่ย &lt; 1 นาทีต่อเคส
              </span>
              <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-slate-200">
                ทดลองใช้ฟรี 10 เครดิต / 7 วัน
              </span>
              <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-slate-200">
                เหมาะสำหรับแพทย์และทีม coder
              </span>
              <span className="rounded-full border border-cyan-500/30 bg-cyan-500/10 px-3 py-1 text-cyan-200">
                เหมาะสำหรับหน่วยงานที่ใช้ระบบ IPD paperless
              </span>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-10">
        <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5 md:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold text-white">วิดีโอสอนใช้งานเบื้องต้น</h2>
              <p className="mt-1 text-sm text-slate-400">
                ชมภาพรวมการใช้งานจริงก่อนเริ่มทดลอง เพื่อเห็น flow การทำงานตั้งแต่ต้นจนจบ
              </p>
            </div>
            <a
              href="https://youtu.be/MQeL2-lcriA"
              target="_blank"
              rel="noreferrer"
              className="text-sm text-cyan-300 hover:text-cyan-200 hover:underline"
            >
              เปิดใน YouTube
            </a>
          </div>
          <div className="mt-4 overflow-hidden rounded-2xl border border-slate-700/70 bg-slate-950/70">
            <iframe
              className="aspect-video w-full"
              src="https://www.youtube.com/embed/MQeL2-lcriA"
              title="DischargeX basic usage tutorial"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              referrerPolicy="strict-origin-when-cross-origin"
              allowFullScreen
            />
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-14">
        <h2 className="text-2xl font-semibold text-white">การทำงาน 3 ขั้นตอน</h2>
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
            <p className="text-xs font-medium text-cyan-300">STEP 1</p>
            <h3 className="mt-2 text-base font-semibold text-white">วางข้อมูลผู้ป่วย</h3>
            <p className="mt-2 text-sm leading-6 text-slate-300">
              นำข้อมูลจากเวชระเบียนหรือบันทึกการรักษาเข้าสู่ระบบในช่องที่กำหนด
            </p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
            <p className="text-xs font-medium text-cyan-300">STEP 2</p>
            <h3 className="mt-2 text-base font-semibold text-white">ระบบช่วยสรุปและจัดโครงสร้างข้อมูล</h3>
            <p className="mt-2 text-sm leading-6 text-slate-300">
              จัดเรียงข้อมูลสำคัญ พร้อมข้อเสนอแนะ ICD-10 เพื่อช่วยในการทบทวน
            </p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
            <p className="text-xs font-medium text-cyan-300">STEP 3</p>
            <h3 className="mt-2 text-base font-semibold text-white">คัดลอกผลลัพธ์ไปใช้งานต่อ</h3>
            <p className="mt-2 text-sm leading-6 text-slate-300">
              ตรวจสอบความถูกต้องโดยแพทย์/ผู้รับผิดชอบ ก่อนนำไปใช้ในกระบวนการจริง
            </p>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-14">
        <h2 className="text-2xl font-semibold text-white">คุณค่าหลักของระบบ</h2>
        <div className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <article className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
            <h3 className="text-base font-semibold text-white">ลดเวลาในการสรุปชาร์จ</h3>
            <p className="mt-2 text-sm text-slate-300">ช่วยลดภาระงานเอกสาร และเพิ่มความคล่องตัวในการทำงานรายวัน</p>
          </article>
          <article className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
            <h3 className="text-base font-semibold text-white">ลดความเสี่ยงข้อมูลตกหล่น</h3>
            <p className="mt-2 text-sm text-slate-300">ช่วยจัดลำดับหัวข้อสำคัญให้ครบถ้วนและสม่ำเสมอมากขึ้น</p>
          </article>
          <article className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
            <h3 className="text-base font-semibold text-white">ช่วยค้นหา ICD-10 ที่เหมาะสม</h3>
            <p className="mt-2 text-sm text-slate-300">สนับสนุนการพิจารณารหัสวินิจฉัยจากข้อมูลที่ป้อนเข้าสู่ระบบ</p>
          </article>
          <article className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
            <h3 className="text-base font-semibold text-white">ใช้งานได้จริงในงานประจำ</h3>
            <p className="mt-2 text-sm text-slate-300">ออกแบบเพื่อบริบทงานทางการแพทย์ที่ต้องการทั้งความเร็วและความชัดเจน</p>
          </article>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-14">
        <h2 className="text-2xl font-semibold text-white">ตัวอย่าง Input → Output</h2>
        <p className="mt-2 max-w-3xl text-sm text-slate-400">
          แสดงแนวทางการแปลงข้อมูลที่กระจัดกระจาย ให้เป็นสรุปที่อ่านง่ายและนำไปใช้งานต่อได้สะดวกขึ้น
        </p>
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl border border-slate-700 bg-slate-900/70 p-5">
            <p className="text-xs font-medium text-slate-400">Input (ตัวอย่าง)</p>
            <p className="mt-2 text-sm leading-7 text-slate-300">
              ผู้ป่วยชายอายุ 72 ปี มาด้วยไข้ ไอมีเสมหะ และเหนื่อย 2 วันก่อนมาโรงพยาบาล
              <br />
              โรคประจำตัว: เบาหวานชนิดที่ 2 และความดันโลหิตสูง
              <br />
              แรกรับ: BT 38.2 C, PR 108/min, RR 26/min, SpO2 90% (room air)
              <br />
              ตรวจร่างกายพบ coarse crepitation ที่ปอดขวาส่วนล่าง
              <br />
              ผลตรวจ CXR: right lower lung infiltration, CBC: WBC 14,900 (Neutrophil 84%)
              <br />
              ได้รับการรักษาด้วย IV ceftriaxone, oxygen cannula และ nebulization อาการดีขึ้นตามลำดับ
            </p>
          </div>
          <div className="rounded-2xl border border-cyan-500/20 bg-cyan-950/20 p-5">
            <p className="text-xs font-medium text-cyan-300">Output (ตัวอย่าง)</p>
            <p className="mt-2 text-sm leading-7 text-slate-200">
              Principal diagnosis: Pneumonia
              <br />
              Comorbidities: Type 2 diabetes mellitus, Hypertension
              <br />
              Complication: Acute respiratory failure (resolved)
              <br />
              Procedures/Investigation: CXR, CBC, Blood culture
              <br />
              Treatment: IV ceftriaxone, oxygen therapy, nebulization
              <br />
              Outcome: Improved, stable vital signs before discharge
              <br />
              Home medication: Oral antibiotics 5 days, bronchodilator PRN
              <br />
              Follow-up: OPD 7 days, return earlier if dyspnea worsens
              <br />
              Suggested ICD-10: J18.9, E11.9, I10
            </p>
          </div>
        </div>
      </section>

      <section className="border-t border-white/5">
        <div className="mx-auto max-w-6xl px-4 py-14">
          <div className="rounded-3xl border border-cyan-500/20 bg-cyan-950/20 p-6 md:p-8">
            <h2 className="text-2xl font-semibold text-white">เริ่มใช้งานได้ทันที พร้อมทดลองใช้ฟรี</h2>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-300 md:text-base">
              ทดลองใช้ฟรี 10 เครดิต ภายใน 7 วัน เพื่อประเมินความเหมาะสมกับการใช้งานในหน่วยงาน
              หลังจากนั้นสามารถเลือกแพ็กเกจตามปริมาณงานได้ทันที
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                href="/signup"
                className="rounded-2xl bg-cyan-500 px-6 py-3 text-sm font-semibold text-white hover:bg-cyan-600"
              >
                เริ่มทดลองใช้ฟรี
              </Link>
              <Link
                href="/pricing"
                className="rounded-2xl border border-slate-600 bg-slate-800/80 px-6 py-3 text-sm font-medium text-slate-200 hover:bg-slate-700"
              >
                ดูแพ็กเกจและราคา
              </Link>
            </div>
          </div>
          <p className="mt-5 text-xs text-slate-500">
            DischargeX เป็นเครื่องมือช่วยจัดระบบข้อมูลทางคลินิก ผู้ใช้งานต้องตรวจสอบความถูกต้องของข้อมูลและรหัสวินิจฉัยก่อนนำไปใช้จริงทุกครั้ง
          </p>
        </div>
      </section>

      <div className="mx-auto max-w-6xl px-4 pb-12 text-center">
        <Link href="/guidelines" className="text-sm text-cyan-400 hover:underline">
          แนวทางการใช้งานและข้อจำกัดสำหรับงานทางการแพทย์
        </Link>
      </div>
    </main>
  );
}
