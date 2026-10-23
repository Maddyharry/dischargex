import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  session: { user: { email: "member@example.test" } } as { user: { email: string } } | null,
  user: { id: "user-a", stripeCustomerId: "cus-a" } as { id: string; stripeCustomerId: string } | null,
  payment: {
    id: "payment-a", userId: "user-a", status: "approved", entitlementAppliedAt: new Date("2026-10-22T00:00:00Z"), finalAmount: 1090,
  } as { id: string; userId: string | null; status: string; entitlementAppliedAt: Date | null; finalAmount: number | null } | null,
  checkout: {
    id: "cs_live_1234567890abcdef", payment_status: "paid", currency: "thb", amount_total: 109000, customer: "cus-a",
  } as { id: string; payment_status: string; currency: string | null; amount_total: number | null; customer: string } ,
  userFindUnique: vi.fn(),
  paymentFindFirst: vi.fn(),
  stripeRetrieve: vi.fn(),
}));

vi.mock("next-auth", () => ({ getServerSession: vi.fn(async () => mocks.session) }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("@/lib/prisma", () => ({ prisma: {
  user: { findUnique: mocks.userFindUnique },
  paymentRequest: { findFirst: mocks.paymentFindFirst },
} }));
vi.mock("@/lib/stripe", () => ({ getStripe: () => ({ checkout: { sessions: { retrieve: mocks.stripeRetrieve } } }) }));
vi.mock("@/lib/stripe-portal", () => ({ getStripeCustomerId: (customer: string | null) => customer }));

import { POST } from "@/app/api/stripe/checkout/verify/route";

function request(sessionId = "cs_live_1234567890abcdef") {
  return new Request("https://dischargex.example/api/stripe/checkout/verify", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ sessionId }),
  }) as never;
}

describe("Stripe checkout verification API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.session = { user: { email: "member@example.test" } };
    mocks.user = { id: "user-a", stripeCustomerId: "cus-a" };
    mocks.payment = { id: "payment-a", userId: "user-a", status: "approved", entitlementAppliedAt: new Date("2026-10-22T00:00:00Z"), finalAmount: 1090 };
    mocks.checkout = { id: "cs_live_1234567890abcdef", payment_status: "paid", currency: "thb", amount_total: 109000, customer: "cus-a" };
    mocks.userFindUnique.mockImplementation(async () => mocks.user);
    mocks.paymentFindFirst.mockImplementation(async ({ where }: { where: { userId: string } }) =>
      mocks.payment?.userId === where.userId ? mocks.payment : null);
    mocks.stripeRetrieve.mockImplementation(async () => mocks.checkout);
  });

  it("returns only transaction ID, amount and THB after verified entitlement", async () => {
    const response = await POST(request());
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      ok: true,
      purchase: { transaction_id: "cs_live_1234567890abcdef", value: 1090, currency: "THB" },
    });
    expect(mocks.paymentFindFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { stripeSessionId: "cs_live_1234567890abcdef", userId: "user-a" } }));
    expect(mocks.stripeRetrieve).toHaveBeenCalledWith("cs_live_1234567890abcdef");
  });

  it("requires authentication and does not query Stripe for anonymous visitors", async () => {
    mocks.session = null;
    const response = await POST(request());
    expect(response.status).toBe(401);
    expect(mocks.stripeRetrieve).not.toHaveBeenCalled();
  });

  it("does not return a conversion for another user's payment", async () => {
    mocks.payment = { ...mocks.payment!, userId: "user-b" };
    const response = await POST(request());
    expect(response.status).toBe(202);
    expect(mocks.stripeRetrieve).not.toHaveBeenCalled();
  });

  it.each([
    { payment: { ...mocks.payment!, status: "pending" }, pending: true },
    { payment: { ...mocks.payment!, entitlementAppliedAt: null }, pending: true },
    { checkout: { ...mocks.checkout, payment_status: "unpaid" } },
    { checkout: { ...mocks.checkout, currency: "usd" } },
    { checkout: { ...mocks.checkout, amount_total: 1 } },
    { checkout: { ...mocks.checkout, customer: "cus-other" } },
  ])("rejects pending, unpaid or mismatched checkout evidence %#", async (override) => {
    if (override.payment) mocks.payment = override.payment;
    if (override.checkout) mocks.checkout = override.checkout;
    const response = await POST(request());
    expect(response.status).toBe(override.pending ? 202 : 404);
    expect((await response.json()).ok).toBe(false);
    if (override.pending) expect(mocks.stripeRetrieve).not.toHaveBeenCalled();
  });
});
