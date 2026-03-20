"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { Suspense, useEffect, useState } from "react";
import { useSession } from "next-auth/react";

const ERROR_MESSAGES: Record<string, string> = {
  OAuthAccountNotLinked:
    "อีเมลนี้มีในระบบแล้วแต่ยังไม่ได้ผูกกับ Google กรุณาลองกดเข้าสู่ด้วย Google อีกครั้ง (ระบบจะผูกบัญชีให้อัตโนมัติ)",
  OAuthSignin: "เกิดข้อผิดพลาดในการเชื่อมต่อ OAuth",
  OAuthCallback: "เกิดข้อผิดพลาดในการรับข้อมูลจาก Google",
  OAuthCreateAccount: "ไม่สามารถสร้างบัญชีได้",
  CredentialsSignin: "อีเมลหรือรหัสผ่านไม่ถูกต้อง หรืออีเมลยังไม่ได้ยืนยัน",
  InvalidToken: "ลิงก์ยืนยันอีเมลไม่ถูกต้องหรือหมดอายุ",
  Callback: "เกิดข้อผิดพลาดในการเข้าสู่ระบบ",
  Default: "เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง",
};

function LoginForm() {
  const rememberedEmailKey = "dischargex_last_login_email";
  const rememberUserKey = "dischargex_remember_user";
  const router = useRouter();
  const { status } = useSession();
  const searchParams = useSearchParams();
  const error = searchParams.get("error") || "";
  const errorMsg = ERROR_MESSAGES[error] || (error ? ERROR_MESSAGES.Default : null);
  const registered = searchParams.get("registered") === "1";
  const reset = searchParams.get("reset") === "1";
  const verified = searchParams.get("verified") === "1";
  const emailFromQuery = (searchParams.get("email") || "").trim();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [resendMessage, setResendMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [devVerifyUrl, setDevVerifyUrl] = useState<string | null>(null);
  const [rememberUser, setRememberUser] = useState(true);

  useEffect(() => {
    if (status === "authenticated") {
      router.replace("/app");
    }
  }, [router, status]);

  useEffect(() => {
    if (!emailFromQuery) return;
    setEmail((prev) => (prev.trim() ? prev : emailFromQuery));
  }, [emailFromQuery]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const savedPref = window.localStorage.getItem(rememberUserKey);
    if (savedPref === "0") {
      setRememberUser(false);
      return;
    }
    if (emailFromQuery) {
      window.localStorage.setItem(rememberedEmailKey, emailFromQuery);
      return;
    }
    const remembered = window.localStorage.getItem(rememberedEmailKey) || "";
    if (remembered) {
      setEmail((prev) => (prev.trim() ? prev : remembered));
    }
  }, [emailFromQuery]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(rememberUserKey, rememberUser ? "1" : "0");
    if (!rememberUser) {
      window.localStorage.removeItem(rememberedEmailKey);
    }
  }, [rememberUser]);

  if (status === "authenticated") {
    return null;
  }

  async function handleEmailSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || !password) return;
    setLoading(true);
    try {
      if (typeof window !== "undefined" && rememberUser) {
        window.localStorage.setItem(rememberedEmailKey, email.trim());
      }
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

  async function handleResendVerification() {
    const targetEmail = (email.trim() || emailFromQuery).toLowerCase();
    if (!targetEmail) {
      setResendMessage({ ok: false, text: "กรุณากรอกอีเมลก่อนส่งอีเมลยืนยันอีกครั้ง" });
      return;
    }

    setResendLoading(true);
    setResendMessage(null);
    setDevVerifyUrl(null);
    try {
      const res = await fetch("/api/auth/resend-verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: targetEmail }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        error?: string;
        message?: string;
        verifyUrl?: string;
      };
      if (!res.ok || !data.ok) {
        setResendMessage({ ok: false, text: data.error || "ส่งอีเมลยืนยันไม่สำเร็จ" });
        return;
      }
      setResendMessage({
        ok: true,
        text:
          data.message ||
          "ส่งอีเมลยืนยันอีกครั้งแล้ว กรุณาตรวจสอบกล่องจดหมายและโฟลเดอร์ Spam/Junk/Promotions",
      });
      if (data.verifyUrl) setDevVerifyUrl(data.verifyUrl);
    } catch {
      setResendMessage({ ok: false, text: "เกิดข้อผิดพลาด กรุณาลองใหม่" });
    } finally {
      setResendLoading(false);
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
          <div className="mt-4 space-y-3 rounded-xl border border-cyan-500/30 bg-cyan-500/10 px-4 py-3 text-sm text-cyan-200">
            <p>สมัครสมาชิกสำเร็จ กรุณาตรวจสอบอีเมลเพื่อยืนยันก่อนเข้าสู่ระบบ</p>
            <div className="rounded-lg border border-slate-700/80 bg-slate-900/80 px-3 py-2 text-xs text-slate-300">
              <p>หากไม่พบอีเมล กรุณาตรวจสอบโฟลเดอร์ Spam/Junk/Promotions</p>
              <p className="mt-1">ค้นหาผู้ส่ง: noreply@dischargex.net</p>
            </div>
            <button
              type="button"
              onClick={handleResendVerification}
              disabled={resendLoading}
              className="rounded-lg border border-cyan-400/40 bg-cyan-500/10 px-3 py-2 text-xs font-medium text-cyan-100 hover:bg-cyan-500/20 disabled:opacity-50"
            >
              {resendLoading ? "กำลังส่ง..." : "ส่งอีเมลยืนยันอีกครั้ง"}
            </button>
          </div>
        )}
        {verified && (
          <div className="mt-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
            ยืนยันอีเมลสำเร็จ! กรุณาเข้าสู่ระบบ
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
        {resendMessage && (
          <div
            className={`mt-4 rounded-xl border px-4 py-3 text-sm ${
              resendMessage.ok
                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-200"
                : "border-amber-500/30 bg-amber-500/10 text-amber-200"
            }`}
          >
            {resendMessage.text}
          </div>
        )}
        {devVerifyUrl && (
          <p className="mt-3 text-xs text-slate-400">
            ลิงก์สำหรับยืนยัน (dev mode):{" "}
            <a href={devVerifyUrl} className="break-all text-cyan-400 underline">
              คลิกที่นี่
            </a>
          </p>
        )}

        <form onSubmit={handleEmailSubmit} className="mt-6 space-y-3">
          <input
            type="email"
            placeholder="อีเมล"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="username"
            className="w-full rounded-xl border border-white/10 bg-slate-800/80 px-4 py-3 text-slate-100 placeholder-slate-500 focus:border-cyan-500 focus:outline-none"
            required
          />
          <input
            type="password"
            placeholder="รหัสผ่าน"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            className="w-full rounded-xl border border-white/10 bg-slate-800/80 px-4 py-3 text-slate-100 placeholder-slate-500 focus:border-cyan-500 focus:outline-none"
            required
          />
          <div className="flex items-center justify-between gap-3">
            <label className="inline-flex cursor-pointer items-center gap-2 text-xs text-slate-300">
              <input
                type="checkbox"
                checked={rememberUser}
                onChange={(e) => setRememberUser(e.target.checked)}
                className="h-4 w-4 rounded border-slate-600 bg-slate-900 text-cyan-500 focus:ring-cyan-500"
              />
              บันทึก user (อีเมล)
            </label>
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
