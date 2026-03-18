/**
 * รอบบิลนับจากวันเริ่มต้น (วันสมัครหรือวันต่ออายุ)
 * - แผนรายเดือน (trial, basic, standard, pro): 30 วัน
 * - Pro รายปี (pro_yearly): 365 วัน
 */

const DAY_MS = 24 * 60 * 60 * 1000;
const THIRTY_DAYS_MS = 30 * DAY_MS;
const YEAR_DAYS_MS = 365 * DAY_MS;

export function getPeriodBounds(periodStart: Date, plan?: string): { start: Date; end: Date } {
  const start = new Date(periodStart.getTime());
  const lengthMs = plan === "pro_yearly" ? YEAR_DAYS_MS : THIRTY_DAYS_MS;
  const end = new Date(start.getTime() + lengthMs);
  return { start, end };
}

/** เหลืออีกกี่วันจนถึงสิ้นรอบ (อย่างน้อย 0) */
export function daysLeftInPeriod(periodEnd: Date, now: Date): number {
  const nowMs = now.getTime();
  const endMs = periodEnd.getTime();
  if (nowMs >= endMs) return 0;
  return Math.ceil((endMs - nowMs) / (24 * 60 * 60 * 1000));
}
