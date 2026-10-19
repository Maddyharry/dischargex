type BoostCheckoutPayment = {
  payment_status?: string | null;
  amount_total?: number | null;
  currency?: string | null;
  payment_intent?: string | { id?: string | null } | null;
};

type BoostPaymentRequest = { finalAmount?: number | null };

export function getVerifiedBoostPaymentIntent(
  session: BoostCheckoutPayment,
  payment: BoostPaymentRequest,
): string | null {
  if (session.payment_status !== "paid") return null;
  if (!Number.isSafeInteger(payment.finalAmount) || (payment.finalAmount ?? 0) <= 0) return null;
  if (!Number.isSafeInteger(session.amount_total) || session.amount_total !== payment.finalAmount! * 100) return null;
  if (session.currency?.toLowerCase() !== "thb") return null;
  const intentId = typeof session.payment_intent === "string"
    ? session.payment_intent
    : session.payment_intent?.id;
  return typeof intentId === "string" && intentId.startsWith("pi_") ? intentId : null;
}

export function isStripeVerifiedBoostPayment(payment: {
  reviewedBy?: string | null;
  stripePaymentIntentId?: string | null;
  entitlementAppliedAt?: Date | null;
}): boolean {
  return payment.reviewedBy === "stripe_webhook"
    && typeof payment.stripePaymentIntentId === "string"
    && payment.stripePaymentIntentId.startsWith("pi_")
    && payment.entitlementAppliedAt instanceof Date;
}

export function getBoostAdminStatus(payment: {
  status?: string | null;
  reviewedBy?: string | null;
  stripePaymentIntentId?: string | null;
  entitlementAppliedAt?: Date | null;
}): string {
  if (isStripeVerifiedBoostPayment(payment)) return "ชำระแล้ว · Stripe ยืนยัน";
  if (payment.entitlementAppliedAt) return "มีการบันทึกสิทธิ์ · ตรวจหลักฐาน Stripe";
  switch (payment.status) {
    case "awaiting_review":
    case "pending":
    case "awaiting_slip": return "รอชำระเงิน / ยืนยัน";
    case "rejected": return "ไม่อนุมัติ";
    case "expired": return "หมดอายุ";
    case "cancelled": return "ยกเลิกแล้ว";
    default: return payment.status || "สถานะไม่ทราบ";
  }
}
