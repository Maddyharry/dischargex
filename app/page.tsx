import Link from "next/link";

const heroFeatures = [
  "ลดเวลาการสรุปชาร์จต่อเคส",
  "ช่วยลดการพิมพ์ตกหล่นของข้อมูลสำคัญ",
  "ช่วยเสนอ ICD ที่เหมาะสมตามข้อมูลในเวชระเบียน",
  "ช่วยเตือนจุดที่ควรทบทวนก่อนใช้งานจริง",
] as const;

export default function Home() {
  return (
    <main className="min-h-screen bg-[#081120] text-slate-100">
      <section className="relative overflow-hidden border-b border-white/5 bg-gradient-to-b from-slate-900/60 via-[#0a1628] to-[#081120]">
        <div className="pointer-events-none absolute -top-24 right-[-10%] h-[28rem] w-[28rem] rounded-full bg-cyan-500/[0.12] blur-3xl" />
        <div className="pointer-events-none absolute bottom-[-20%] left-[-5%] h-80 w-80 rounded-full bg-blue-600/[0.08] blur-3xl" />
        <div className="pointer-events-none absolute top-1/2 left-1/2 h-96 w-96 -translate-x-1/2 -translate-y-1/2 rounded-full bg-emerald-500/[0.04] blur-3xl" />
        <div className="relative mx-auto max-w-6xl px-4 py-16 md:py-28">
          <div className="mx-auto max-w-4xl text-center">
            <p className="inline-flex rounded-full border border-cyan-500/35 bg-gradient-to-r from-cyan-500/15 to-emerald-500/10 px-4 py-1.5 text-xs font-semibold tracking-wide text-cyan-100/95 shadow-sm shadow-cyan-900/20">
              AI-assisted discharge workflow
            </p>

            <h1 className="mt-8 sm:mt-10">
              <span className="block text-5xl font-semibold tracking-tight text-white sm:text-6xl md:text-7xl lg:text-8xl">
                Discharge<span className="text-cyan-400">X</span>
              </span>
              <span className="mt-4 block text-balance text-xl font-semibold leading-snug text-slate-100 sm:text-2xl md:text-3xl md:leading-tight">
                สรุปชาร์จไวขึ้น
                <span className="text-slate-400"> · </span>
                จัดโครง coding เป็นระบบมากขึ้น
              </span>
            </h1>

            <p className="mx-auto mt-6 max-w-2xl text-pretty text-base leading-relaxed text-slate-300/95 md:text-lg md:leading-relaxed">
              ช่วยสรุป discharge summary จัดกลุ่มวินิจฉัย ค้นหา diagnosis และ procedure ที่อาจตกหล่น
              และช่วยประเมินผลต่อการ coding review กับ AdjRW แบบประมาณการ
            </p>

            <ul className="mx-auto mt-10 grid max-w-3xl gap-3 text-left sm:grid-cols-2 sm:gap-4">
              {heroFeatures.map((line) => (
                <li
                  key={line}
                  className="flex gap-3 rounded-2xl border border-white/[0.07] bg-white/[0.03] px-4 py-3 text-sm leading-snug text-slate-200 shadow-sm shadow-black/20 backdrop-blur-sm transition hover:border-cyan-500/20 hover:bg-white/[0.05]"
                >
                  <span
                    className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-cyan-500/20 text-xs font-bold text-cyan-300"
                    aria-hidden
                  >
                    ✓
                  </span>
                  <span>{line}</span>
                </li>
              ))}
            </ul>

            <p className="mx-auto mt-8 max-w-2xl text-pretty text-sm leading-relaxed text-slate-500 md:text-[0.95rem]">
              พัฒนาตามหลักการจาก ICD-10, Thai DRG และแนวทาง coding ที่เกี่ยวข้อง
              เพื่อใช้เป็นเครื่องมือช่วยทบทวนการสรุปและการจัดโครง coding
            </p>

            <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
              <Link
                href="/signup"
                className="inline-flex min-w-[160px] items-center justify-center rounded-2xl bg-gradient-to-r from-cyan-500 to-blue-600 px-7 py-3.5 text-sm font-semibold text-white shadow-lg shadow-cyan-900/40 transition hover:brightness-110"
              >
                เริ่มทดลองใช้งาน
              </Link>
              <Link
                href="/guidelines"
                className="rounded-2xl border border-slate-600/90 bg-slate-900/60 px-6 py-3.5 text-sm font-medium text-slate-100 backdrop-blur-sm transition hover:border-slate-500 hover:bg-slate-800/80"
              >
                ดูวิธีทำงาน
              </Link>
              <Link
                href="#example-output"
                className="rounded-2xl border border-slate-600/90 bg-slate-900/60 px-6 py-3.5 text-sm font-medium text-slate-100 backdrop-blur-sm transition hover:border-slate-500 hover:bg-slate-800/80"
              >
                ดูตัวอย่างผลลัพธ์
              </Link>
            </div>

            <div className="mt-8 flex flex-wrap items-center justify-center gap-2.5 text-xs font-medium">
              <span className="rounded-full border border-white/10 bg-white/[0.05] px-4 py-1.5 text-slate-200">
                ทดลองใช้ 10 เครดิต / 7 วัน
              </span>
              <span className="rounded-full border border-white/10 bg-white/[0.05] px-4 py-1.5 text-slate-200">
                เหมาะกับงาน IPD ที่มีข้อความให้คัดลอก
              </span>
            </div>

            <div className="mt-5">
              <Link
                href="/pricing"
                className="text-sm font-medium text-cyan-300/95 underline-offset-4 transition hover:text-cyan-200 hover:underline"
              >
                ดูแพ็กเกจและราคา
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-14 md:py-20">
        <div className="relative overflow-hidden rounded-3xl border border-white/[0.08] bg-gradient-to-br from-white/[0.06] via-white/[0.02] to-transparent p-8 md:p-10">
          <div className="pointer-events-none absolute -right-20 top-0 h-48 w-48 rounded-full bg-cyan-500/10 blur-2xl" />
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-400/90">ทำไมต้องใช้</p>
          <h2 className="mt-2 text-2xl font-bold tracking-tight text-white md:text-3xl">
            ออกแบบมาเพื่อช่วยงานจริง
            <span className="text-slate-400"> — </span>
            ไม่ใช่แค่สรุปข้อความ
          </h2>
          <div className="mt-6 space-y-4 text-pretty border-l-2 border-cyan-500/30 pl-5 md:pl-6">
            <p className="max-w-3xl text-base leading-relaxed text-slate-200 md:text-lg">
              ระบบไม่ได้พยายามเขียนสรุปให้สวยอย่างเดียว แต่ช่วยดึงข้อมูลจาก chart แยกบทบาทโรค ชี้ diagnosis และ procedure
              ที่อาจตกหล่น และแสดงจุดที่ควรตรวจซ้ำก่อนนำไปใช้จริง
            </p>
            <p className="max-w-3xl text-sm leading-relaxed text-slate-400 md:text-base">
              ผลลัพธ์ทุกเคสควรถูกใช้เป็นเครื่องมือช่วยตัดสินใจ โดยแพทย์หรือผู้ตรวจรหัสควรทบทวนร่วมกับข้อมูลในเวชระเบียนก่อนเสมอ
            </p>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-6 md:py-8">
        <div className="rounded-3xl border border-white/[0.08] bg-slate-950/40 p-6 md:p-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-400/90">เรียนรู้เร็ว</p>
              <h2 className="mt-1 text-xl font-bold text-white md:text-2xl">วิดีโอสอนใช้งานเบื้องต้น</h2>
              <p className="mt-2 max-w-xl text-sm leading-relaxed text-slate-400">
                ชมภาพรวมการใช้งานจริงก่อนเริ่มทดลอง เพื่อเห็น flow การทำงานตั้งแต่ต้นจนจบ
              </p>
            </div>
            <a
              href="https://youtu.be/MQeL2-lcriA"
              target="_blank"
              rel="noreferrer"
              className="inline-flex shrink-0 items-center justify-center rounded-xl border border-cyan-500/30 bg-cyan-500/10 px-4 py-2 text-sm font-medium text-cyan-200 transition hover:border-cyan-400/50 hover:bg-cyan-500/15"
            >
              เปิดใน YouTube
            </a>
          </div>
          <div className="mt-6 overflow-hidden rounded-2xl border border-slate-700/60 bg-slate-950/80 shadow-[0_0_0_1px_rgba(255,255,255,0.04)]">
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

      <section className="mx-auto max-w-6xl px-4 py-14 md:py-16">
        <div className="text-center md:text-left">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-400/90">ขั้นตอนง่ายๆ</p>
          <h2 className="mt-2 text-2xl font-bold tracking-tight text-white md:text-3xl">การทำงาน 3 ขั้นตอน</h2>
        </div>
        <div className="mt-8 grid gap-5 md:grid-cols-3 md:gap-6">
          {[
            {
              step: "1",
              title: "วางข้อมูลจากเวชระเบียน",
              body: "นำข้อความจาก order sheet หรือบันทึกที่เกี่ยวข้องเข้าสู่ช่องที่กำหนด",
            },
            {
              step: "2",
              title: "ช่วยสรุปและจัดโครง",
              body: "จัดลำดับหัวข้อสำคัญ และเสนอ ICD เพื่อช่วยทบทวนร่วมกับ chart",
            },
            {
              step: "3",
              title: "ทบทวนแล้วคัดลอกไปใช้",
              body: "ตรวจความถูกต้องโดยแพทย์หรือผู้รับผิดชอบก่อนนำไปใช้ใน workflow จริง",
            },
          ].map((item) => (
            <div
              key={item.step}
              className="relative rounded-2xl border border-white/[0.07] bg-gradient-to-b from-white/[0.05] to-transparent p-6 transition hover:border-cyan-500/25 hover:shadow-lg hover:shadow-cyan-950/30"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-500/15 text-sm font-bold text-cyan-300 ring-1 ring-cyan-500/25">
                {item.step}
              </div>
              <h3 className="mt-4 text-lg font-semibold text-white">{item.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-400">{item.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="example-output" className="mx-auto max-w-6xl scroll-mt-24 px-4 pb-14 md:pb-20">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-400/90">ทดลองดู</p>
        <h2 className="mt-2 text-2xl font-bold tracking-tight text-white md:text-3xl">ตัวอย่าง Input → Output</h2>
        <p className="mt-3 max-w-3xl text-sm leading-relaxed text-slate-400 md:text-base">
          ตัวอย่างเชิงแนวคิด — ผลจริงขึ้นกับข้อมูลที่วางและการทบทวนของผู้ใช้งาน
        </p>
        <div className="mt-8 grid gap-5 md:grid-cols-2 md:gap-6">
          <div className="rounded-2xl border border-slate-700/80 bg-slate-900/80 p-6 shadow-inner shadow-black/20">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Input (ตัวอย่าง)</p>
            <p className="mt-4 text-sm leading-7 text-slate-300">
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
          <div className="rounded-2xl border border-cyan-500/30 bg-gradient-to-br from-cyan-950/40 to-slate-900/80 p-6 shadow-lg shadow-cyan-950/20">
            <p className="text-xs font-semibold uppercase tracking-wider text-cyan-400/90">Output (ตัวอย่าง)</p>
            <p className="mt-4 text-sm leading-7 text-slate-200">
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
        <div className="mx-auto max-w-6xl px-4 py-14 md:py-16">
          <div className="relative overflow-hidden rounded-3xl border border-cyan-500/25 bg-gradient-to-br from-cyan-950/50 via-slate-900/50 to-slate-950 p-8 md:p-10">
            <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-cyan-400/10 blur-3xl" />
            <h2 className="relative text-2xl font-bold text-white md:text-3xl">เริ่มทดลองใช้งาน</h2>
            <p className="relative mt-4 max-w-2xl text-pretty text-base leading-relaxed text-slate-300 md:text-lg">
              ทดลองใช้ 10 เครดิต ภายใน 7 วัน เพื่อประเมินว่าเหมาะกับ workflow ของคุณหรือไม่
              หลังจากนั้นเลือกแพ็กเกจตามปริมาณงานได้
            </p>
            <div className="relative mt-8 flex flex-wrap gap-3">
              <Link
                href="/signup"
                className="inline-flex min-w-[160px] items-center justify-center rounded-2xl bg-gradient-to-r from-cyan-500 to-blue-600 px-7 py-3.5 text-sm font-semibold text-white shadow-lg shadow-cyan-900/40 transition hover:brightness-110"
              >
                เริ่มทดลองใช้งาน
              </Link>
              <Link
                href="/pricing"
                className="rounded-2xl border border-slate-600/90 bg-slate-900/70 px-6 py-3.5 text-sm font-medium text-slate-100 backdrop-blur-sm transition hover:border-slate-500 hover:bg-slate-800/80"
              >
                ดูแพ็กเกจและราคา
              </Link>
            </div>
          </div>
          <p className="mx-auto mt-6 max-w-3xl text-center text-xs leading-relaxed text-slate-500 md:text-sm">
            ผลลัพธ์เป็นเครื่องมือช่วยทบทวน ไม่ใช่ผลจัดกลุ่มหรือการเบิกจ่ายอย่างเป็นทางการ — โปรดทบทวนกับเวชระเบียนก่อนใช้งานจริง
          </p>
        </div>
      </section>

      <div className="mx-auto max-w-6xl px-4 pb-14 text-center">
        <Link
          href="/guidelines"
          className="text-sm font-medium text-cyan-400/95 underline-offset-4 transition hover:text-cyan-300 hover:underline"
        >
          แนวทางการใช้งานและข้อควรทราบ
        </Link>
        <span className="mx-2 text-slate-600" aria-hidden>
          ·
        </span>
        <Link
          href="/legal"
          className="text-sm font-medium text-cyan-400/95 underline-offset-4 transition hover:text-cyan-300 hover:underline"
        >
          Reference &amp; Legal Notice
        </Link>
      </div>
    </main>
  );
}
