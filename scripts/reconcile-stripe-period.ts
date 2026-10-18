import { loadEnvConfig } from "@next/env";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import type Stripe from "stripe";
import { getCreditCycleBounds, isPaidPlan, normalizePlanId } from "../lib/billing-rules";
import { getStripe, getPlanIdByStripePriceId } from "../lib/stripe";
import { getStripeCustomerId, getStripePriceId } from "../lib/stripe-portal";
import { prisma } from "../lib/prisma";

const MAX_DIFFERENCE_MS = 2 * 24 * 60 * 60 * 1000;

type DbSnapshot = {
  id: string;
  plan: string;
  subscriptionStatus: string;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  periodStartedAtRaw: string | null;
  subscriptionExpiresAtRaw: string | null;
};

type PeriodRepair = {
  oldStart: Date;
  oldEnd: Date;
  newStart: Date;
  newEnd: Date;
  differenceMs: number;
};

function parseDatabaseUtcTimestamp(raw: string | null): Date | null {
  if (!raw) return null;
  const normalized = raw.trim().replace(" ", "T");
  const withUtc = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(normalized) ? normalized : `${normalized}Z`;
  const parsed = new Date(withUtc);
  return Number.isFinite(parsed.getTime()) ? parsed : null;
}

export function assessPeriodRepair(
  rawStart: string | null,
  rawEnd: string | null,
  actualStartSeconds: number,
  actualEndSeconds: number,
): PeriodRepair | null {
  const oldStart = parseDatabaseUtcTimestamp(rawStart);
  const oldEnd = parseDatabaseUtcTimestamp(rawEnd);
  if (!oldStart || !oldEnd || !Number.isFinite(actualStartSeconds) || !Number.isFinite(actualEndSeconds)) return null;
  const newStart = new Date(actualStartSeconds * 1000);
  const newEnd = new Date(actualEndSeconds * 1000);
  const differenceMs = newEnd.getTime() - oldEnd.getTime();
  if (
    differenceMs <= 0 ||
    differenceMs > MAX_DIFFERENCE_MS ||
    Math.abs(newStart.getTime() - oldStart.getTime()) > MAX_DIFFERENCE_MS ||
    newEnd.getTime() <= newStart.getTime()
  ) return null;
  return { oldStart, oldEnd, newStart, newEnd, differenceMs };
}

async function readDbSnapshot(targetUserId: string): Promise<DbSnapshot | null> {
  const rows = await prisma.$queryRaw<DbSnapshot[]>`
    SELECT
      "id", "plan", "subscriptionStatus", "stripeCustomerId", "stripeSubscriptionId",
      CAST("periodStartedAt" AS text) AS "periodStartedAtRaw",
      CAST("subscriptionExpiresAt" AS text) AS "subscriptionExpiresAtRaw"
    FROM "User"
    WHERE "id" = ${targetUserId}
    LIMIT 1
  `;
  return rows[0] ?? null;
}

function invoiceSubscriptionId(invoice: Stripe.Invoice): string | null {
  const invoiceAny = invoice as Stripe.Invoice & {
    subscription?: string | { id?: string } | null;
    parent?: { subscription_details?: { subscription?: string | { id?: string } | null } | null } | null;
  };
  const value = invoiceAny.subscription ?? invoiceAny.parent?.subscription_details?.subscription;
  if (typeof value === "string") return value;
  return value?.id ?? null;
}

async function getLatestPaidInvoice(stripe: Stripe, subscription: Stripe.Subscription) {
  const latestInvoice = subscription.latest_invoice;
  if (!latestInvoice) return null;
  const invoice = typeof latestInvoice === "string"
    ? await stripe.invoices.retrieve(latestInvoice)
    : latestInvoice;
  const subscriptionId = invoiceSubscriptionId(invoice);
  if (
    invoice.status !== "paid" ||
    getStripeCustomerId(invoice.customer) !== getStripeCustomerId(subscription.customer) ||
    subscriptionId !== subscription.id
  ) return null;
  return invoice;
}

async function main() {
  loadEnvConfig(process.cwd());
  const targetUserId = process.env.RECONCILE_USER_ID?.trim();
  if (!targetUserId) throw new Error("RECONCILE_USER_ID is required; no account was selected and no change was made.");
  const args = process.argv.slice(2);
  if (args.some((arg) => arg !== "--apply") || args.filter((arg) => arg === "--apply").length > 1) {
    throw new Error("Usage: npx tsx scripts/reconcile-stripe-period.ts [--apply]");
  }
  const apply = args.includes("--apply");

  const snapshot = await readDbSnapshot(targetUserId);
  if (!snapshot) throw new Error("Scoped account was not found; no change made.");
  if (!snapshot.stripeCustomerId || !snapshot.stripeSubscriptionId) throw new Error("Scoped account has no linked Stripe subscription; no change made.");

  const stripe = getStripe();
  const subscription = await stripe.subscriptions.retrieve(snapshot.stripeSubscriptionId, {
    expand: ["items.data.price", "latest_invoice"],
  });
  if (
    subscription.id !== snapshot.stripeSubscriptionId ||
    getStripeCustomerId(subscription.customer) !== snapshot.stripeCustomerId ||
    subscription.status !== "active" ||
    subscription.items.data.length !== 1
  ) throw new Error("Stripe subscription ownership or active paid status did not match; no change made.");

  const latestInvoice = await getLatestPaidInvoice(stripe, subscription);
  if (!latestInvoice) throw new Error("Latest subscription invoice is not verified paid for this customer/subscription; no change made.");

  const item = subscription.items.data[0];
  const priceId = getStripePriceId(item.price);
  const stripePlan = getPlanIdByStripePriceId(priceId);
  const dbPlan = normalizePlanId(snapshot.plan);
  if (!stripePlan || !isPaidPlan(dbPlan) || stripePlan !== dbPlan) {
    throw new Error("Stripe price and database plan do not match; no change made.");
  }
  const actualStart = item.current_period_start;
  const actualEnd = item.current_period_end;
  if (!actualStart || !actualEnd) throw new Error("Stripe subscription item period is unavailable; no change made.");

  const repair = assessPeriodRepair(
    snapshot.periodStartedAtRaw,
    snapshot.subscriptionExpiresAtRaw,
    actualStart,
    actualEnd,
  );
  if (!repair) throw new Error("No safe repair: Stripe period does not extend the database by at most two days; no change made.");

  const report = {
    mode: apply ? "apply" : "dry-run",
    scope: "one explicitly configured account",
    plan: dbPlan,
    subscriptionStatusPreserved: snapshot.subscriptionStatus,
    latestInvoice: "paid and ownership-verified",
    oldPeriod: { start: repair.oldStart.toISOString(), end: repair.oldEnd.toISOString() },
    stripeItemPeriodUtc: { start: repair.newStart.toISOString(), end: repair.newEnd.toISOString() },
    extensionHours: repair.differenceMs / (60 * 60 * 1000),
    writes: apply ? "database period fields and one entitlement audit note only" : "none",
  };
  if (!apply) {
    console.log(JSON.stringify(report, null, 2));
    return;
  }

  const plan = dbPlan;
  const { cycleStart, cycleEnd } = getCreditCycleBounds(repair.newStart, plan, new Date());
  const limitedCycleEnd = cycleEnd.getTime() > repair.newEnd.getTime() ? repair.newEnd : cycleEnd;
  const nextRefresh = limitedCycleEnd.getTime() < repair.newEnd.getTime() ? limitedCycleEnd : null;
  const sqlTimestamp = (date: Date) => date.toISOString().replace("T", " ").replace("Z", "");
  const auditNote = `Stripe period reconciliation ${JSON.stringify({
    metadata: "verified_active_subscription_latest_paid_invoice_item_period",
    oldStart: repair.oldStart.toISOString(),
    oldEnd: repair.oldEnd.toISOString(),
    newStart: repair.newStart.toISOString(),
    newEnd: repair.newEnd.toISOString(),
  })}`;

  await prisma.$transaction(async (tx) => {
    const changed = await tx.$executeRaw`
      UPDATE "User"
      SET "periodStartedAt" = ${sqlTimestamp(repair.newStart)}::timestamp,
          "subscriptionExpiresAt" = ${sqlTimestamp(repair.newEnd)}::timestamp,
          "currentCreditCycleStart" = ${sqlTimestamp(cycleStart)}::timestamp,
          "currentCreditCycleEnd" = ${sqlTimestamp(limitedCycleEnd)}::timestamp,
          "nextCreditRefreshAt" = ${nextRefresh ? sqlTimestamp(nextRefresh) : null}::timestamp
      WHERE "id" = ${targetUserId}
        AND "plan" = ${snapshot.plan}
        AND "subscriptionStatus" = ${snapshot.subscriptionStatus}
        AND "stripeCustomerId" = ${snapshot.stripeCustomerId}
        AND "stripeSubscriptionId" = ${snapshot.stripeSubscriptionId}
        AND "periodStartedAt" IS NOT DISTINCT FROM ${snapshot.periodStartedAtRaw}::timestamp
        AND "subscriptionExpiresAt" IS NOT DISTINCT FROM ${snapshot.subscriptionExpiresAtRaw}::timestamp
    `;
    if (changed !== 1) throw new Error("Compare-and-set failed; account changed since read, so no audit was written.");
    await tx.entitlementLog.create({
      data: {
        userId: targetUserId,
        action: "manual_adjust",
        creditsDelta: 0,
        expiryDeltaDays: 0,
        note: auditNote,
      },
    });
  });

  console.log(JSON.stringify({ ...report, applied: true, audit: "recorded" }, null, 2));
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main()
    .catch((error: unknown) => {
      console.error(error instanceof Error ? error.message : "Period reconciliation failed.");
      process.exitCode = 1;
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
