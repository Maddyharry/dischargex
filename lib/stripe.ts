import Stripe from "stripe";

export function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("Missing STRIPE_SECRET_KEY");
  return new Stripe(key, { apiVersion: "2025-08-27.basil" });
}

export function getStripeWebhookSecret() {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) throw new Error("Missing STRIPE_WEBHOOK_SECRET");
  return secret;
}

export function getStripePriceMap(): Record<string, string> {
  return {
    basic_monthly: process.env.STRIPE_PRICE_BASIC_MONTHLY || "",
    basic_yearly: process.env.STRIPE_PRICE_BASIC_YEARLY || "",
    standard_monthly: process.env.STRIPE_PRICE_STANDARD_MONTHLY || "",
    standard_yearly: process.env.STRIPE_PRICE_STANDARD_YEARLY || "",
    pro_monthly: process.env.STRIPE_PRICE_PRO_MONTHLY || "",
    pro_yearly: process.env.STRIPE_PRICE_PRO_YEARLY || "",
  };
}

export function getPlanIdByStripePriceId(priceId: string | null | undefined): string | null {
  if (!priceId) return null;
  const map = getStripePriceMap();
  for (const [planId, mappedPriceId] of Object.entries(map)) {
    if (mappedPriceId && mappedPriceId === priceId) return planId;
  }
  return null;
}
