"use client";

import Link from "next/link";
import { signIn } from "next-auth/react";

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 text-slate-50">
      <div className="w-full max-w-md rounded-3xl border border-white/10 bg-slate-900/80 p-6 shadow-2xl">
        <h1 className="text-2xl font-semibold">เข้าสู่ระบบ DischargeX</h1>
        <p className="mt-2 text-sm text-slate-400">
          ทดลองใช้งานฟรี 5 เคสแรก หลังจากนั้นสามารถอัปเกรดแพ็กเกจได้ตลอดเวลา
        </p>

        <div className="mt-6 space-y-3">
          <button
            type="button"
            onClick={() => signIn("google", { callbackUrl: "/app" })}
            className="w-full rounded-2xl bg-white px-4 py-3 text-sm font-medium text-slate-900 shadow hover:bg-slate-100"
          >
            เข้าสู่ด้วย Google
          </button>

          <button
            type="button"
            onClick={() => signIn("facebook", { callbackUrl: "/app" })}
            className="w-full rounded-2xl bg-[#1877f2] px-4 py-3 text-sm font-medium text-white shadow hover:brightness-110"
          >
            เข้าสู่ด้วย Facebook
          </button>
        </div>

        <p className="mt-4 text-xs text-slate-500">
          การใช้งานถือว่ายอมรับว่า AI เป็นเพียงผู้ช่วย ต้องมีแพทย์หรือ coder ตรวจสอบผลลัพธ์ทุกครั้ง
          {" "}
          <Link href="/guidelines" className="text-cyan-400 hover:underline">
            อ่านแนวทางใช้งานและข้อจำกัด
          </Link>
        </p>

        <p className="mt-6 text-center">
          <Link
            href="/login/admin"
            className="text-[11px] text-slate-600 hover:text-slate-500"
          >
            สำหรับผู้ดูแลระบบ
          </Link>
        </p>
      </div>
    </main>
  );
}
