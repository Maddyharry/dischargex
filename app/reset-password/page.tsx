"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { useRouter } from "next/navigation";

function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get("token") || "";
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (password !== confirmPassword) {
      setError("รหัสผ่านกับยืนยันรหัสผ่านไม่ตรงกัน");
      return;
    }
    if (password.length < 6) {
      setError("รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร");
      return;
    }
    if (!token) {
      setError("ไม่มีลิงก์รีเซ็ตรหัสผ่าน กรุณาขอลิงก์ใหม่จากหน้าลืมรหัสผ่าน");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) {
        setError(data.error || "ตั้งรหัสผ่านใหม่ไม่สำเร็จ");
        return;
      }
      router.push("/login?reset=1");
    } catch {
      setError("เกิดข้อผิดพลาด กรุณาลองใหม่");
    } finally {
      setLoading(false);
    }
  }

  if (!token) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-950 text-slate-50">
        <div className="w-full max-w-md rounded-3xl border border-white/10 bg-slate-900/80 p-6 shadow-2xl">
          <h1 className="text-2xl font-semibold">ลิงก์ไม่ถูกต้อง</h1>
          <p className="mt-2 text-sm text-slate-400">
            กรุณาไปที่หน้าลืมรหัสผ่าน แล้วใส่อีเมลเพื่อรับลิงก์ใหม่
          </p>
          <p className="mt-4">
            <Link href="/forgot-password" className="text-cyan-400 hover:underline">
              ไปหน้าลืมรหัสผ่าน
            </Link>
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 text-slate-50">
      <div className="w-full max-w-md rounded-3xl border border-white/10 bg-slate-900/80 p-6 shadow-2xl">
        <h1 className="text-2xl font-semibold">ตั้งรหัสผ่านใหม่</h1>
        <p className="mt-2 text-sm text-slate-400">
          ใส่รหัสผ่านใหม่ที่ต้องการใช้
        </p>

        {error && (
          <div className="mt-4 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-6 space-y-3">
          <input
            type="password"
            placeholder="รหัสผ่านใหม่ * (อย่างน้อย 6 ตัวอักษร)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-xl border border-white/10 bg-slate-800/80 px-4 py-3 text-slate-100 placeholder-slate-500 focus:border-cyan-500 focus:outline-none"
            required
            minLength={6}
          />
          <input
            type="password"
            placeholder="ยืนยันรหัสผ่านใหม่ *"
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
            {loading ? "กำลังบันทึก..." : "ตั้งรหัสผ่านใหม่"}
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

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center bg-slate-950 text-slate-50">
          <div className="h-8 w-3/4 animate-pulse rounded bg-slate-700" />
        </main>
      }
    >
      <ResetPasswordForm />
    </Suspense>
  );
}
