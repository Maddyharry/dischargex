"use client";

import Link from "next/link";
import { useSession, signOut } from "next-auth/react";
import { useEffect, useState, useRef } from "react";

type UsageInfo = {
  plan: string;
  remaining: number;
  total: number;
  daysLeftInMonth?: number;
} | null;

function formatPlanName(plan: string): string {
  switch (plan) {
    case "basic_monthly":
      return "Basic Monthly";
    case "basic_yearly":
      return "Basic Yearly";
    case "standard_monthly":
      return "Standard Monthly";
    case "standard_yearly":
      return "Standard Yearly";
    case "pro_monthly":
      return "Pro Monthly";
    case "pro_yearly":
      return "Pro Yearly";
    default:
      return plan;
  }
}

export function Header() {
  const { data: session, status } = useSession();
  const [usage, setUsage] = useState<UsageInfo>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [logoutAllLoading, setLogoutAllLoading] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  function refreshUsage() {
    if (!session?.user) return;
    fetch("/api/usage")
      .then((r) => r.json())
      .then((d) => {
        if (d.ok && d.remaining !== undefined && d.total !== undefined) {
          setUsage({
            plan: d.plan ?? (session?.user as { plan?: string })?.plan ?? "trial",
            remaining: d.remaining,
            total: d.total,
            daysLeftInMonth: typeof d.daysLeftInMonth === "number" ? d.daysLeftInMonth : undefined,
          });
        }
      })
      .catch(() => setUsage(null));
  }

  useEffect(() => {
    refreshUsage();
  }, [session?.user]);

  useEffect(() => {
    function onUsageUpdated() {
      refreshUsage();
    }
    window.addEventListener("usage-updated", onUsageUpdated);
    return () => window.removeEventListener("usage-updated", onUsageUpdated);
  });

  useEffect(() => {
    if (!menuOpen) return;
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [menuOpen]);

  const displayName = session?.user?.name || session?.user?.email || "บัญชี";
  const isAdmin = (session?.user as { role?: string })?.role === "admin";

  async function handleSignOut() {
    try {
      const key = "dischargex_device_id";
      const deviceId = typeof window !== "undefined" ? window.localStorage.getItem(key) : null;
      if (deviceId) {
        await fetch("/api/auth/logout-device", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ deviceId }),
        });
      }
    } catch {
      // ignore cleanup error; still continue sign out
    } finally {
      setMenuOpen(false);
      void signOut({ callbackUrl: "/" });
    }
  }

  async function handleSignOutAllDevices() {
    if (logoutAllLoading) return;
    setLogoutAllLoading(true);
    try {
      await fetch("/api/auth/logout-all-devices", {
        method: "POST",
      });
    } catch {
      // ignore cleanup error; still continue sign out
    } finally {
      setLogoutAllLoading(false);
      setMenuOpen(false);
      void signOut({ callbackUrl: "/" });
    }
  }

  return (
    <header className="sticky top-0 z-50 border-b border-slate-800 bg-[#081120]/95 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between gap-4 px-4">
        <Link href={session?.user ? "/app" : "/"} className="shrink-0 text-lg font-semibold text-white">
          Discharge<span className="text-cyan-400">X</span>
        </Link>

        <nav className="flex min-w-0 flex-1 items-center justify-end gap-1 sm:gap-2">
          <Link
            href="/guidelines"
            className="shrink-0 rounded-lg px-2.5 py-2 text-sm text-slate-300 hover:bg-white/5 hover:text-white"
          >
            แนวทาง
          </Link>
          <Link
            href="/pricing"
            className="shrink-0 rounded-lg px-2.5 py-2 text-sm text-slate-300 hover:bg-white/5 hover:text-white"
          >
            แพ็กเกจ
          </Link>

          {status === "loading" ? (
            <span className="h-9 w-20 shrink-0 rounded-lg bg-slate-800/50" aria-hidden />
          ) : session?.user ? (
            <div className="relative shrink-0" ref={menuRef}>
              <button
                type="button"
                onClick={() => setMenuOpen((o) => !o)}
                className="flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-800/80 px-3 py-2 text-sm text-slate-200 transition hover:border-slate-600 hover:bg-slate-800"
                aria-expanded={menuOpen}
                aria-haspopup="true"
              >
                <span className="hidden max-w-[120px] truncate sm:inline" title={String(displayName)}>
                  {displayName}
                </span>
                {usage && (
                  <span className="rounded-md bg-emerald-500/20 px-1.5 py-0.5 text-xs font-medium text-emerald-300">
                    {usage.remaining}/{usage.total}
                  </span>
                )}
                <svg
                  className={`h-4 w-4 shrink-0 text-slate-400 transition ${menuOpen ? "rotate-180" : ""}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {menuOpen && (
                <div className="absolute right-0 top-full z-50 mt-1.5 w-56 overflow-hidden rounded-xl border border-slate-700 bg-slate-900 shadow-xl">
                  <div className="border-b border-slate-700/80 bg-slate-800/50 px-4 py-3">
                    <p className="truncate text-sm font-medium text-white" title={String(displayName)}>
                      {displayName}
                    </p>
                    {usage && (
                      <p className="mt-0.5 text-xs text-slate-400">
                        แผน{" "}
                        <span className="text-slate-300">
                          {formatPlanName(usage.plan)}
                        </span>
                        {" · "}
                        <span className="text-emerald-400">เครดิตในรอบนี้ {usage.remaining}/{usage.total}</span>
                        {usage.daysLeftInMonth !== undefined && (
                          <>
                            {" · "}
                            <span className="text-slate-500">เหลืออีก {usage.daysLeftInMonth} วัน</span>
                          </>
                        )}
                      </p>
                    )}
                  </div>
                  <div className="py-1">
                    <Link
                      href="/app"
                      className="block px-4 py-2.5 text-sm text-slate-200 hover:bg-slate-800 hover:text-white"
                      onClick={() => setMenuOpen(false)}
                    >
                      Workspace
                    </Link>
                    <Link
                      href="/app/history"
                      className="block px-4 py-2.5 text-sm text-slate-200 hover:bg-slate-800 hover:text-white"
                      onClick={() => setMenuOpen(false)}
                    >
                      ประวัติการใช้งาน
                    </Link>
                    <Link
                      href="/app/profile"
                      className="block px-4 py-2.5 text-sm text-slate-200 hover:bg-slate-800 hover:text-white"
                      onClick={() => setMenuOpen(false)}
                    >
                      ข้อมูลของฉัน
                    </Link>
                    {isAdmin && (
                      <Link
                        href="/admin"
                        className="block px-4 py-2.5 text-sm text-amber-200 hover:bg-slate-800 hover:text-amber-100"
                        onClick={() => setMenuOpen(false)}
                      >
                        หลังบ้าน
                      </Link>
                    )}
                  </div>
                  <div className="border-t border-slate-700/80 py-1">
                    <button
                      type="button"
                      onClick={handleSignOutAllDevices}
                      disabled={logoutAllLoading}
                      className="block w-full px-4 py-2.5 text-left text-sm text-slate-400 hover:bg-slate-800 hover:text-amber-200 disabled:opacity-50"
                    >
                      {logoutAllLoading ? "กำลังออกจากทุกอุปกรณ์..." : "ออกจากทุกอุปกรณ์"}
                    </button>
                    <button
                      type="button"
                      onClick={handleSignOut}
                      className="block w-full px-4 py-2.5 text-left text-sm text-slate-400 hover:bg-slate-800 hover:text-red-300"
                    >
                      ออกจากระบบ
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <Link
              href="/login"
              className="shrink-0 rounded-full bg-cyan-500 px-4 py-2 text-sm font-medium text-white hover:bg-cyan-600"
            >
              เข้าสู่ระบบ
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
