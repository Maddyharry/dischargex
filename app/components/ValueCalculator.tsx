"use client";

import { useState, type FormEvent } from "react";
import { calculateDailyTimeDifferenceMinutes, formatMinutesAsThaiDuration } from "@/lib/value-calculator";

export function ValueCalculator() {
  const [casesPerDay, setCasesPerDay] = useState("10");
  const [minutesBefore, setMinutesBefore] = useState("15");
  const [minutesWithDischargeX, setMinutesWithDischargeX] = useState("8");
  const [resultMinutes, setResultMinutes] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  function calculate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const count = Number(casesPerDay);
    const before = Number(minutesBefore);
    const after = Number(minutesWithDischargeX);
    if (!Number.isInteger(count) || count < 1 || count > 500 || !Number.isFinite(before) || before <= 0 || before > 240 || !Number.isFinite(after) || after < 0 || after > 240) {
      setError("กรุณาตรวจตัวเลข: จำนวนเคสต้องอยู่ระหว่าง 1–500 และเวลาต่อเคสต้องอยู่ระหว่าง 0–240 นาที");
      setResultMinutes(null);
      return;
    }
    setError(null);
    setResultMinutes(calculateDailyTimeDifferenceMinutes(count, before, after));
  }

  const resultText = resultMinutes === null
    ? null
    : resultMinutes > 0
      ? `จากตัวเลขที่กรอก อาจใช้เวลาน้อยลงประมาณ ${formatMinutesAsThaiDuration(resultMinutes)} ต่อวัน`
      : resultMinutes < 0
        ? `จากตัวเลขที่กรอก อาจใช้เวลาเพิ่มขึ้นประมาณ ${formatMinutesAsThaiDuration(Math.abs(resultMinutes))} ต่อวัน`
        : "จากตัวเลขที่กรอก เวลารวมต่อวันใกล้เคียงกัน";

  return (
    <section className="mx-auto max-w-6xl px-6 py-12" aria-labelledby="value-calculator-heading">
      <div className="rounded-2xl border border-cyan-400/20 bg-cyan-400/5 p-6 sm:p-10">
        <p className="text-sm text-cyan-300">ลองคำนวณกับเวลางานของคุณ</p>
        <h2 id="value-calculator-heading" className="mt-2 text-2xl font-semibold">
          DischargeX อาจช่วยลดเวลางานได้เท่าไร?
        </h2>
        <p className="mt-3 max-w-3xl leading-relaxed text-slate-300">
          ใส่จำนวนเคสต่อวัน และเวลาที่ใช้ต่อเคสก่อนกับหลังใช้ DischargeX
          โดยเวลาหลังใช้ให้รวมเวลาที่คุณตรวจและแก้ร่างแล้ว ระบบจะนำตัวเลขมาเปรียบเทียบให้
        </p>

        <form className="mt-6" onSubmit={calculate}>
          <div className="grid gap-5 sm:grid-cols-3">
            <label className="text-sm font-medium text-slate-200">
              สรุปกี่เคสต่อวัน?
              <input
                aria-label="จำนวนเคสต่อวัน"
                className="mt-2 block w-full rounded-lg border border-slate-600 bg-slate-900 p-3 text-white"
                type="number" min="1" max="500" step="1" required
                value={casesPerDay} onChange={(event) => setCasesPerDay(event.target.value)}
              />
              <span className="mt-1 block text-xs font-normal text-slate-400">ใส่จำนวนเคสโดยประมาณ</span>
            </label>
            <label className="text-sm font-medium text-slate-200">
              ตอนนี้ใช้เวลากี่นาทีต่อเคส?
              <input
                aria-label="เวลาที่ใช้สรุปเองต่อเคสเป็นนาที"
                className="mt-2 block w-full rounded-lg border border-slate-600 bg-slate-900 p-3 text-white"
                type="number" min="0.1" max="240" step="0.5" required
                value={minutesBefore} onChange={(event) => setMinutesBefore(event.target.value)}
              />
              <span className="mt-1 block text-xs font-normal text-slate-400">ใส่เวลาที่ทำเองต่อเคส</span>
            </label>
            <label className="text-sm font-medium text-slate-200">
              ถ้าใช้ DischargeX คาดว่าจะใช้กี่นาที?
              <input
                aria-label="เวลาที่คาดว่าจะใช้กับ DischargeX รวมตรวจทานเป็นนาที"
                className="mt-2 block w-full rounded-lg border border-slate-600 bg-slate-900 p-3 text-white"
                type="number" min="0" max="240" step="0.5" required
                value={minutesWithDischargeX} onChange={(event) => setMinutesWithDischargeX(event.target.value)}
              />
              <span className="mt-1 block text-xs font-normal text-slate-400">รวมเวลาตรวจและแก้ร่างแล้ว</span>
            </label>
          </div>
          <button className="mt-6 rounded-lg bg-cyan-300 px-5 py-3 font-semibold text-slate-950 hover:bg-cyan-200 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-cyan-300" type="submit">
            คำนวณเวลาต่อวัน
          </button>
        </form>

        <p className="mt-4 text-sm text-slate-400">
          ตัวอย่าง: 10 เคส × (ทำเอง 15 นาที − ใช้หลังตรวจร่าง 8 นาที) = ต่างกันประมาณ 70 นาทีต่อวัน
        </p>
        {error && <p className="mt-4 text-sm text-rose-300" role="alert">{error}</p>}
        {resultText && (
          <output className="mt-5 block rounded-xl border border-cyan-200/20 bg-slate-950/50 p-4 text-lg font-medium text-cyan-100" aria-live="polite">
            {resultText}
          </output>
        )}
        <p className="mt-4 text-sm leading-relaxed text-slate-400">
          เป็นการคำนวณจากตัวเลขที่คุณกรอกเท่านั้น ผลจริงขึ้นกับแต่ละเคส และไม่ใช่การรับประกันว่าจะประหยัดเวลาได้ตามนี้
        </p>
      </div>
    </section>
  );
}
