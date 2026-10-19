export type HeaderUsageInfo = {
  plan: string;
  summaryUsedToday: number | null;
  summaryDailyLimit: number | null;
  nextDailyResetAt: string | null;
  periodAllowancePercentUsed: number | null;
  periodAllowanceResetAt: string | null;
  usagePolicyKnown: boolean;
  periodAllowanceReached: boolean;
  extraCredits: number;
  subscriptionStatus: string | null;
};

type UsagePayload = Record<string, unknown>;

function numberOrNull(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function stringOrNull(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

export function mapHeaderUsage(payload: UsagePayload, fallbackPlan = "trial"): HeaderUsageInfo {
  return {
    plan: stringOrNull(payload.plan) ?? fallbackPlan,
    summaryUsedToday: numberOrNull(payload.summaryUsedToday),
    summaryDailyLimit: numberOrNull(payload.summaryDailyLimit),
    nextDailyResetAt: stringOrNull(payload.nextDailyResetAt),
    periodAllowancePercentUsed: numberOrNull(payload.periodAllowancePercentUsed),
    periodAllowanceResetAt: stringOrNull(payload.periodAllowanceResetAt),
    usagePolicyKnown: payload.usagePolicyKnown === true,
    periodAllowanceReached: payload.periodAllowanceReached === true,
    extraCredits: numberOrNull(payload.extraCredits) ?? 0,
    subscriptionStatus: stringOrNull(payload.subscriptionStatus),
  };
}

export async function fetchHeaderUsage(
  fallbackPlan = "trial",
  fetcher: typeof fetch = fetch,
): Promise<HeaderUsageInfo> {
  const response = await fetcher("/api/usage", { cache: "no-store" });
  const payload = await response.json() as UsagePayload & { ok?: boolean; error?: string };
  if (!response.ok || payload.ok !== true) throw new Error(payload.error || "โหลดข้อมูลการใช้งานไม่สำเร็จ");
  return mapHeaderUsage(payload, fallbackPlan);
}

function formatBangkokDate(value: string | null): string {
  if (!value) return "ไม่ทราบเวลา";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "ไม่ทราบเวลา";
  return date.toLocaleString("th-TH", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Bangkok",
  });
}

export function getHeaderUsageRows(usage: HeaderUsageInfo | null) {
  const daily = usage?.summaryUsedToday != null && usage.summaryDailyLimit != null
    ? `${usage.summaryUsedToday}/${usage.summaryDailyLimit} เคส · รีเซ็ต ${formatBangkokDate(usage.nextDailyResetAt)}`
    : "ไม่พร้อมแสดงข้อมูล";

  const period = usage?.usagePolicyKnown && usage.periodAllowancePercentUsed != null
    ? `ใช้ไป ${Math.max(0, Math.min(100, usage.periodAllowancePercentUsed))}% · รีเซ็ต ${formatBangkokDate(usage.periodAllowanceResetAt)}`
    : "ไม่พร้อมแสดงข้อมูล";

  const rows = [
    { label: "โควตารายวัน", value: daily },
    { label: "วงเงิน AI รอบแพ็กเกจ", value: period },
  ];
  if (usage) {
    const active = usage.subscriptionStatus === "active" || usage.subscriptionStatus === "pending_change";
    rows.push({
      label: "Boost",
      value: `${usage.extraCredits} สิทธิ์${usage.extraCredits > 0 && !active ? " · ใช้ได้เมื่อแพ็กเกจ active" : ""}`,
    });
  }
  return rows;
}
