export const SAFE_ANALYTICS_EVENTS = [
  "sign_up", "pricing_viewed", "begin_checkout", "demo_started", "demo_completed",
  "first_case_completed", "purchase",
] as const;

export type SafeAnalyticsEvent = (typeof SAFE_ANALYTICS_EVENTS)[number];
export type CheckoutPlan =
  | "basic_monthly"
  | "basic_yearly"
  | "standard_monthly"
  | "standard_yearly"
  | "pro_monthly"
  | "pro_yearly";

export type SafeAnalyticsMetadata =
  | { plan: CheckoutPlan }
  | { event_id: string }
  | { transaction_id: string; value: number; currency: "THB" };
export type SafeAnalyticsPayload = { event: SafeAnalyticsEvent; metadata?: SafeAnalyticsMetadata };

const SAFE_EVENT_ID = /^[a-f0-9]{32}$/i;
const SAFE_TRANSACTION_ID = /^cs_(?:test|live)_[A-Za-z0-9]{16,96}$/;

export type PendingSafeAnalyticsEvent = { key: string; payload: SafeAnalyticsPayload };

export function shouldTrackDemoStarted(input: { guest: boolean; mobileFlow: boolean; popupOpened: boolean }): boolean {
  return input.guest && (input.mobileFlow || input.popupOpened);
}

export function shouldTrackDemoCompleted(input: { guest: boolean; mockResultReady: boolean }): boolean {
  return input.guest && input.mockResultReady;
}

export function getSafeAnalyticsDedupeKey(payload: SafeAnalyticsPayload): string | null {
  const metadata = payload.metadata;
  if (metadata && "event_id" in metadata) return `${payload.event}:${metadata.event_id}`;
  if (metadata && "transaction_id" in metadata) return `${payload.event}:${metadata.transaction_id}`;
  return null;
}

export function normalizePendingSafeAnalyticsEvents(input: unknown): PendingSafeAnalyticsEvent[] {
  if (!Array.isArray(input)) return [];
  return input.flatMap((item): PendingSafeAnalyticsEvent[] => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return [];
    const record = item as Record<string, unknown>;
    if (Object.keys(record).length !== 2 || typeof record.key !== "string") return [];
    const payload = normalizeSafeAnalyticsPayload(record.payload);
    if (!payload) return [];
    const stableKey = getSafeAnalyticsDedupeKey(payload);
    const localOpaqueKey = !stableKey && new RegExp(`^${payload.event}:[A-Za-z0-9_-]{16,80}$`).test(record.key);
    if (stableKey !== record.key && !localOpaqueKey) return [];
    return [{ key: record.key, payload }];
  }).slice(-100);
}

export function appendPendingSafeAnalyticsEvent(
  existing: unknown,
  entry: PendingSafeAnalyticsEvent,
): PendingSafeAnalyticsEvent[] {
  const current = normalizePendingSafeAnalyticsEvents(existing);
  return current.some((item) => item.key === entry.key) ? current : [...current, entry].slice(-100);
}

const CHECKOUT_PLANS = new Set<CheckoutPlan>([
  "basic_monthly", "basic_yearly", "standard_monthly", "standard_yearly", "pro_monthly", "pro_yearly",
]);

export function normalizeSafeAnalyticsPayload(input: unknown): SafeAnalyticsPayload | null {
  if (!input || typeof input !== "object" || Array.isArray(input)) return null;
  const record = input as Record<string, unknown>;
  if (Object.keys(record).some((key) => key !== "event" && key !== "metadata")) return null;
  if (typeof record.event !== "string" || !SAFE_ANALYTICS_EVENTS.includes(record.event as SafeAnalyticsEvent)) return null;
  const event = record.event as SafeAnalyticsEvent;
  if (["sign_up", "pricing_viewed"].includes(event)) return record.metadata === undefined ? { event } : null;
  if (["demo_started", "demo_completed", "first_case_completed"].includes(event)) {
    if (record.metadata === undefined) return { event };
    if (!record.metadata || typeof record.metadata !== "object" || Array.isArray(record.metadata)) return null;
    const metadata = record.metadata as Record<string, unknown>;
    if (Object.keys(metadata).length !== 1 || Object.keys(metadata)[0] !== "event_id") return null;
    if (typeof metadata.event_id !== "string" || !SAFE_EVENT_ID.test(metadata.event_id)) return null;
    return { event, metadata: { event_id: metadata.event_id } };
  }
  if (event === "purchase") {
    if (!record.metadata || typeof record.metadata !== "object" || Array.isArray(record.metadata)) return null;
    const metadata = record.metadata as Record<string, unknown>;
    if (Object.keys(metadata).length !== 3 ||
        !["transaction_id", "value", "currency"].every((key) => Object.prototype.hasOwnProperty.call(metadata, key))) return null;
    if (typeof metadata.transaction_id !== "string" || !SAFE_TRANSACTION_ID.test(metadata.transaction_id) ||
        typeof metadata.value !== "number" || !Number.isFinite(metadata.value) || metadata.value <= 0 ||
        metadata.currency !== "THB") return null;
    return { event, metadata: { transaction_id: metadata.transaction_id, value: metadata.value, currency: "THB" } };
  }
  if (event !== "begin_checkout") return null;
  if (!record.metadata || typeof record.metadata !== "object" || Array.isArray(record.metadata)) return null;
  const metadata = record.metadata as Record<string, unknown>;
  if (Object.keys(metadata).length !== 1 || Object.keys(metadata)[0] !== "plan") return null;
  if (typeof metadata.plan !== "string" || !CHECKOUT_PLANS.has(metadata.plan as CheckoutPlan)) return null;
  return { event, metadata: { plan: metadata.plan as CheckoutPlan } };
}
