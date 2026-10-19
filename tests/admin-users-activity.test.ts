import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  session: vi.fn(), userFindMany: vi.fn(), userFindUnique: vi.fn(),
  usageAggregate: vi.fn(), usageCount: vi.fn(), usageFindMany: vi.fn(),
  ledgerAggregate: vi.fn(), ledgerFindMany: vi.fn(), feedbackFindMany: vi.fn(),
  paymentFindMany: vi.fn(),
}));

vi.mock("next-auth", () => ({ getServerSession: mocks.session }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("@/lib/prisma", () => ({ prisma: {
  user: { findMany: mocks.userFindMany, findUnique: mocks.userFindUnique },
  usageLog: { aggregate: mocks.usageAggregate, count: mocks.usageCount, findMany: mocks.usageFindMany },
  tokenUsageLedger: { aggregate: mocks.ledgerAggregate, findMany: mocks.ledgerFindMany },
  paymentRequest: { findMany: mocks.paymentFindMany },
  feedback: { findMany: mocks.feedbackFindMany },
} }));

import { GET as getUsers } from "../app/api/admin/users/route";
import { GET as getActivity } from "../app/api/admin/users/[id]/activity/route";

const user = {
  id: "user-1", email: "synthetic@example.test", name: "Synthetic User", plan: "pro_monthly", role: "user",
  totalGenerations: 55, createdAt: new Date("2026-10-01T00:00:00Z"), periodStartedAt: new Date("2026-10-01T00:00:00Z"),
  subscriptionExpiresAt: null, subscriptionStatus: "active", _count: { deviceSessions: 1 },
  extraCredits: 3,
};

beforeEach(() => {
  vi.resetAllMocks();
  mocks.session.mockResolvedValue({ user: { role: "admin" } });
  mocks.userFindMany.mockResolvedValue([user]);
  mocks.usageAggregate.mockResolvedValue({ _sum: { baseCreditsUsed: 0, addonCreditsUsed: 2 }, _max: { createdAt: new Date("2026-10-14T00:00:00Z") } });
  mocks.usageCount.mockImplementation(({ where }: { where: { createdAt?: { gte?: Date; lt?: Date } } }) => {
    const start = where.createdAt?.gte?.getTime();
    const end = where.createdAt?.lt?.getTime();
    if (start != null && end != null && end - start < 2 * 24 * 60 * 60 * 1000) return Promise.resolve(0);
    return Promise.resolve(55);
  });
  mocks.ledgerFindMany.mockResolvedValue([{ createdAt: new Date("2026-10-12T00:00:00Z"), model: "gpt-5.4", inputTokens: 1_000, outputTokens: 1_000, totalTokens: 2_000, estimatedCostThb: 1 }]);
  mocks.paymentFindMany.mockResolvedValue([{ userId: "user-1", addCredits: 5, finalAmount: 109, createdAt: new Date("2026-10-13T00:00:00Z"), entitlementAppliedAt: new Date("2026-10-13T00:00:01Z"), reviewedBy: "stripe_webhook", stripePaymentIntentId: "pi_test" }]);
});

describe("admin user usage counters", () => {
  it("reports generated summaries and ledger spend when legacy credits are zero", async () => {
    const response = await getUsers();
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toContain("private, no-store");
    expect(body.users[0]).toMatchObject({
      totalGenerations: 55, usageCount: 0, summariesToday: 0, dailySummaryLimit: 40, summariesThisMonth: 55,
      lifetimeSummaries: 55, apiCostEstimateStatus: "known", apiCostEstimateThb: 0.63,
      currentApiCostCapKind: "legacy_internal", currentApiCostCapThb: 3600, nextRenewalCapForecastThb: 272.5,
      boostPassesRemaining: 3, boostPassesPurchased: 5, boostPurchaseCount: 1, boostPurchaseRevenue: 109, boostPassesConsumed: 2,
    });
    expect(body.boostOverview).toMatchObject({ successfulPurchases: 1, passesSold: 5, revenueThb: 109, passesRemaining: 3, passesConsumed: 2 });
    expect(mocks.paymentFindMany.mock.calls[0][0].where).toEqual({ type: "addon" });
    expect(mocks.ledgerFindMany.mock.calls[0][0].where).not.toHaveProperty("source");
  });

  it("counts only Stripe-verified paid addon requests, and reports pending and unverified separately", async () => {
    mocks.paymentFindMany.mockResolvedValue([
      { userId: "user-1", addCredits: 5, finalAmount: 109, createdAt: new Date("2026-10-13T00:00:00Z"), entitlementAppliedAt: new Date("2026-10-13T00:00:01Z"), reviewedBy: "stripe_webhook", stripePaymentIntentId: "pi_paid1", status: "approved" },
      { userId: "user-1", addCredits: 15, finalAmount: 329, createdAt: new Date("2026-10-14T00:00:00Z"), entitlementAppliedAt: null, reviewedBy: null, stripePaymentIntentId: null, status: "awaiting_review" },
      { userId: "user-1", addCredits: 5, finalAmount: 109, createdAt: new Date("2026-10-15T00:00:00Z"), entitlementAppliedAt: new Date("2026-10-15T00:00:01Z"), reviewedBy: "admin", stripePaymentIntentId: null, status: "approved" },
    ]);
    const response = await getUsers();
    const body = await response.json();
    expect(body.boostOverview).toMatchObject({ successfulPurchases: 1, passesSold: 5, revenueThb: 109, pendingPurchases: 1, failedPurchases: 0, unverifiedAppliedPurchases: 1 });
    expect(body.users[0]).toMatchObject({ boostPassesPurchased: 5, boostPurchaseCount: 1, boostPurchaseRevenue: 109 });
  });

  it("keeps unsupported model cost unknown instead of reporting zero", async () => {
    mocks.ledgerFindMany.mockResolvedValue([{ createdAt: new Date("2026-10-12T00:00:00Z"), model: "future-model", inputTokens: 10, outputTokens: 10, totalTokens: 20, estimatedCostThb: 1 }]);
    const response = await getUsers();
    const body = await response.json();
    expect(body.users[0]).toMatchObject({ apiCostEstimateStatus: "unknown", apiCostEstimateThb: null, apiCostUnknownModelCount: 1 });
  });

  it("uses the shared selector to avoid counting provider calls and final summary aggregates twice", async () => {
    const timestamp = new Date("2026-10-12T00:00:00Z");
    const common = { createdAt: timestamp, model: "gpt-5.4", inputTokens: 1_000, outputTokens: 1_000, totalTokens: 2_000, estimatedCostThb: 1 };
    mocks.ledgerFindMany.mockResolvedValue([
      { ...common, source: "summary_provider_call", referenceId: "job-a" },
      { ...common, source: "summary_generate", referenceId: "job-a" },
      { ...common, source: "summary_image_ocr", referenceId: "job-a" },
    ]);
    const response = await getUsers();
    const body = await response.json();
    expect(body.users[0].apiCostRowCount).toBe(2);
    expect(body.users[0].apiCostEstimateStatus).toBe("known");
  });

  it("does not turn a failed ledger read into zero usage", async () => {
    mocks.ledgerFindMany.mockRejectedValue(new Error("synthetic database failure"));
    const response = await getUsers();
    const body = await response.json();
    expect(body.users[0]).toMatchObject({ apiCostEstimateStatus: "unknown", apiCostEstimateThb: null, policySpendThb: null, policyAllowed: false });
  });

  it("labels a post-cutoff paid period as eligible without implying enforcement", async () => {
    mocks.userFindMany.mockResolvedValue([{ ...user, periodStartedAt: new Date("2026-10-19T00:00:00+07:00") }]);
    const response = await getUsers();
    const body = await response.json();
    expect(body.users[0]).toMatchObject({
      revenue4xEligible: true,
      currentApiCostCapKind: "revenue_4x",
      currentApiCostCapThb: 272.5,
      nextRenewalCapForecastThb: 272.5,
    });
  });

  it("rejects non-admins before querying users", async () => {
    mocks.session.mockResolvedValue({ user: { role: "user" } });
    expect((await getUsers()).status).toBe(403);
    expect(mocks.userFindMany).not.toHaveBeenCalled();
  });
});

describe("admin per-user activity", () => {
  it("requires admin before accessing the account database", async () => {
    mocks.session.mockResolvedValue(null);
    const response = await getActivity(new Request("https://example.test/api/admin/users/user-1/activity"), { params: Promise.resolve({ id: "user-1" }) });
    expect(response.status).toBe(403);
    expect(mocks.userFindUnique).not.toHaveBeenCalled();
  });

  it("includes privacy-limited Boost purchase events and excludes payment/customer secrets", async () => {
    mocks.userFindUnique.mockResolvedValue({ id: "user-1" });
    mocks.usageFindMany.mockResolvedValue([]);
    mocks.ledgerFindMany.mockResolvedValue([]);
    mocks.feedbackFindMany.mockResolvedValue([]);
    mocks.paymentFindMany.mockResolvedValue([
      { type: "addon", status: "approved", addCredits: 5, finalAmount: 109, createdAt: new Date("2026-10-13T00:00:00Z"), entitlementAppliedAt: new Date("2026-10-13T00:00:01Z"), reviewedBy: "stripe_webhook", stripePaymentIntentId: "pi_paid", phone: "DO_NOT_RETURN_PHONE", hospitalName: "DO_NOT_RETURN_HOSPITAL", slipData: "DO_NOT_RETURN_SLIP", stripeSessionId: "DO_NOT_RETURN_STRIPE" },
      { type: "addon", status: "rejected", addCredits: 15, finalAmount: 329, createdAt: new Date("2026-10-12T00:00:00Z"), entitlementAppliedAt: null, reviewedBy: null, stripePaymentIntentId: null },
    ]);
    const response = await getActivity(new Request("https://example.test/api/admin/users/user-1/activity"), { params: Promise.resolve({ id: "user-1" }) });
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toContain("no-store");
    expect(mocks.paymentFindMany.mock.calls[0][0].select).toEqual({ type: true, status: true, addCredits: true, finalAmount: true, createdAt: true, entitlementAppliedAt: true, reviewedBy: true, stripePaymentIntentId: true });
    expect(body.activities.filter((event: { kind: string }) => event.kind === "boost_purchase")).toMatchObject([
      { type: "addon", status: "ชำระแล้ว · Stripe ยืนยัน", addCredits: 5, finalAmount: 109 },
      { type: "addon", status: "ไม่อนุมัติ", addCredits: 15, finalAmount: 329 },
    ]);
    expect(JSON.stringify(body)).not.toMatch(/DO_NOT_RETURN_(PHONE|HOSPITAL|SLIP|STRIPE)/);
  });

  it("bounds results, exposes only allowlisted metadata, and redacts saved text", async () => {
    mocks.userFindUnique.mockResolvedValue({ id: "user-1" });
    mocks.usageFindMany.mockResolvedValue([{
      id: "u1", createdAt: new Date("2026-10-13T00:00:00Z"), reason: "token_generate", creditsUsed: 0,
      baseCreditsUsed: 0, addonCreditsUsed: 0, caseId: "case-1", summarySnapshot: `${"x".repeat(11_980)} HN: ABC123 ${"trailing".repeat(100)}`,
    }]);
    mocks.ledgerFindMany.mockResolvedValue([
      { id: "l1", createdAt: new Date("2026-10-13T00:00:02Z"), source: "summary_provider_call", model: "gpt-5.4", inputTokens: 100, outputTokens: 50, totalTokens: 150, estimatedCostThb: 0.5, referenceId: "job-1" },
      { id: "l2", createdAt: new Date("2026-10-13T00:00:03Z"), source: "summary_image_ocr", model: "gpt-4o-mini", inputTokens: 200, outputTokens: 25, totalTokens: 225, estimatedCostThb: 0.7, referenceId: "job-1" },
    ]);
    mocks.feedbackFindMany.mockResolvedValue([{
      id: "f1", createdAt: new Date("2026-10-13T00:00:01Z"), type: "summary_job", message: "Summary generated",
      status: "completed", category: null, shortSummary: null, pageOrFeature: null, reproducibleSteps: null,
      impactLevel: null, aiScore: null,
      payload: JSON.stringify({ warningCount: 2, warnings: ["CID: 1234567890123 review", "other"], rawPatientInput: "DO_NOT_RETURN", imageBase64: "DO_NOT_RETURN_IMAGE", privacy: { deidentifiedBeforeModel: true, textRedactionApplied: true, imageRedactionConfirmed: true, imageContentVerified: false } }),
    }]);
    const response = await getActivity(new Request("https://example.test/api/admin/users/user-1/activity?limit=999"), { params: Promise.resolve({ id: "user-1" }) });
    const body = await response.json();
    expect(response.headers.get("Cache-Control")).toContain("no-store");
    expect(body.limit).toBe(30);
    expect(mocks.usageFindMany.mock.calls[0][0].take).toBe(30);
    expect(JSON.stringify(body)).not.toContain("DO_NOT_RETURN");
    expect(JSON.stringify(body)).not.toContain("1234567890123");
    expect(body.activities.find((item: { kind: string }) => item.kind === "summary").summaryText).toContain("[REDACTED]");
    expect(body.activities.find((item: { kind: string }) => item.kind === "summary").summaryTextTruncated).toBe(true);
    const providerCall = body.activities.find((item: { source?: string }) => item.source === "summary_provider_call");
    const imageOcr = body.activities.find((item: { source?: string }) => item.source === "summary_image_ocr");
    expect(providerCall.actualApiCostEstimateStatus).toBe("known");
    expect(imageOcr.actualApiCostEstimateStatus).toBe("known");
    const summaryJob = body.activities.find((item: { kind: string }) => item.kind === "summary_job");
    expect(summaryJob.warningCount).toBe(2);
    expect(summaryJob.warnings[0]).toContain("[REDACTED]");
    expect(summaryJob).not.toHaveProperty("payload");
    expect(summaryJob.textRedactionApplied).toBe(true);
    expect(summaryJob.imageRedactionConfirmed).toBe(true);
    expect(summaryJob.imageContentVerified).toBe(false);
  });
});
