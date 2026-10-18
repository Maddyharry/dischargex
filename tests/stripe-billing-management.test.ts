import { beforeEach, describe, expect, it, vi } from "vitest";
import type Stripe from "stripe";

type MockSubscription = {
  id: string;
  customer: string;
  status: string;
  cancel_at_period_end: boolean;
  collection_method: string;
  automatic_tax: { enabled: boolean };
  default_tax_rates: unknown[];
  discounts: unknown[];
  application_fee_percent: number | null;
  transfer_data: unknown;
  billing_thresholds: unknown;
  pending_update: unknown;
  pause_collection: unknown;
  items: { data: Array<{ current_period_start: number; current_period_end: number; price: string; quantity: number; tax_rates: unknown[] }> };
  schedule: string | null;
};
type MockSchedule = {
  id: string;
  status: string;
  subscription: string;
  customer: string;
  metadata: Record<string, string>;
  phases: Array<{ start_date: number; end_date?: number | null; items: Array<{ price: string; quantity?: number }>; discounts?: unknown[]; default_tax_rates?: unknown[]; automatic_tax?: { enabled: boolean } }>;
  current_phase?: { start_date: number; end_date: number };
};

const mocks = vi.hoisted(() => ({
  session: { user: { email: "a@example.test" } },
  user: { id: "user-a", email: "a@example.test", stripeCustomerId: "cus-a", stripeSubscriptionId: "sub-a", subscriptionStatus: "pending_change", plan: "basic_monthly", subscriptionExpiresAt: new Date("2030-02-01T00:00:00.000Z") },
  subscription: {} as MockSubscription,
  schedule: {} as MockSchedule,
  release: vi.fn(),
  update: vi.fn(),
  userUpdate: vi.fn(async () => ({})),
  scheduleCreate: vi.fn(),
  scheduleUpdate: vi.fn(),
  priceRetrieve: vi.fn(),
}));

vi.mock("next-auth", () => ({ getServerSession: vi.fn(async () => mocks.session) }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("@/lib/prisma", () => ({ prisma: { user: {
  findUnique: vi.fn(async ({ where }: { where: { email?: string; id?: string } }) => (where.email && where.email === mocks.user.email) || (where.id && where.id === mocks.user.id) ? mocks.user : null),
  update: mocks.userUpdate,
} } }));
vi.mock("@/lib/stripe", () => ({
  getStripePriceMap: () => ({ basic_monthly: "price-current", basic_yearly: "", standard_monthly: "price-target", standard_yearly: "", pro_monthly: "", pro_yearly: "" }),
  getPlanIdByStripePriceId: (priceId: string) => priceId === "price-current" ? "basic_monthly" : priceId === "price-target" ? "standard_monthly" : null,
  getStripe: () => ({
  subscriptions: {
    retrieve: vi.fn(async () => mocks.subscription),
    update: mocks.update,
  },
  prices: { retrieve: mocks.priceRetrieve },
  subscriptionSchedules: {
    retrieve: vi.fn(async () => mocks.schedule),
    release: mocks.release,
    create: mocks.scheduleCreate,
    update: mocks.scheduleUpdate,
  },
}) }));

import { POST } from "../app/api/stripe/cancel-renewal/route";
import { POST as PLAN_CHANGE_POST } from "../app/api/stripe/plan-change/route";
import { getSubscriptionPaidThroughSeconds, getSubscriptionPeriodStartSeconds } from "../lib/stripe-portal";

const START = 1_791_800_610;
const END = 1_794_392_610;

function request(email = "a@example.test") {
  return new Request("https://app.example.test/api/stripe/cancel-renewal", {
    method: "POST",
    headers: { origin: "https://app.example.test", "content-type": "application/json" },
    body: JSON.stringify({ confirm: true, email }),
  });
}

describe("Stripe billing management safety", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.APP_ORIGIN = "https://app.example.test";
    process.env.STRIPE_PRICE_BASIC_MONTHLY = "price-current";
    process.env.STRIPE_PRICE_STANDARD_MONTHLY = "price-target";
    mocks.session = { user: { email: "a@example.test" } };
    mocks.user = { id: "user-a", email: "a@example.test", stripeCustomerId: "cus-a", stripeSubscriptionId: "sub-a", subscriptionStatus: "pending_change", plan: "basic_monthly", subscriptionExpiresAt: new Date(END * 1000) };
    mocks.subscription = {
      id: "sub-a", customer: "cus-a", status: "active", cancel_at_period_end: false,
      collection_method: "charge_automatically", automatic_tax: { enabled: false }, default_tax_rates: [], discounts: [],
      application_fee_percent: null, transfer_data: null, billing_thresholds: null, pending_update: null, pause_collection: null,
      items: { data: [{ current_period_start: START, current_period_end: END, price: "price-current", quantity: 1, tax_rates: [] }] },
      schedule: "sched-a",
    };
    mocks.schedule = {
      id: "sched-a", status: "active", subscription: "sub-a", customer: "cus-a",
      metadata: { dischargexManagedPlanChange: "true", dischargexUserId: "user-a", dischargexSubscriptionId: "sub-a" },
      phases: [
        { start_date: START, end_date: END, items: [{ price: "price-current", quantity: 1 }] },
        { start_date: END, items: [{ price: "price-target", quantity: 1 }] },
      ],
      current_phase: { start_date: START, end_date: END },
    };
    mocks.release.mockResolvedValue({ id: "sched-a", status: "released" });
    mocks.update.mockResolvedValue({
      ...mocks.subscription, cancel_at_period_end: true,
    });
    mocks.priceRetrieve.mockResolvedValue({ active: true, type: "recurring", currency: "thb", unit_amount: 59000, recurring: { interval: "month", interval_count: 1 } });
    mocks.scheduleCreate.mockResolvedValue({
      id: "sched-new", status: "active", subscription: "sub-a", customer: "cus-a", metadata: {},
      phases: [{ start_date: START, items: [{ price: "price-current", quantity: 1 }], discounts: [], default_tax_rates: [] }],
    });
    mocks.scheduleUpdate.mockResolvedValue({
      id: "sched-new", status: "active", subscription: "sub-a", customer: "cus-a", metadata: {},
      phases: [
        { start_date: START, end_date: END, items: [{ price: "price-current", quantity: 1 }] },
        { start_date: END, items: [{ price: "price-target", quantity: 1 }] },
      ],
    });
  });

  it("uses Basil item-level timestamps before legacy root fields", () => {
    const subscription = {
      current_period_start: START - 86_400,
      current_period_end: END - 86_400,
      items: { data: [{ current_period_start: START, current_period_end: END, price: "price" }] },
    } as unknown as Stripe.Subscription;
    expect(getSubscriptionPeriodStartSeconds(subscription)).toBe(START);
    expect(getSubscriptionPaidThroughSeconds(subscription)).toBe(END);
  });

  it("releases only this user's app-managed pending schedule, then cancels at the same paid-through date", async () => {
    const response = await POST(request());
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body).toMatchObject({ ok: true, cancelAtPeriodEnd: true, paidThroughAt: new Date(END * 1000).toISOString() });
    expect(mocks.release).toHaveBeenCalledWith("sched-a", { preserve_cancel_date: true });
    expect(mocks.update).toHaveBeenCalledWith("sub-a", { cancel_at_period_end: true, proration_behavior: "none" });
  });

  it("refuses a schedule owned by another account without releasing or canceling it", async () => {
    mocks.schedule.metadata.dischargexUserId = "user-other";
    const response = await POST(request());
    expect(response.status).toBe(409);
    expect(mocks.release).not.toHaveBeenCalled();
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("uses the authenticated account lookup rather than a body-supplied email", async () => {
    mocks.session = { user: { email: "someone-else@example.test" } };
    const response = await POST(request("a@example.test"));
    expect(response.status).toBe(404);
    expect(mocks.release).not.toHaveBeenCalled();
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("schedules the selected plan only after the current item period, without changing the subscription now", async () => {
    mocks.subscription.schedule = null;
    const response = await PLAN_CHANGE_POST(new Request("https://app.example.test/api/stripe/plan-change", {
      method: "POST", headers: { origin: "https://app.example.test", "content-type": "application/json" },
      body: JSON.stringify({ planId: "standard_monthly" }),
    }));
    expect(response.status, JSON.stringify({ body: await response.json(), priceCalls: mocks.priceRetrieve.mock.calls, createCalls: mocks.scheduleCreate.mock.calls })).toBe(200);
    const scheduleParams = mocks.scheduleUpdate.mock.calls[0]?.[1];
    expect(mocks.scheduleCreate).toHaveBeenCalledWith({ from_subscription: "sub-a" });
    expect(scheduleParams).toMatchObject({
      end_behavior: "release",
      proration_behavior: "none",
      phases: [
        { start_date: START, end_date: END, items: [{ price: "price-current", quantity: 1 }], proration_behavior: "none" },
        { items: [{ price: "price-target", quantity: 1 }], iterations: 1, proration_behavior: "none" },
      ],
    });
    expect(mocks.update).not.toHaveBeenCalled();
    expect(mocks.userUpdate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.not.objectContaining({ plan: "standard_monthly", extraCredits: 0 }),
    }));
  });

  it("does not create a schedule when Stripe customer ownership differs", async () => {
    mocks.subscription.schedule = null;
    mocks.subscription.customer = "cus-other";
    const response = await PLAN_CHANGE_POST(new Request("https://app.example.test/api/stripe/plan-change", {
      method: "POST", headers: { origin: "https://app.example.test", "content-type": "application/json" },
      body: JSON.stringify({ planId: "standard_monthly" }),
    }));
    expect(response.status).toBe(409);
    expect(mocks.scheduleCreate).not.toHaveBeenCalled();
    expect(mocks.scheduleUpdate).not.toHaveBeenCalled();
  });

  it("releases only a newly-created schedule if configuring it fails", async () => {
    mocks.subscription.schedule = null;
    mocks.scheduleUpdate.mockRejectedValue(new Error("mock schedule update failure"));
    const response = await PLAN_CHANGE_POST(new Request("https://app.example.test/api/stripe/plan-change", {
      method: "POST", headers: { origin: "https://app.example.test", "content-type": "application/json" },
      body: JSON.stringify({ planId: "standard_monthly" }),
    }));
    expect(response.status).toBe(503);
    expect(mocks.scheduleCreate).toHaveBeenCalledOnce();
    expect(mocks.release).toHaveBeenCalledWith("sched-new");
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("does not mutate an externally-created schedule", async () => {
    mocks.schedule.metadata = {};
    const response = await POST(request());
    expect(response.status).toBe(409);
    expect(mocks.release).not.toHaveBeenCalled();
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("rejects requests without same-origin proof", async () => {
    const response = await POST(new Request("https://app.example.test/api/stripe/cancel-renewal", {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ confirm: true }),
    }));
    expect(response.status).toBe(403);
    expect(mocks.release).not.toHaveBeenCalled();
  });
});
