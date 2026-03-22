"use client";

import Link from "next/link";

export function TutorialIntroModal({
  open,
  isGuest,
  onStart,
  onSkip,
}: {
  open: boolean;
  isGuest: boolean;
  onStart: () => void;
  onSkip: () => void;
}) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="tutorial-intro-title"
    >
      <div className="relative max-w-md rounded-3xl border border-cyan-500/35 bg-gradient-to-b from-slate-900 to-slate-950 p-6 shadow-2xl shadow-cyan-950/40">
        <div className="text-center text-4xl" aria-hidden>
          📱
        </div>
        <h2
          id="tutorial-intro-title"
          className="mt-3 text-center text-xl font-semibold text-white"
        >
          เข้าสู่ Tutorial แบบทีละขั้น
        </h2>
        <p className="mt-3 text-center text-sm leading-relaxed text-slate-300">
          จำลองการใช้งานจริง: เปิดหน้าต่าง order sheet แยกต่างหาก คัดลอก วางในช่อง Clinical แล้วกดสร้างสรุป
          {isGuest ? " (โหมดสาธิต — ผลเป็นข้อมูลจำลอง)" : ""}
        </p>
        <p className="mt-3 text-center text-xs leading-relaxed text-slate-500">
          ถ้ากด <span className="font-medium text-slate-400">ไม่ใช่ตอนนี้</span> ระบบจะไม่แสดงหน้านี้อีกเมื่อเข้าเว็บ — เริ่ม tutorial ใหม่ได้จาก Quick Start หรือโปรไฟล์
        </p>
        <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
          <button
            type="button"
            onClick={onStart}
            className="rounded-2xl bg-gradient-to-r from-cyan-500 to-blue-600 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-cyan-900/40 transition hover:brightness-110"
          >
            เริ่ม Tutorial
          </button>
          <button
            type="button"
            onClick={onSkip}
            className="rounded-2xl border border-slate-600 bg-slate-900/90 px-6 py-3 text-sm font-medium text-slate-300 hover:bg-slate-800"
          >
            ไม่ใช่ตอนนี้
          </button>
        </div>
      </div>
    </div>
  );
}

export function TutorialCompleteModal({
  open,
  isGuest,
  onClose,
}: {
  open: boolean;
  isGuest: boolean;
  onClose: () => void;
}) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="tutorial-done-title"
    >
      <div className="relative max-w-md rounded-3xl border border-emerald-500/35 bg-gradient-to-b from-slate-900 to-slate-950 p-6 shadow-2xl">
        <div className="text-center text-4xl" aria-hidden>
          ✓
        </div>
        <h2 id="tutorial-done-title" className="mt-3 text-center text-xl font-semibold text-white">
          จบ Tutorial แล้ว
        </h2>
        <p className="mt-3 text-center text-sm leading-relaxed text-slate-300">
          {isGuest ? (
            <>
              คุณลองครบ flow แล้ว — ผลที่เห็นเป็นข้อมูลจำลองจากบทเรียน ไม่ได้ประมวลผลด้วย AI จริง
            </>
          ) : (
            <>
              คุณลองครบ flow แล้ว — หน้านี้กลับสู่โหมดใช้งานปกติ ครั้งถัดไปที่กด{" "}
              <span className="font-semibold text-emerald-200/95">สร้างสรุป</span> ระบบจะเรียก AI
              จริงตามเครดิตของคุณ (ไม่ใช่ผลจำลองจากบทเรียน)
            </>
          )}
        </p>
        <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
          <button
            type="button"
            onClick={onClose}
            className="rounded-2xl bg-gradient-to-r from-emerald-600 to-cyan-600 px-6 py-3 text-sm font-semibold text-white hover:brightness-110"
          >
            เข้าใจแล้ว
          </button>
          {isGuest ? (
            <Link
              href="/signup"
              className="inline-flex items-center justify-center rounded-2xl border border-slate-600 px-6 py-3 text-sm font-medium text-slate-200 hover:bg-slate-800"
            >
              สมัครใช้งานจริง
            </Link>
          ) : null}
        </div>
      </div>
    </div>
  );
}
