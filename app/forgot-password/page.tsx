"use client";

import Link from "next/link";
import { useState } from "react";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [resetLink, setResetLink] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setMessage("");
    setResetLink(null);
    if (!email.trim()) return;
    setLoading(true);
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        error?: string;
        message?: string;
        resetLink?: string;
      };
      if (!res.ok) {
        setError(data.error || "เกิดข้อผิดพลาด");
        return;
      }
      setMessage(data.message || "ส่งลิงก์รีเซ็ตรหัสผ่านแล้ว");
      if (data.resetLink) setResetLink(data.resetLink);
    } catch {
      setError("เกิดข้อผิดพลาด กรุณาลองใหม่");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 text-slate-50">
      <div className="w-full max-w-md rounded-3xl border border-white/10 bg-slate-900/80 p-6 shadow-2xl">
        <h1 className="text-2xl font-semibold">ลืมรหัสผ่าน</h1>
        <p className="mt-2 text-sm text-slate-400">
          ใส่อีเมลที่ใช้สมัครสมาชิก เราจะส่งลิงก์ให้คุณตั้งรหัสผ่านใหม่
        </p>

        {error && (
          <div className="mt-4 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
            {error}
          </div>
        )}
        {message && (
          <div className="mt-4 rounded-xl border border-cyan-500/30 bg-cyan-500/10 px-4 py-3 text-sm text-cyan-200">
            {message}
            {resetLink && (
              <p className="mt-2 break-all text-xs">
                ลิงก์สำหรับทดสอบ:{" "}
                <a href={resetLink} className="underline">
                  คลิกที่นี่
                </a>
              </p>
            )}
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-6 space-y-3">
          <input
            type="email"
            placeholder="อีเมล"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-xl border border-white/10 bg-slate-800/80 px-4 py-3 text-slate-100 placeholder-slate-500 focus:border-cyan-500 focus:outline-none"
            required
          />
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-2xl bg-cyan-600 px-4 py-3 text-sm font-medium text-white shadow hover:bg-cyan-500 disabled:opacity-50"
          >
            {loading ? "กำลังส่ง..." : "ส่งลิงก์รีเซ็ตรหัสผ่าน"}
          </button>
        </form>

        <p className="mt-4 text-center">
          <Link href="/login" className="text-sm text-cyan-400 hover:underline">
            กลับไปเข้าสู่ระบบ
          </Link>
        </p>
      </div>
    </main>
  );
}
