import type Stripe from "stripe";
import { getTrustedAppOrigin } from "@/lib/app-origin";

// This was inspected against the live account. Always retrieve and validate it
// before opening a session; the id alone is not a policy guarantee.
export const VERIFIED_DEFAULT_BILLING_PORTAL_CONFIGURATION_ID =
  "bpc_1TQ0mdGz9JQiLX4sd2CQ4LPO";

export const APP_MANAGED_SCHEDULE_MARKER = "dischargexManagedPlanChange";
export const APP_MANAGED_SCHEDULE_USER_KEY = "dischargexUserId";
export const APP_MANAGED_SCHEDULE_SUBSCRIPTION_KEY = "dischargexSubscriptionId";

export function getBillingReturnUrl(): string | null {
  const configuredOrigin = getTrustedAppOrigin();
  if (!configuredOrigin) return null;
  try {
    const parsed = new URL(configuredOrigin);
    if (parsed.protocol !== "https:" && parsed.hostname !== "localhost") return null;
    return `${parsed.origin}/app/profile?billing=portal`;
  } catch {
    return null;
  }
}

export function isSameOriginBillingPost(request: Request): boolean {
  const configuredOrigin = getTrustedAppOrigin();
  if (!configuredOrigin) return false;
  let expectedOrigin: string;
  try {
    expectedOrigin = new URL(configuredOrigin).origin;
  } catch {
    return false;
  }

  const originHeader = request.headers.get("origin");
  if (!originHeader) return false;
  try {
    if (new URL(originHeader).origin !== expectedOrigin) return false;
  } catch {
    return false;
  }

  const fetchSite = request.headers.get("sec-fetch-site");
  return !fetchSite || fetchSite.toLowerCase() === "same-origin";
}

export async function getVerifiedCancellationPortalConfiguration(stripe: Stripe) {
  const configurationId =
    process.env.STRIPE_BILLING_PORTAL_CONFIGURATION_ID?.trim() ||
    VERIFIED_DEFAULT_BILLING_PORTAL_CONFIGURATION_ID;
  const configuration = await stripe.billingPortal.configurations.retrieve(configurationId);
  const features = configuration.features;
  const cancel = features?.subscription_cancel;
  const update = features?.subscription_update;

  if (
    !configuration.active ||
    !cancel?.enabled ||
    cancel.mode !== "at_period_end" ||
    cancel.proration_behavior !== "none" ||
    update?.enabled !== false
  ) {
    throw new Error("BILLING_PORTAL_POLICY_UNAVAILABLE");
  }

  return configuration;
}

export function getStripeCustomerId(customer: string | Stripe.Customer | Stripe.DeletedCustomer | null | undefined) {
  if (typeof customer === "string") return customer;
  return customer && "id" in customer ? customer.id : null;
}

export function getStripePriceId(price: string | Stripe.Price | Stripe.DeletedPrice | null | undefined) {
  if (typeof price === "string") return price;
  return price?.id ?? null;
}

export function getSubscriptionPaidThroughSeconds(subscription: Stripe.Subscription): number | null {
  const items = subscription.items.data;
  const currentItem = items.find((item) => getStripePriceId(item.price)) ?? items[0];
  const itemPeriodEnd = currentItem?.current_period_end;
  if (typeof itemPeriodEnd === "number" && itemPeriodEnd > 0) return itemPeriodEnd;
  const legacyPeriodEnd = (subscription as Stripe.Subscription & { current_period_end?: number }).current_period_end;
  return typeof legacyPeriodEnd === "number" && legacyPeriodEnd > 0 ? legacyPeriodEnd : null;
}

export function getSubscriptionPeriodStartSeconds(subscription: Stripe.Subscription): number | null {
  const items = subscription.items.data;
  const currentItem = items.find((item) => getStripePriceId(item.price)) ?? items[0];
  const itemPeriodStart = currentItem?.current_period_start;
  if (typeof itemPeriodStart === "number" && itemPeriodStart > 0) return itemPeriodStart;
  const legacyPeriodStart = (subscription as Stripe.Subscription & { current_period_start?: number }).current_period_start;
  return typeof legacyPeriodStart === "number" && legacyPeriodStart > 0 ? legacyPeriodStart : null;
}

export function getScheduleSubscriptionId(schedule: Stripe.SubscriptionSchedule): string | null {
  const subscription = schedule.subscription;
  if (typeof subscription === "string") return subscription;
  return subscription?.id ?? null;
}
