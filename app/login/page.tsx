"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { Suspense, useState } from "react";

const ERROR_MESSAGES: Record<string, string> = {
  OAuthAccountNotLinked:
    "อีเมลนี้มีในระบบแล้วแต่ยังไม่ได้ผูกกับ Google กรุณาลองกดเข้าสู่ด้วย Google อีกครั้ง (ระบบจะผูกบัญชีให้อัตโนมัติ)",
  OAuthSignin: "เกิดข้อผิดพลาดในการเชื่อมต่อ OAuth",
  OAuthCallback: "เกิดข้อผิดพลาดในการรับข้อมูลจาก Google",
  OAuthCreateAccount: "ไม่สามารถสร้างบัญชีได้",
  CredentialsSignin: "อีเมลหรือรหัสผ่านไม่ถูกต้อง",
  Callback: "เกิดข้อผิดพลาดในการเข้าสู่ระบบ",
  Default: "เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง",
};

function LoginForm() {
  const searchParams = useSearchParams();
  const error = searchParams.get("error") || "";
  const errorMsg = ERROR_MESSAGES[error] || (error ? ERROR_MESSAGES.Default : null);
  const registered = searchParams.get("registered") === "1";
  const reset = searchParams.get("reset") === "1";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleEmailSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || !password) return;
    setLoading(true);
    try {
      const res = await signIn("credentials", {
        email: email.trim(),
        password,
        callbackUrl: "/app",
        redirect: false,
      });
      if (res?.url) window.location.href = res.url;
      else if (res?.error) setPassword("");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 text-slate-50">
      <div className="w-full max-w-md rounded-3xl border border-white/10 bg-slate-900/80 p-6 shadow-2xl">
        <h1 className="text-2xl font-semibold">เข้าสู่ระบบ DischargeX</h1>
        <p className="mt-2 text-sm text-slate-400">
          ทดลองใช้งานฟรี 10 เครดิต (ใช้ได้ 7 วัน) หลังจากนั้นสามารถอัปเกรดแพ็กเกจได้ตลอดเวลา
        </p>

        {registered && (
          <div className="mt-4 rounded-xl border border-cyan-500/30 bg-cyan-500/10 px-4 py-3 text-sm text-cyan-200">
            สมัครสมาชิกสำเร็จ กรุณาเข้าสู่ระบบ
          </div>
        )}
        {reset && (
          <div className="mt-4 rounded-xl border border-cyan-500/30 bg-cyan-500/10 px-4 py-3 text-sm text-cyan-200">
            ตั้งรหัสผ่านใหม่เรียบร้อย กรุณาเข้าสู่ระบบ
          </div>
        )}
        {errorMsg && (
          <div className="mt-4 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleEmailSubmit} className="mt-6 space-y-3">
          <input
            type="email"
            placeholder="อีเมล"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-xl border border-white/10 bg-slate-800/80 px-4 py-3 text-slate-100 placeholder-slate-500 focus:border-cyan-500 focus:outline-none"
            required
          />
          <input
            type="password"
            placeholder="รหัสผ่าน"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-xl border border-white/10 bg-slate-800/80 px-4 py-3 text-slate-100 placeholder-slate-500 focus:border-cyan-500 focus:outline-none"
            required
          />
          <div className="flex justify-end">
            <Link href="/forgot-password" className="text-xs text-cyan-400 hover:underline">
              ลืมรหัสผ่าน?
            </Link>
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-2xl bg-cyan-600 px-4 py-3 text-sm font-medium text-white shadow hover:bg-cyan-500 disabled:opacity-50"
          >
            {loading ? "กำลังเข้าสู่ระบบ..." : "เข้าสู่ด้วยอีเมล"}
          </button>
        </form>

        <p className="mt-4 text-center text-xs text-slate-500">หรือ</p>

        <div className="mt-4 space-y-3">
          <button
            type="button"
            onClick={() => signIn("google", { callbackUrl: "/app" })}
            className="w-full rounded-2xl bg-white px-4 py-3 text-sm font-medium text-slate-900 shadow hover:bg-slate-100"
          >
            เข้าสู่ด้วย Google
          </button>
        </div>

        <p className="mt-4 text-center text-sm text-slate-500">
          ยังไม่มีบัญชี?{" "}
          <Link href="/signup" className="text-cyan-400 hover:underline">
            สมัครสมาชิก
          </Link>
        </p>

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

export default function LoginPage() {
  return (
    <Suspense fallback={
      <main className="flex min-h-screen items-center justify-center bg-slate-950 text-slate-50">
        <div className="w-full max-w-md rounded-3xl border border-white/10 bg-slate-900/80 p-6">
          <div className="h-8 w-3/4 animate-pulse rounded bg-slate-700" />
          <div className="mt-4 h-4 w-full animate-pulse rounded bg-slate-700" />
        </div>
      </main>
    }>
      <LoginForm />
    </Suspense>
  );
}
