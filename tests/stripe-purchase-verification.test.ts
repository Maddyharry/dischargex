import { describe, expect, it, vi } from "vitest";
import { captureAndRemoveStripeSessionId, verifyPurchaseAnalytics } from "@/lib/stripe-purchase-verification";

const valid = {
  authenticatedUserId: "user-a",
  payment: {
    userId: "user-a",
    status: "approved",
    entitlementAppliedAt: new Date("2026-10-22T10:00:00.000Z"),
    finalAmount: 1090,
  },
  checkout: {
    id: "cs_live_1234567890abcdef",
    payment_status: "paid",
    currency: "thb",
    amount_total: 109000,
    customerId: "cus_owner",
  },
  expectedCustomerId: "cus_owner",
};

describe("Stripe return URL privacy", () => {
  it("captures session_id and scrubs it while preserving other URL state", () => {
    const replaceState = vi.fn();
    const sessionId = captureAndRemoveStripeSessionId({
      search: "?stripe=success&session_id=cs_live_1234567890abcdef&campaign=safe",
      pathname: "/app/profile",
      hash: "#billing",
      replaceState,
    });
    expect(sessionId).toBe("cs_live_1234567890abcdef");
    expect(replaceState).toHaveBeenCalledWith("/app/profile?stripe=success&campaign=safe#billing");
  });
});

describe("verified Stripe purchase handoff", () => {
  it("returns only the stable transaction id and verified THB amount", () => {
    expect(verifyPurchaseAnalytics(valid)).toEqual({
      transaction_id: "cs_live_1234567890abcdef",
      value: 1090,
      currency: "THB",
    });
  });

  it.each([
    { authenticatedUserId: "other-user" },
    { payment: { ...valid.payment, userId: "other-user" } },
    { payment: { ...valid.payment, status: "pending" } },
    { payment: { ...valid.payment, entitlementAppliedAt: null } },
    { checkout: { ...valid.checkout, payment_status: "unpaid" } },
    { checkout: { ...valid.checkout, currency: "usd" } },
    { checkout: { ...valid.checkout, amount_total: 1 } },
    { checkout: { ...valid.checkout, customerId: "cus_someone_else" } },
    { checkout: { ...valid.checkout, id: "cs_live_patient123456" } },
  ])("rejects unverifiable purchase state %#", (override) => {
    expect(verifyPurchaseAnalytics({ ...valid, ...override })).toBeNull();
  });

  it("is stable under repeated verification so transaction_id supports downstream dedupe", () => {
    const first = verifyPurchaseAnalytics(valid);
    const second = verifyPurchaseAnalytics(valid);
    expect(second).toEqual(first);
    expect(second?.transaction_id).toBe(valid.checkout.id);
  });
});
