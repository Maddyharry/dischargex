import { describe, expect, it, vi } from "vitest";
const TEST_GA_ID = vi.hoisted(() => {
  const id = "G-TESTDISCHARGEX";
  process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID = id;
  return id;
});
import { ANALYTICS_CONSENT_STORAGE_KEY, parseAnalyticsConsent, persistAnalyticsConsent, serializeAnalyticsConsent } from "@/lib/analytics-consent";
import {
  appendPendingSafeAnalyticsEvent,
  normalizePendingSafeAnalyticsEvents,
  normalizeSafeAnalyticsPayload,
  shouldTrackDemoCompleted,
  shouldTrackDemoStarted,
} from "@/lib/analytics-events";
import { claimFirstCaseAnalyticsToken } from "@/lib/first-case-analytics";
import { getDedupedWebAnalyticsRecordId } from "@/lib/analytics-server";
import { buildSafeGoogleEventParameters, clearPendingSafeAnalyticsEvents, flushPendingSafeAnalyticsEvents, trackSafeAnalyticsEvent } from "@/lib/safe-analytics-client";
import { isGoogleTagConsentReady, markGoogleTagConsentReady } from "@/app/components/GoogleTag";

function createStorageStub(values: Map<string, string>): Storage {
  return {
    get length() {
      return values.size;
    },
    clear: () => values.clear(),
    getItem: (key: string) => values.get(key) ?? null,
    key: (index: number) => Array.from(values.keys())[index] ?? null,
    removeItem: (key: string) => { values.delete(key); },
    setItem: (key: string, value: string) => { values.set(key, value); },
  };
}

describe("analytics consent persistence", () => {
  it("stores independent optional purposes and rejects malformed values", () => {
    const saved = JSON.parse(serializeAnalyticsConsent({ analytics: true, marketing: false }, new Date("2026-10-22T00:00:00.000Z")));
    expect(parseAnalyticsConsent(saved)).toEqual({
      analytics: true,
      marketing: false,
      savedAt: "2026-10-22T00:00:00.000Z",
    });
    expect(parseAnalyticsConsent({ analytics: "yes", marketing: false, savedAt: "now" })).toBeNull();
    expect(parseAnalyticsConsent(null)).toBeNull();
  });
});

describe("safe analytics event allowlist", () => {
  it.each(["sign_up", "pricing_viewed"]) ("accepts metadata-free %s events", (event) => {
    expect(normalizeSafeAnalyticsPayload({ event })).toEqual({ event });
  });

  it("accepts only a fixed checkout plan identifier", () => {
    expect(normalizeSafeAnalyticsPayload({ event: "begin_checkout", metadata: { plan: "pro_monthly" } })).toEqual({
      event: "begin_checkout",
      metadata: { plan: "pro_monthly" },
    });
  });

  it.each(["demo_started", "demo_completed"]) ("accepts a safe dedupe token for %s", (event) => {
    expect(normalizeSafeAnalyticsPayload({ event, metadata: { event_id: "1234567890abcdef1234567890abcdef" } })).toEqual({
      event,
      metadata: { event_id: "1234567890abcdef1234567890abcdef" },
    });
  });

  it("accepts a one-time first case event only with an opaque token", () => {
    expect(normalizeSafeAnalyticsPayload({ event: "first_case_completed", metadata: { event_id: "abcdef1234567890abcdef1234567890" } })).not.toBeNull();
    expect(normalizeSafeAnalyticsPayload({ event: "first_case_completed", metadata: { event_id: "kmsakao@gmail.com" } })).toBeNull();
  });

  it("accepts a purchase only with a stable Stripe ID and verified THB value schema", () => {
    expect(normalizeSafeAnalyticsPayload({
      event: "purchase",
      metadata: { transaction_id: "cs_live_1234567890abcdef", value: 1090, currency: "THB" },
    })).toEqual({ event: "purchase", metadata: { transaction_id: "cs_live_1234567890abcdef", value: 1090, currency: "THB" } });
  });

  it.each([
    { event: "sign_up", metadata: { email: "patient@example.test" } },
    { event: "begin_checkout", metadata: { plan: "pro_monthly", text: "free text" } },
    { event: "begin_checkout", metadata: { plan: "/pricing?secret=yes" } },
    { event: "page_view", path: "/app/profile" },
    { event: "pricing_viewed", content: "patient data" },
    { event: "demo_started", metadata: { event_id: "1234567890abcdef", diagnosis: "free text" } },
    { event: "first_case_completed", metadata: { event_id: "patient-HN-1234567890" } },
    { event: "purchase", metadata: { transaction_id: "cs_live_1234567890abcdef", value: 1090, currency: "THB", email: "private@example.test" } },
    { event: "purchase", metadata: { transaction_id: "cs_live_1234567890abcdef", value: "1090", currency: "THB" } },
    { event: "purchase", metadata: { transaction_id: "patient-1234567890", value: 1090, currency: "THB" } },
  ])("rejects unsafe event payload %#", (payload) => {
    expect(normalizeSafeAnalyticsPayload(payload)).toBeNull();
  });
});

describe("safe analytics handoff and tutorial boundaries", () => {
  const queued = {
    key: "demo_started:1234567890abcdef1234567890abcdef",
    payload: { event: "demo_started", metadata: { event_id: "1234567890abcdef1234567890abcdef" } },
  } as const;

  it("queues only validated payloads and deduplicates a repeated handoff", () => {
    const first = appendPendingSafeAnalyticsEvent([], queued);
    const second = appendPendingSafeAnalyticsEvent(first, queued);
    expect(first).toHaveLength(1);
    expect(second).toEqual(first);
    expect(normalizePendingSafeAnalyticsEvents([{ ...queued, payload: { ...queued.payload, patient: "text" } }])).toEqual([]);
    expect(normalizePendingSafeAnalyticsEvents([{ ...queued, key: "demo_started:/app/profile?hn=123" }])).toEqual([]);
  });

  it("counts tutorial start only after the guest flow actually opens", () => {
    expect(shouldTrackDemoStarted({ guest: true, mobileFlow: false, popupOpened: false })).toBe(false);
    expect(shouldTrackDemoStarted({ guest: false, mobileFlow: true, popupOpened: false })).toBe(false);
    expect(shouldTrackDemoStarted({ guest: true, mobileFlow: true, popupOpened: false })).toBe(true);
    expect(shouldTrackDemoStarted({ guest: true, mobileFlow: false, popupOpened: true })).toBe(true);
  });

  it("counts completion only when a guest mock result is ready", () => {
    expect(shouldTrackDemoCompleted({ guest: true, mockResultReady: false })).toBe(false);
    expect(shouldTrackDemoCompleted({ guest: false, mockResultReady: true })).toBe(false);
    expect(shouldTrackDemoCompleted({ guest: true, mockResultReady: true })).toBe(true);
  });
});

describe("Google event privacy parameters", () => {
  it.each([
    { event: "sign_up" },
    { event: "pricing_viewed" },
    { event: "begin_checkout", metadata: { plan: "pro_monthly" } },
    { event: "demo_started", metadata: { event_id: "1234567890abcdef1234567890abcdef" } },
  ] as const)("overrides page context for $event", (payload) => {
    const result = buildSafeGoogleEventParameters(payload, `${payload.event}:opaque-key`, "/pricing?email=a@example.test#case", "https://dischargex.example/?token=secret");
    expect(result.send_to).toBe(TEST_GA_ID);
    expect(result.page_location).toBe("https://dischargex.example/pricing");
    expect(result.page_referrer).toBe("");
    expect(JSON.stringify(result)).not.toMatch(/example\.test|token=secret|#case/);
  });

  it("adds one generic purchase item priced from the verified value", () => {
    const payload = normalizeSafeAnalyticsPayload({
      event: "purchase",
      metadata: { transaction_id: "cs_live_1234567890abcdef", value: 1090, currency: "THB" },
    })!;
    expect(buildSafeGoogleEventParameters(payload, "purchase:cs_live_1234567890abcdef", "/app/profile?session_id=secret", "https://dischargex.example")).toMatchObject({
      transaction_id: "cs_live_1234567890abcdef",
      value: 1090,
      currency: "THB",
      send_to: TEST_GA_ID,
      items: [{ item_id: "dischargex_purchase", item_name: "DischargeX purchase", price: 1090, quantity: 1 }],
      page_location: "https://dischargex.example/app/profile",
      page_referrer: "",
    });
  });
});

describe("consent revocation queue clearing", () => {
  it("clears the pending queue before saving a changed consent choice", () => {
    const calls: string[] = [];
    const result = persistAnalyticsConsent({
      storage: { setItem: (key, value) => { calls.push(`save:${key}:${value}`); } },
      consent: { analytics: false, marketing: true },
      clearPending: () => { calls.push("clear"); return true; },
      now: new Date("2026-10-22T00:00:00.000Z"),
    });
    expect(result).toBe(true);
    expect(calls[0]).toBe("clear");
    expect(calls[1]).toBe(`save:${ANALYTICS_CONSENT_STORAGE_KEY}:{\"analytics\":false,\"marketing\":true,\"savedAt\":\"2026-10-22T00:00:00.000Z\"}`);
  });

  it("clears only unsent events and preserves the sent-event dedupe history", () => {
    const values = new Map<string, string>([
      ["dx_safe_analytics_pending_v1", JSON.stringify([{ key: "pricing_viewed:123", payload: { event: "pricing_viewed" } }])],
      ["dx_safe_analytics_sent_v1", JSON.stringify(["purchase:cs_live_1234567890abcdef"])],
    ]);
    vi.stubGlobal("window", { localStorage: {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
      removeItem: (key: string) => values.delete(key),
    } });
    expect(clearPendingSafeAnalyticsEvents()).toBe(true);
    expect(values.has("dx_safe_analytics_pending_v1")).toBe(false);
    expect(values.get("dx_safe_analytics_sent_v1")).toBe(JSON.stringify(["purchase:cs_live_1234567890abcdef"]));
    vi.unstubAllGlobals();
  });
});

describe("analytics dispatch resilience", () => {
  const acceptedConsent = JSON.stringify({ analytics: true, marketing: false, savedAt: "2026-10-22T00:00:00.000Z" });

  it("keeps queued events until GoogleTag applies consent for the public route", () => {
    const values = new Map<string, string>([[ANALYTICS_CONSENT_STORAGE_KEY, acceptedConsent]]);
    const calls: unknown[][] = [];
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
      removeItem: (key: string) => values.delete(key),
    };
    vi.stubGlobal("navigator", { sendBeacon: vi.fn(() => true) });

    vi.stubGlobal("window", {
      localStorage: storage,
      sessionStorage: storage,
      location: { pathname: "/app/profile", origin: "https://dischargex.example" },
      dispatchEvent: vi.fn(),
    });
    expect(trackSafeAnalyticsEvent("pricing_viewed")).toBe(true);
    expect(JSON.parse(values.get("dx_safe_analytics_pending_v1") || "[]")).toHaveLength(1);
    expect(values.has("dx_safe_analytics_sent_v1")).toBe(false);

    (window as Window).gtag = (...args: unknown[]) => { calls.push(args); };
    Object.defineProperty(window, "location", {
      configurable: true,
      value: { pathname: "/pricing", origin: "https://dischargex.example" },
    });
    flushPendingSafeAnalyticsEvents();
    expect(calls).toHaveLength(0);
    expect(JSON.parse(values.get("dx_safe_analytics_pending_v1") || "[]")).toHaveLength(1);
    expect(isGoogleTagConsentReady("/pricing")).toBe(false);

    markGoogleTagConsentReady("/pricing", {
      analytics: true,
      marketing: false,
      savedAt: "2026-10-22T00:00:00.000Z",
    });
    expect(isGoogleTagConsentReady("/pricing")).toBe(true);
    flushPendingSafeAnalyticsEvents();
    expect(calls).toHaveLength(1);
    expect(calls[0][1]).toBe("pricing_viewed");
    const sentKeys = JSON.parse(values.get("dx_safe_analytics_sent_v1") || "[]");
    expect(sentKeys).toHaveLength(1);
    expect(sentKeys[0]).toMatch(/^pricing_viewed:[a-f0-9]{32}$/);
    expect(JSON.parse(values.get("dx_safe_analytics_pending_v1") || "[]")).toEqual([]);
    vi.unstubAllGlobals();
  });

  it("keeps the pricing event key stable for tag retries in one session and changes it in a new session", () => {
    const localValues = new Map<string, string>([[ANALYTICS_CONSENT_STORAGE_KEY, acceptedConsent]]);
    const firstSession = new Map<string, string>();
    const storage = createStorageStub;
    const localStorage = storage(localValues);
    const pendingKeys = () => JSON.parse(localValues.get("dx_safe_analytics_pending_v1") || "[]").map((entry: { key: string }) => entry.key);
    vi.stubGlobal("window", {
      localStorage,
      sessionStorage: storage(firstSession),
      location: { pathname: "/pricing", origin: "https://dischargex.example" },
    });
    vi.stubGlobal("navigator", { sendBeacon: vi.fn(() => true) });

    expect(trackSafeAnalyticsEvent("pricing_viewed")).toBe(false);
    const firstKey = pendingKeys()[0];
    expect(trackSafeAnalyticsEvent("pricing_viewed")).toBe(true);
    expect(pendingKeys()).toEqual([firstKey]);
    expect(firstKey).toMatch(/^pricing_viewed:[a-f0-9]{32}$/);

    localStorage.removeItem("dx_safe_analytics_pending_v1");
    Object.defineProperty(window, "sessionStorage", {
      configurable: true,
      value: storage(new Map<string, string>()),
    });
    expect(trackSafeAnalyticsEvent("pricing_viewed")).toBe(false);
    const secondKey = pendingKeys()[0];
    expect(secondKey).toMatch(/^pricing_viewed:[a-f0-9]{32}$/);
    expect(secondKey).not.toBe(firstKey);
    vi.unstubAllGlobals();
  });

  it("contains localStorage write and remove exceptions without throwing", () => {
    const storage = {
      getItem: (key: string) => key === ANALYTICS_CONSENT_STORAGE_KEY ? acceptedConsent : null,
      setItem: () => { throw new Error("storage unavailable"); },
      removeItem: () => { throw new Error("storage unavailable"); },
    };
    vi.stubGlobal("window", {
      localStorage: storage,
      sessionStorage: storage,
      location: { pathname: "/pricing", origin: "https://dischargex.example" },
      dispatchEvent: vi.fn(),
    });
    vi.stubGlobal("navigator", { sendBeacon: vi.fn(() => true) });

    expect(() => trackSafeAnalyticsEvent("pricing_viewed")).not.toThrow();
    expect(trackSafeAnalyticsEvent("pricing_viewed")).toBe(false);
    expect(clearPendingSafeAnalyticsEvents()).toBe(false);

    const calls: unknown[][] = [];
    (window as Window).gtag = (...args: unknown[]) => { calls.push(args); };
    markGoogleTagConsentReady("/pricing", {
      analytics: true,
      marketing: false,
      savedAt: "2026-10-22T00:00:00.000Z",
    });
    expect(() => trackSafeAnalyticsEvent("pricing_viewed")).not.toThrow();
    expect(calls).toHaveLength(1);
    vi.unstubAllGlobals();
  });
});

describe("internal telemetry deduplication", () => {
  it("uses a deterministic opaque row id for the same purchase transaction", () => {
    const event = normalizeSafeAnalyticsPayload({
      event: "purchase",
      metadata: { transaction_id: "cs_live_1234567890abcdef", value: 1090, currency: "THB" },
    });
    expect(event).not.toBeNull();
    expect(getDedupedWebAnalyticsRecordId(event!)).toBe(getDedupedWebAnalyticsRecordId(event!));
    expect(getDedupedWebAnalyticsRecordId(event!)).toMatch(/^web_[a-f0-9]{64}$/);
  });
});

describe("first committed Generate marker", () => {
  it("does not mark a user with an earlier successful Generate", async () => {
    const insert = vi.fn(async () => true);
    await expect(claimFirstCaseAnalyticsToken({ totalGenerationsBeforeCommit: 4, insertUniqueMarker: insert })).resolves.toBeNull();
    expect(insert).not.toHaveBeenCalled();
  });

  it("uses a legacy lifetime count even when historical UsageLog evidence is absent", async () => {
    const insert = vi.fn(async () => true);
    await expect(claimFirstCaseAnalyticsToken({ totalGenerationsBeforeCommit: 2, insertUniqueMarker: insert })).resolves.toBeNull();
    expect(insert).not.toHaveBeenCalled();
  });

  it("returns an opaque token only to the unique marker winner", async () => {
    const token = await claimFirstCaseAnalyticsToken({ totalGenerationsBeforeCommit: 0, insertUniqueMarker: async (value) => value.length === 32 });
    expect(token).toMatch(/^[a-f0-9]{32}$/);
    await expect(claimFirstCaseAnalyticsToken({ totalGenerationsBeforeCommit: 0, insertUniqueMarker: async () => false })).resolves.toBeNull();
  });
});
