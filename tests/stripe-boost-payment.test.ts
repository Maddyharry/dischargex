import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { getBoostAdminStatus, getVerifiedBoostPaymentIntent, isStripeVerifiedBoostPayment } from "../lib/stripe-boost-payment";

describe("Stripe Boost payment proof", () => {
  const paid = {
    payment_status: "paid", amount_total: 10_900, currency: "thb", payment_intent: "pi_paid",
  };

  it("accepts a paid THB Checkout Session only when amount and PaymentIntent match", () => {
    expect(getVerifiedBoostPaymentIntent(paid, { finalAmount: 109 })).toBe("pi_paid");
    expect(getVerifiedBoostPaymentIntent({ ...paid, payment_intent: { id: "pi_expanded" } }, { finalAmount: 109 })).toBe("pi_expanded");
  });

  it.each([
    ["open/unpaid", { ...paid, payment_status: "unpaid" }],
    ["no payment required", { ...paid, payment_status: "no_payment_required" }],
    ["amount mismatch", { ...paid, amount_total: 10_800 }],
    ["currency mismatch", { ...paid, currency: "usd" }],
    ["missing PaymentIntent", { ...paid, payment_intent: null }],
    ["zero-price request", paid],
  ])("rejects %s without granting Boost", (label, session) => {
    const finalAmount = label === "zero-price request" ? 0 : 109;
    expect(getVerifiedBoostPaymentIntent(session, { finalAmount })).toBeNull();
  });

  it("counts a purchase as paid only after the verified webhook recorded its intent and entitlement", () => {
    expect(isStripeVerifiedBoostPayment({ reviewedBy: "stripe_webhook", stripePaymentIntentId: "pi_1", entitlementAppliedAt: new Date() })).toBe(true);
    expect(isStripeVerifiedBoostPayment({ reviewedBy: "admin", stripePaymentIntentId: null, entitlementAppliedAt: new Date() })).toBe(false);
    expect(isStripeVerifiedBoostPayment({ reviewedBy: "stripe_webhook", stripePaymentIntentId: "pi_1", entitlementAppliedAt: null })).toBe(false);
  });

  it("uses readable admin labels for pending and legacy records", () => {
    expect(getBoostAdminStatus({ status: "awaiting_review" })).toBe("รอชำระเงิน / ยืนยัน");
    expect(getBoostAdminStatus({ status: "rejected" })).toBe("ไม่อนุมัติ");
    expect(getBoostAdminStatus({ status: "approved", entitlementAppliedAt: new Date() })).toContain("ตรวจหลักฐาน Stripe");
  });

  it("wires delayed-payment success into the same idempotent webhook fulfillment path", () => {
    const source = readFileSync("app/api/stripe/webhook/route.ts", "utf8");
    expect(source).toContain('event.type === "checkout.session.completed" || event.type === "checkout.session.async_payment_succeeded"');
    expect(source).toContain("where: { id: payment.id, entitlementAppliedAt: null }");
    expect(source).toContain("getVerifiedBoostPaymentIntent(session, payment)");
    expect(source).toContain('stripePaymentIntentId: boostPaymentIntentId');
  });
});
