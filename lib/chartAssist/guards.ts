import type { Session } from "next-auth";

/**
 * Chart Assist Lab (admin experimental V1) — **exact** env match only.
 * Not exposed to the browser (no NEXT_PUBLIC_).
 */
export function isChartAssistLabEnabled(): boolean {
  return process.env.EXPERIMENTAL_CHART_ASSIST === "true";
}

/**
 * OPD Assist Lab — เปิดเป็นค่าเริ่มต้น
 * ปิดได้โดยตั้ง `EXPERIMENTAL_OPD_ASSIST=false` หรือ `EXPERIMENTAL_CHART_ASSIST=false`
 */
export function isOpdAssistEnabled(): boolean {
  if (
    process.env.EXPERIMENTAL_OPD_ASSIST === "false" ||
    process.env.EXPERIMENTAL_CHART_ASSIST === "false"
  ) {
    return false;
  }
  return true;
}

export function isAdminSession(session: Session | null): boolean {
  return (session as { user?: { role?: string } } | null)?.user?.role === "admin";
}

/** Chart Assist Lab: admin + flag. API should return 403 if false. */
export function assertChartAssistLabAccess(session: Session | null): "ok" | "forbidden" | "disabled" {
  if (!isAdminSession(session)) return "forbidden";
  if (!isChartAssistLabEnabled()) return "disabled";
  return "ok";
}
