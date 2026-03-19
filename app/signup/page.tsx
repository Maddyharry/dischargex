"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useEffect } from "react";

function isValidEmail(value: string): boolean {
  const email = value.trim().toLowerCase();
  if (!email) return false;
  if (email.includes("..")) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);
}

export default function SignupPage() {
  const router = useRouter();
  const { status } = useSession();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [verifyUrl, setVerifyUrl] = useState<string | null>(null);

  useEffect(() => {
    if (status === "authenticated") {
      router.replace("/app");
    }
  }, [router, status]);

  if (status === "authenticated") {
    return null;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!isValidEmail(email)) {
      setError("รูปแบบอีเมลไม่ถูกต้อง กรุณาใช้อีเมลจริง");
      return;
    }
    if (password !== confirmPassword) {
      setError("รหัสผ่านกับยืนยันรหัสผ่านไม่ตรงกัน");
      return;
    }
    if (password.length < 6) {
      setError("รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          password,
          name: name.trim() || undefined,
        }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string; message?: string; verifyUrl?: string; needVerify?: boolean };
      if (!res.ok || !data.ok) {
        setError(data.error || "สมัครไม่สำเร็จ");
        return;
      }
      if (data.verifyUrl) {
        setVerifyUrl(data.verifyUrl);
        return;
      }
      router.push(`/login?registered=1&email=${encodeURIComponent(email.trim())}`);
    } catch {
      setError("เกิดข้อผิดพลาด กรุณาลองใหม่");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 text-slate-50">
      <div className="w-full max-w-md rounded-3xl border border-white/10 bg-slate-900/80 p-6 shadow-2xl">
        <h1 className="text-2xl font-semibold">สมัครสมาชิก DischargeX</h1>
        <p className="mt-2 text-sm text-slate-400">
          สมัครด้วยอีเมลและรหัสผ่าน เพื่อทดลองใช้งานฟรี 10 เครดิต (7 วัน)
        </p>

        {error && (
          <div className="mt-4 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
            {error}
          </div>
        )}

        {verifyUrl ? (
          <div className="mt-6 space-y-3">
            <div className="rounded-xl border border-cyan-500/30 bg-cyan-500/10 px-4 py-3 text-sm text-cyan-200">
              สมัครสำเร็จ! กรุณายืนยันอีเมลก่อนเข้าสู่ระบบ
            </div>
            <div className="rounded-xl border border-slate-700 bg-slate-900/70 px-4 py-3 text-xs text-slate-300">
              <p>หากไม่พบอีเมลในกล่องจดหมาย กรุณาตรวจสอบโฟลเดอร์ Spam/Junk/Promotions</p>
              <p className="mt-1">ค้นหาผู้ส่ง: noreply@dischargex.net</p>
            </div>
            <p className="text-xs text-slate-400">
              ลิงก์สำหรับยืนยัน (dev mode):{" "}
              <a href={verifyUrl} className="text-cyan-400 underline break-all">
                คลิกที่นี่
              </a>
            </p>
            <p className="text-center text-sm text-slate-500">
              <Link href="/login" className="text-cyan-400 hover:underline">
                กลับไปเข้าสู่ระบบ
              </Link>
            </p>
          </div>
        ) : null}

        <form onSubmit={handleSubmit} className={`mt-6 space-y-3 ${verifyUrl ? "hidden" : ""}`}>
          <input
            type="email"
            placeholder="อีเมล *"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onBlur={(e) => {
              if (e.target.value.trim() && !isValidEmail(e.target.value)) {
                setError("รูปแบบอีเมลไม่ถูกต้อง กรุณาใช้อีเมลจริง");
              } else {
                setError((prev) => (prev.includes("อีเมล") ? "" : prev));
              }
            }}
            className="w-full rounded-xl border border-white/10 bg-slate-800/80 px-4 py-3 text-slate-100 placeholder-slate-500 focus:border-cyan-500 focus:outline-none"
            required
          />
          <input
            type="text"
            placeholder="ชื่อ (ไม่บังคับ)"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-xl border border-white/10 bg-slate-800/80 px-4 py-3 text-slate-100 placeholder-slate-500 focus:border-cyan-500 focus:outline-none"
          />
          <input
            type="password"
            placeholder="รหัสผ่าน * (อย่างน้อย 6 ตัวอักษร)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-xl border border-white/10 bg-slate-800/80 px-4 py-3 text-slate-100 placeholder-slate-500 focus:border-cyan-500 focus:outline-none"
            required
            minLength={6}
          />
          <input
            type="password"
            placeholder="ยืนยันรหัสผ่าน *"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="w-full rounded-xl border border-white/10 bg-slate-800/80 px-4 py-3 text-slate-100 placeholder-slate-500 focus:border-cyan-500 focus:outline-none"
            required
            minLength={6}
          />
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-2xl bg-cyan-600 px-4 py-3 text-sm font-medium text-white shadow hover:bg-cyan-500 disabled:opacity-50"
          >
            {loading ? "กำลังสมัคร..." : "สมัครสมาชิก"}
          </button>
        </form>

        <p className="mt-4 text-center text-sm text-slate-500">
          มีบัญชีอยู่แล้ว?{" "}
          <Link href="/login" className="text-cyan-400 hover:underline">
            เข้าสู่ระบบ
          </Link>
        </p>
      </div>
    </main>
  );
}
