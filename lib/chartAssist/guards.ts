import type { Session } from "next-auth";

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
