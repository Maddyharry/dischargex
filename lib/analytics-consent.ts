export const ANALYTICS_CONSENT_STORAGE_KEY = "dx_analytics_consent_v1";

export type AnalyticsConsent = {
  analytics: boolean;
  marketing: boolean;
  savedAt: string;
};

export function parseAnalyticsConsent(value: unknown): AnalyticsConsent | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  if (typeof record.analytics !== "boolean" || typeof record.marketing !== "boolean") return null;
  if (typeof record.savedAt !== "string" || !/^\d{4}-\d{2}-\d{2}T/.test(record.savedAt)) return null;
  return { analytics: record.analytics, marketing: record.marketing, savedAt: record.savedAt };
}

export function serializeAnalyticsConsent(consent: Pick<AnalyticsConsent, "analytics" | "marketing">, now = new Date()): string {
  return JSON.stringify({ analytics: consent.analytics, marketing: consent.marketing, savedAt: now.toISOString() });
}

export function persistAnalyticsConsent(input: {
  storage: Pick<Storage, "setItem">;
  consent: Pick<AnalyticsConsent, "analytics" | "marketing">;
  clearPending: () => boolean;
  now?: Date;
}): boolean {
  try {
    if (!input.clearPending()) return false;
    input.storage.setItem(ANALYTICS_CONSENT_STORAGE_KEY, serializeAnalyticsConsent(input.consent, input.now));
    return true;
  } catch {
    return false;
  }
}
