export type VerifiedPurchaseAnalytics = {
  transaction_id: string;
  value: number;
  currency: "THB";
};

export function captureAndRemoveStripeSessionId(input: {
  search: string;
  pathname: string;
  hash: string;
  replaceState: (url: string) => void;
}): string | null {
  const params = new URLSearchParams(input.search);
  const sessionId = params.get("session_id");
  if (!sessionId) return null;
  params.delete("session_id");
  const query = params.toString();
  input.replaceState(`${input.pathname}${query ? `?${query}` : ""}${input.hash}`);
  return sessionId;
}

export function verifyPurchaseAnalytics(input: {
  authenticatedUserId: string;
  payment: {
    userId: string | null;
    status: string;
    entitlementAppliedAt: Date | null;
    finalAmount: number | null;
  } | null;
  checkout: {
    id: string;
    payment_status: string;
    currency: string | null;
    amount_total: number | null;
    customerId: string | null;
  };
  expectedCustomerId: string;
}): VerifiedPurchaseAnalytics | null {
  const { payment, checkout } = input;
  if (!payment || payment.userId !== input.authenticatedUserId || payment.status !== "approved" ||
      !payment.entitlementAppliedAt || !Number.isFinite(payment.finalAmount) || payment.finalAmount == null ||
      payment.finalAmount <= 0 || checkout.payment_status !== "paid" || checkout.currency?.toLowerCase() !== "thb" ||
      checkout.amount_total !== Math.round(payment.finalAmount * 100) ||
      checkout.customerId !== input.expectedCustomerId ||
      !/^cs_(?:test|live)_[A-Za-z0-9]{16,96}$/.test(checkout.id)) return null;

  return { transaction_id: checkout.id, value: payment.finalAmount, currency: "THB" };
}
