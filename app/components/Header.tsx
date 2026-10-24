"use client";

import Link from "next/link";
import { useSession, signOut } from "next-auth/react";
import { useCallback, useEffect, useState, useRef } from "react";
import { fetchHeaderUsage, getHeaderUsageRows, type HeaderUsageInfo } from "@/lib/header-usage";

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
    case "trial":
      return "Trial";
    default:
      return plan;
  }
}

export function Header() {
  const { data: session, status } = useSession();
  const [usage, setUsage] = useState<HeaderUsageInfo | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);
  const [logoutAllLoading, setLogoutAllLoading] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const moreMenuRef = useRef<HTMLDivElement>(null);
  const usageRequestRef = useRef<Promise<void> | null>(null);

  const fallbackPlan = (session?.user as { plan?: string } | undefined)?.plan ?? "trial";
  const refreshUsage = useCallback(() => {
    if (!session?.user) return Promise.resolve();
    if (usageRequestRef.current) return usageRequestRef.current;
    const request = fetchHeaderUsage(fallbackPlan)
      .then(setUsage)
      .catch(() => setUsage(null))
      .finally(() => {
        if (usageRequestRef.current === request) usageRequestRef.current = null;
      });
    usageRequestRef.current = request;
    return request;
  }, [session?.user, fallbackPlan]);

  useEffect(() => {
    void refreshUsage();
  }, [refreshUsage]);

  useEffect(() => {
    function onUsageUpdated() {
      void refreshUsage();
    }
    window.addEventListener("usage-updated", onUsageUpdated);
    return () => window.removeEventListener("usage-updated", onUsageUpdated);
  }, [refreshUsage]);

  useEffect(() => {
    if (menuOpen) void refreshUsage();
  }, [menuOpen, refreshUsage]);

  useEffect(() => {
    if (!menuOpen && !moreMenuOpen) return;
    function handleClickOutside(e: MouseEvent) {
      const t = e.target as Node;
      if (menuOpen && menuRef.current && !menuRef.current.contains(t)) {
        setMenuOpen(false);
      }
      if (moreMenuOpen && moreMenuRef.current && !moreMenuRef.current.contains(t)) {
        setMoreMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [menuOpen, moreMenuOpen]);

  const displayName = session?.user?.name || session?.user?.email || "บัญชี";
  const isAdmin = (session?.user as { role?: string })?.role === "admin";
  const usageRows = getHeaderUsageRows(usage);

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
      <div className="mx-auto flex h-14 max-w-7xl items-center gap-2 px-4 sm:gap-4">
        <div className="flex shrink-0 items-center gap-2 sm:gap-3">
          <Link href={session?.user ? "/app" : "/"} className="shrink-0 text-lg font-semibold text-white">
            Discharge<span className="text-cyan-400">X</span>
          </Link>
        </div>

        <nav className="flex min-w-0 flex-1 items-center justify-end gap-1 sm:gap-2">
          <div className="relative inline-flex shrink-0" ref={moreMenuRef}>
            <button
              type="button"
              onClick={() => {
                setMoreMenuOpen((o) => !o);
                setMenuOpen(false);
              }}
              className="inline-flex items-center gap-1 rounded-lg px-2 py-2 text-xs text-slate-300 hover:bg-white/5 hover:text-white sm:px-2.5 sm:text-sm"
              aria-expanded={moreMenuOpen}
              aria-label="เมนูนำทาง"
            >
              <span>เมนู</span>
              <svg
                className={`h-4 w-4 shrink-0 text-slate-400 transition ${moreMenuOpen ? "rotate-180" : ""}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {moreMenuOpen ? (
              <div
                className="absolute right-0 top-full z-50 mt-1.5 min-w-[11rem] overflow-hidden rounded-xl border border-slate-700 bg-slate-900 py-1 shadow-xl"
              >
                {[["/app", "สรุปชาร์จ"], ["/learn", "วิธีใช้"], ["/knowledge", "ความรู้"], ["/pricing", "แพ็กเกจ"]].map(([href,label]) => (
                  <Link key={href} href={href} className="block px-4 py-2.5 text-sm text-slate-200 hover:bg-slate-800 hover:text-white" onClick={() => setMoreMenuOpen(false)}>{label}</Link>
                ))}
                <Link
                  href="/about"
                  className="block px-4 py-2.5 text-sm text-slate-200 hover:bg-slate-800 hover:text-white"
                  onClick={() => setMoreMenuOpen(false)}
                >
                  เกี่ยวกับเรา
                </Link>
                <Link
                  href="/legal"
                  className="block px-4 py-2.5 text-sm text-slate-200 hover:bg-slate-800 hover:text-white"
                  onClick={() => setMoreMenuOpen(false)}
                >
                  Reference
                </Link>
              </div>
            ) : null}
          </div>
          <Link
            href="/app"
            className="hidden shrink-0 rounded-lg border border-slate-600/80 bg-slate-800/40 px-3 py-2 text-sm text-slate-200 transition hover:border-slate-500 hover:bg-slate-700/40 hover:text-white sm:inline-flex"
          >
            สรุปชาร์จ
          </Link>
          <Link
            href="/learn"
            className="hidden shrink-0 rounded-lg px-2.5 py-2 text-sm text-slate-300 hover:bg-white/5 hover:text-white md:inline"
          >
            วิธีใช้
          </Link>
          <Link
            href="/knowledge"
            className="hidden shrink-0 rounded-lg px-2.5 py-2 text-sm text-slate-300 hover:bg-white/5 hover:text-white md:inline"
          >
            ความรู้
          </Link>
          <Link
            href="/pricing"
            className="hidden shrink-0 rounded-lg px-2 py-2 text-xs text-slate-300 hover:bg-white/5 hover:text-white sm:px-2.5 sm:text-sm lg:inline-flex"
          >
            แพ็กเกจ
          </Link>

          {status === "loading" ? (
            <span className="h-9 w-20 shrink-0 rounded-lg bg-slate-800/50" aria-hidden />
          ) : session?.user ? (
            <div className="relative shrink-0" ref={menuRef}>
              <button
                type="button"
                onClick={() => {
                  setMenuOpen((o) => !o);
                  setMoreMenuOpen(false);
                }}
                className="flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-800/80 px-3 py-2 text-sm text-slate-200 transition hover:border-slate-600 hover:bg-slate-800"
                aria-expanded={menuOpen}
                aria-haspopup="true"
              >
                <span className="hidden max-w-[120px] truncate sm:inline" title={String(displayName)}>
                  {displayName}
                </span>
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
                <div className="absolute right-0 top-full z-50 mt-1.5 w-72 overflow-hidden rounded-xl border border-slate-700 bg-slate-900 shadow-xl">
                  <div className="border-b border-slate-700/80 bg-slate-800/50 px-4 py-3">
                    <p className="truncate text-sm font-medium text-white" title={String(displayName)}>
                      {displayName}
                    </p>
                    <div className="mt-2 space-y-2 text-xs text-slate-400">
                      <p>แผน <span className="text-slate-300">{formatPlanName(usage?.plan ?? fallbackPlan)}</span></p>
                      {usageRows.map((row) => (
                        <p key={row.label}>
                          <span className="text-slate-300">{row.label}: </span>{row.value}
                          {row.label === "วงเงิน AI รอบแพ็กเกจ" && usage?.periodAllowanceReached ? <span className="text-amber-300"> · ถึงวงเงินแล้ว</span> : null}
                        </p>
                      ))}
                    </div>
                  </div>
                  <div className="py-1">
                    <Link
                      href="/knowledge"
                      className="block px-4 py-2.5 text-sm text-slate-200 hover:bg-slate-800 hover:text-white"
                      onClick={() => setMenuOpen(false)}
                    >
                      Knowledge
                    </Link>
                    <Link
                      href="/pricing"
                      className="block px-4 py-2.5 text-sm text-slate-200 hover:bg-slate-800 hover:text-white"
                      onClick={() => setMenuOpen(false)}
                    >
                      แพ็กเกจ
                    </Link>
                    <Link
                      href="/app"
                      className="block px-4 py-2.5 text-sm text-slate-200 hover:bg-slate-800 hover:text-white"
                      onClick={() => setMenuOpen(false)}
                    >
                      สรุปชาร์จ
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
