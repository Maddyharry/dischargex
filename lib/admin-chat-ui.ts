export function shouldAutoScrollToLatest(force: boolean, isNearBottom: boolean): boolean {
  return force || isNearBottom;
}

export function formatAdminChatTimestamp(value: string | Date): string {
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime())) return "เวลาไม่ถูกต้อง";
  return new Intl.DateTimeFormat("th-TH", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Bangkok",
  }).format(date);
}

export function isChatScrollNearBottom(element: Pick<HTMLElement, "scrollHeight" | "scrollTop" | "clientHeight">, threshold = 80) {
  return element.scrollHeight - element.scrollTop - element.clientHeight <= threshold;
}
