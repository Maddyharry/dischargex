import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  session: { user: { id: "user-a", email: "member@example.test" } } as { user: { id: string; email: string } } | null,
  marker: { eventToken: "abcdef1234567890abcdef1234567890" } as { eventToken: string } | null,
  user: { stripeCustomerId: "cus-a" } as { stripeCustomerId: string } | null,
  payment: { userId: "user-a", status: "approved", entitlementAppliedAt: new Date("2026-10-22T00:00:00Z"), finalAmount: 1090 } as {
    userId: string; status: string; entitlementAppliedAt: Date | null; finalAmount: number | null;
  } | null,
  stripeSession: { id: "cs_live_1234567890abcdef", payment_status: "paid", currency: "thb", amount_total: 109000, customer: "cus-a" } as {
    id: string; payment_status: string; currency: string | null; amount_total: number | null; customer: string;
  },
  markerFind: vi.fn(),
  userFind: vi.fn(),
  paymentFind: vi.fn(),
  feedbackCreateMany: vi.fn(),
  stripeRetrieve: vi.fn(),
  trackTelemetry: vi.fn(),
}));

vi.mock("next-auth", () => ({ getServerSession: vi.fn(async () => mocks.session) }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("@/lib/prisma", () => ({ prisma: {
  firstCaseAnalytics: { findUnique: mocks.markerFind },
  user: { findUnique: mocks.userFind },
  paymentRequest: { findFirst: mocks.paymentFind },
  feedback: { createMany: mocks.feedbackCreateMany },
} }));
vi.mock("@/lib/telemetry", () => ({ trackTelemetry: mocks.trackTelemetry }));
vi.mock("@/lib/stripe", () => ({ getStripe: () => ({ checkout: { sessions: { retrieve: mocks.stripeRetrieve } } }) }));
vi.mock("@/lib/stripe-portal", () => ({ getStripeCustomerId: (customer: string | null) => customer }));

import { POST } from "@/app/api/telemetry/web/route";

function request(payload: unknown) {
  return new Request("https://dischargex.example/api/telemetry/web", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  }) as never;
}

describe("web analytics server authorization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.VERCEL_ENV = "production";
    mocks.session = { user: { id: "user-a", email: "member@example.test" } };
    mocks.marker = { eventToken: "abcdef1234567890abcdef1234567890" };
    mocks.user = { stripeCustomerId: "cus-a" };
    mocks.payment = { userId: "user-a", status: "approved", entitlementAppliedAt: new Date("2026-10-22T00:00:00Z"), finalAmount: 1090 };
    mocks.stripeSession = { id: "cs_live_1234567890abcdef", payment_status: "paid", currency: "thb", amount_total: 109000, customer: "cus-a" };
    mocks.markerFind.mockImplementation(async () => mocks.marker);
    mocks.userFind.mockImplementation(async () => mocks.user);
    mocks.paymentFind.mockImplementation(async ({ where }: { where: { userId: string; stripeSessionId: string } }) =>
      mocks.payment?.userId === where.userId && mocks.stripeSession.id === where.stripeSessionId ? mocks.payment : null);
    mocks.feedbackCreateMany.mockResolvedValue({ count: 1 });
    mocks.stripeRetrieve.mockImplementation(async () => mocks.stripeSession);
  });

  it("rejects fabricated first-case completion tokens", async () => {
    const response = await POST(request({ event: "first_case_completed", metadata: { event_id: "00000000000000000000000000000000" } }));
    expect(response.status).toBe(403);
    expect(mocks.feedbackCreateMany).not.toHaveBeenCalled();
    expect(mocks.trackTelemetry).not.toHaveBeenCalled();
  });

  it("accepts first-case completion only when the token belongs to this user", async () => {
    const response = await POST(request({ event: "first_case_completed", metadata: { event_id: "abcdef1234567890abcdef1234567890" } }));
    expect(response.status).toBe(200);
    expect(mocks.markerFind).toHaveBeenCalledWith({ where: { userId: "user-a" }, select: { eventToken: true } });
    expect(mocks.feedbackCreateMany).toHaveBeenCalledOnce();
  });

  it("rejects a browser-forged purchase without approved webhook entitlement", async () => {
    mocks.payment = { ...mocks.payment!, status: "pending" };
    const response = await POST(request({
      event: "purchase",
      metadata: { transaction_id: "cs_live_1234567890abcdef", value: 1090, currency: "THB" },
    }));
    expect(response.status).toBe(403);
    expect(mocks.feedbackCreateMany).not.toHaveBeenCalled();
  });

  it("rechecks ownership and Stripe evidence before recording a deduplicated purchase", async () => {
    const payload = { event: "purchase", metadata: { transaction_id: "cs_live_1234567890abcdef", value: 1090, currency: "THB" } };
    const first = await POST(request(payload));
    const second = await POST(request(payload));
    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(mocks.stripeRetrieve).toHaveBeenCalledTimes(2);
    expect(mocks.feedbackCreateMany).toHaveBeenCalledTimes(2);
    const rows = mocks.feedbackCreateMany.mock.calls.map(([value]) => value);
    expect(rows[0].data[0].id).toBe(rows[1].data[0].id);
    expect(rows[0].data[0].payload).toBe(JSON.stringify(payload.metadata));
  });
});
