"use client";

import { ANALYTICS_CONSENT_STORAGE_KEY, parseAnalyticsConsent } from "./analytics-consent";
import {
  normalizeSafeAnalyticsPayload,
  appendPendingSafeAnalyticsEvent,
  normalizePendingSafeAnalyticsEvents,
  type CheckoutPlan,
  type SafeAnalyticsEvent,
  type SafeAnalyticsMetadata,
  type SafeAnalyticsPayload,
} from "./analytics-events";
import { isSensitiveAnalyticsPath, sanitizeAnalyticsLocation } from "@/app/components/GoogleTag";

const GA_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID?.trim() || "";
const ADS_ID = process.env.NEXT_PUBLIC_GOOGLE_ADS_ID?.trim() || "";
const ADS_BEGIN_CHECKOUT_LABEL = process.env.NEXT_PUBLIC_GOOGLE_ADS_BEGIN_CHECKOUT_LABEL?.trim() || "";
const ADS_PURCHASE_LABEL = process.env.NEXT_PUBLIC_GOOGLE_ADS_PURCHASE_LABEL?.trim() || "";
const PENDING_KEY = "dx_safe_analytics_pending_v1";
const SENT_KEY = "dx_safe_analytics_sent_v1";

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
  }
}

type PendingEvent = { key: string; payload: SafeAnalyticsPayload };

function readConsent() {
  try {
    return parseAnalyticsConsent(JSON.parse(window.localStorage.getItem(ANALYTICS_CONSENT_STORAGE_KEY) || "null"));
  } catch {
    return null;
  }
}

function makeOpaqueEventId(): string {
  try { return crypto.randomUUID().replaceAll("-", ""); } catch {
    return Array.from({ length: 4 }, () => Math.floor(Math.random() * 0x1_0000_0000).toString(16).padStart(8, "0")).join("");
  }
}

function eventKey(payload: SafeAnalyticsPayload): string {
  const metadata = payload.metadata;
  if (metadata && "transaction_id" in metadata) return `${payload.event}:${metadata.transaction_id}`;
  if (metadata && "event_id" in metadata) return `${payload.event}:${metadata.event_id}`;
  // Pricing is once per session in its caller. Keep retries deduplicated while
  // its first dispatch is waiting for the Google tag to load.
  if (payload.event === "pricing_viewed") return "pricing_viewed:0000000000000000";
  return `${payload.event}:${makeOpaqueEventId()}`;
}

function tutorialEventId(event: "demo_started" | "demo_completed"): string {
  const key = `dx_analytics_${event}_id_v1`;
  try {
    const existing = window.sessionStorage.getItem(key);
    if (existing) return existing;
    const created = makeOpaqueEventId();
    window.sessionStorage.setItem(key, created);
    return created;
  } catch { return makeOpaqueEventId(); }
}

function readEntries(key: string): string[] {
  try {
    const value = JSON.parse(window.localStorage.getItem(key) || "[]");
    return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string").slice(-200) : [];
  } catch { return []; }
}

function hasBeenSent(key: string): boolean { return readEntries(SENT_KEY).includes(key); }
function markSent(key: string) {
  try {
    const entries = readEntries(SENT_KEY);
    if (!entries.includes(key)) window.localStorage.setItem(SENT_KEY, JSON.stringify([...entries, key].slice(-200)));
  } catch { /* Storage is optional; never interrupt an application flow. */ }
}

function readPending(): PendingEvent[] {
  try {
    const value: unknown = JSON.parse(window.localStorage.getItem(PENDING_KEY) || "[]");
    return normalizePendingSafeAnalyticsEvents(value);
  } catch { return []; }
}

export function buildSafeGoogleEventParameters(
  payload: SafeAnalyticsPayload,
  key: string,
  pathname: string,
  origin: string,
): Record<string, unknown> {
  const metadata = payload.metadata ? { ...payload.metadata } : {};
  const metadataRecord = metadata as Record<string, unknown>;
  const parameters: Record<string, unknown> = {
    ...metadataRecord,
    send_to: GA_ID,
    event_id: typeof metadataRecord.event_id === "string" ? metadataRecord.event_id : key,
    page_location: sanitizeAnalyticsLocation(pathname, origin),
    page_referrer: "",
  };
  if (payload.event === "purchase" && typeof metadataRecord.value === "number") {
    parameters.items = [{
      item_id: "dischargex_purchase",
      item_name: "DischargeX purchase",
      price: metadataRecord.value,
      quantity: 1,
    }];
  }
  return parameters;
}

export function clearPendingSafeAnalyticsEvents(): boolean {
  if (typeof window === "undefined") return false;
  try {
    window.localStorage.removeItem(PENDING_KEY);
    return true;
  } catch { return false; }
}

function queueForPublicRoute(entry: PendingEvent) {
  try {
    const current: unknown = readPending();
    window.localStorage.setItem(PENDING_KEY, JSON.stringify(appendPendingSafeAnalyticsEvent(current, entry)));
  } catch { /* Queue persistence is best effort. */ }
}

function sendInternal(payload: SafeAnalyticsPayload) {
  const body = JSON.stringify(payload);
  try {
    if (navigator.sendBeacon) navigator.sendBeacon("/api/telemetry/web", new Blob([body], { type: "application/json" }));
    else void fetch("/api/telemetry/web", { method: "POST", headers: { "Content-Type": "application/json" }, body, keepalive: true });
  } catch { /* Analytics must never interfere with the user action. */ }
}

function sendGoogle(payload: SafeAnalyticsPayload, key: string): boolean {
  if (typeof window.gtag !== "function") return false;
  const metadataRecord = (payload.metadata ?? {}) as Record<string, unknown>;
  const safePageContext = {
    page_location: sanitizeAnalyticsLocation(window.location.pathname, window.location.origin),
    page_referrer: "",
  };
  const consent = readConsent();
  let sent = false;
  if (consent?.analytics && GA_ID) {
    window.gtag("event", payload.event, buildSafeGoogleEventParameters(payload, key, window.location.pathname, window.location.origin));
    sent = true;
  }
  if (payload.event === "begin_checkout" && consent?.marketing && ADS_ID && ADS_BEGIN_CHECKOUT_LABEL) {
    window.gtag("event", "conversion", { send_to: `${ADS_ID}/${ADS_BEGIN_CHECKOUT_LABEL}`, ...safePageContext });
    sent = true;
  }
  if (payload.event === "purchase" && consent?.marketing && ADS_ID && ADS_PURCHASE_LABEL && typeof metadataRecord.transaction_id === "string") {
    window.gtag("event", "conversion", {
      send_to: `${ADS_ID}/${ADS_PURCHASE_LABEL}`,
      transaction_id: metadataRecord.transaction_id,
      value: metadataRecord.value,
      currency: "THB",
      ...safePageContext,
    });
    sent = true;
  }
  if (!sent) return false;
  markSent(key);
  return true;
}

export function trackSafeAnalyticsEvent(
  event: SafeAnalyticsEvent,
  planOrMetadata?: CheckoutPlan | SafeAnalyticsMetadata,
): boolean {
  if (typeof window === "undefined") return false;
  const metadata = typeof planOrMetadata === "string"
    ? { plan: planOrMetadata }
    : planOrMetadata;
  const withEventId = ["demo_started", "demo_completed"].includes(event) && metadata === undefined
    ? { event_id: tutorialEventId(event as "demo_started" | "demo_completed") }
    : metadata;
  const payload = normalizeSafeAnalyticsPayload({ event, ...(withEventId ? { metadata: withEventId } : {}) });
  const consent = readConsent();
  if (!payload || !consent || (!consent.analytics && !consent.marketing)) return false;
  const adsConversionAvailable = consent.marketing && Boolean(ADS_ID) && (
    (event === "begin_checkout" && Boolean(ADS_BEGIN_CHECKOUT_LABEL)) ||
    (event === "purchase" && Boolean(ADS_PURCHASE_LABEL))
  );
  if (!consent.analytics && !adsConversionAvailable) return false;

  const key = eventKey(payload);
  if (hasBeenSent(key) || readPending().some((item) => item.key === key)) return true;
  if (consent.analytics) sendInternal(payload);

  if (isSensitiveAnalyticsPath(window.location.pathname)) {
    queueForPublicRoute({ key, payload });
    return true;
  } else {
    if (typeof window.gtag !== "function") {
      queueForPublicRoute({ key, payload });
      return false;
    }
    if (!sendGoogle(payload, key)) return false;
  }
  return true;
}

export function flushPendingSafeAnalyticsEvents(): void {
  if (typeof window === "undefined" || isSensitiveAnalyticsPath(window.location.pathname)) return;
  const consent = readConsent();
  if (!consent || (!consent.analytics && !consent.marketing) || typeof window.gtag !== "function") return;
  const remaining: PendingEvent[] = [];
  for (const entry of readPending()) {
    if (hasBeenSent(entry.key)) continue;
    if (!sendGoogle(entry.payload, entry.key)) remaining.push(entry);
  }
  try { window.localStorage.setItem(PENDING_KEY, JSON.stringify(remaining)); } catch { /* best effort */ }
}
