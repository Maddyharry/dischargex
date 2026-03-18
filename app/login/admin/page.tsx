"use client";

import React, { useState } from "react";
import Link from "next/link";
import { signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";

function AdminLoginPageContent() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || "/admin";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const res = await signIn("admin", {
      email: email.trim(),
      password,
      callbackUrl,
      redirect: false,
    });
    if (res?.error) {
      setError("อีเมลหรือรหัสผ่านไม่ถูกต้อง");
      return;
    }
    if (res?.url) {
      window.location.href = res.url;
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 text-slate-50">
      <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-slate-900/80 p-6 shadow-xl">
        <h1 className="text-lg font-semibold text-slate-200">ผู้ดูแลระบบ</h1>
        <p className="mt-1 text-xs text-slate-500">ใช้อีเมลและรหัสผ่านที่ตั้งไว้ในระบบ</p>

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          <div>
            <label className="block text-xs text-slate-400">อีเมล</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-cyan-500"
              placeholder="admin@example.com"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-400">รหัสผ่าน</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-cyan-500"
            />
          </div>
          {error ? (
            <p className="text-xs text-red-400">{error}</p>
          ) : null}
          <button
            type="submit"
            className="w-full rounded-xl bg-slate-700 px-4 py-2.5 text-sm font-medium text-slate-200 hover:bg-slate-600"
          >
            เข้าสู่ระบบ
          </button>
        </form>

        <p className="mt-4 text-center">
          <Link href="/login" className="text-xs text-slate-500 hover:text-slate-400">
            ← กลับไปหน้าเข้าสู่ระบบ
          </Link>
        </p>
      </div>
    </main>
  );
}

export default function AdminLoginPage() {
  return (
    <React.Suspense fallback={<main className="min-h-screen bg-slate-950 text-slate-50" />}>
      <AdminLoginPageContent />
    </React.Suspense>
  );
}
