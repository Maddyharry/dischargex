import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  userFindUnique: vi.fn(),
  userFindFirst: vi.fn(),
  userUpdate: vi.fn(),
  referralFindMany: vi.fn(),
  referralFindUnique: vi.fn(),
  referralUpdateMany: vi.fn(),
  referralCreate: vi.fn(),
  referralCount: vi.fn(),
  ledgerFindMany: vi.fn(),
  transaction: vi.fn(),
  txReferralUpdateMany: vi.fn(),
  txUserUpdate: vi.fn(),
  txLedgerCreate: vi.fn(),
  notifyUser: vi.fn(),
}));

vi.mock("next-auth", () => ({ getServerSession: mocks.getSession }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("@/lib/notifications", () => ({ notifyUser: mocks.notifyUser }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: { findUnique: mocks.userFindUnique, findFirst: mocks.userFindFirst, update: mocks.userUpdate },
    referral: { findMany: mocks.referralFindMany, findUnique: mocks.referralFindUnique, updateMany: mocks.referralUpdateMany, create: mocks.referralCreate, count: mocks.referralCount },
    creditLedger: { findMany: mocks.ledgerFindMany },
    $transaction: mocks.transaction,
  },
}));

import { markReferralFirstPurchase, markReferralFirstUsage, getReferralDashboard, shouldAwardReferralForCheckout, shouldAwardReferralForPaidInvoice, claimReferralCode } from "../lib/referral";
import { GET } from "../app/api/referral/me/route";
import { POST as claimPost } from "../app/api/referral/claim/route";

const activeReferral = {
  id: "ref-1",
  referrerUserId: "owner-1",
  referredUserId: "friend-1",
  firstUsageAt: null,
  firstPurchaseAt: null,
  status: "active",
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getSession.mockResolvedValue(null);
  mocks.userFindUnique.mockResolvedValue({ id: "owner-1", referralCode: "DXABCDEFGH" });
  mocks.referralFindUnique.mockResolvedValue(activeReferral);
  mocks.referralUpdateMany.mockResolvedValue({ count: 1 });
  mocks.txReferralUpdateMany.mockResolvedValue({ count: 1 });
  mocks.txUserUpdate.mockResolvedValue({});
  mocks.txLedgerCreate.mockResolvedValue({});
  mocks.transaction.mockImplementation(async (callback: (tx: unknown) => unknown) => callback({
    referral: { updateMany: mocks.txReferralUpdateMany },
    user: { update: mocks.txUserUpdate },
    creditLedger: { create: mocks.txLedgerCreate },
  }));
  mocks.notifyUser.mockResolvedValue(undefined);
  mocks.referralFindMany.mockResolvedValue([]);
  mocks.ledgerFindMany.mockResolvedValue([]);
});

describe("referral reward policy", () => {
  it("records first usage with zero credit and no bonus notification", async () => {
    await markReferralFirstUsage("friend-1");
    expect(mocks.referralUpdateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "ref-1", firstUsageAt: null },
      data: expect.objectContaining({ firstUsageAt: expect.any(Date) }),
    }));
    expect(mocks.transaction).not.toHaveBeenCalled();
    expect(mocks.notifyUser).not.toHaveBeenCalled();
  });

  it("grants exactly 10 Boost passes once on first paid purchase", async () => {
    mocks.txReferralUpdateMany.mockResolvedValueOnce({ count: 1 }).mockResolvedValueOnce({ count: 0 });
    await markReferralFirstPurchase("friend-1");
    await markReferralFirstPurchase("friend-1");
    expect(mocks.txUserUpdate).toHaveBeenCalledTimes(1);
    expect(mocks.txUserUpdate).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "owner-1" },
      data: { extraCredits: { increment: 10 } },
    }));
    expect(mocks.txLedgerCreate).toHaveBeenCalledTimes(1);
    expect(mocks.txLedgerCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ sourceType: "referral", amount: 10, direction: "plus" }),
    }));
    expect(mocks.notifyUser).toHaveBeenCalledTimes(1);
    expect(mocks.notifyUser.mock.calls[0][0].message).toContain("Boost 10 สิทธิ์");
  });

  it.each(["suspicious", "blocked"])("does not grant for %s referrals", async (status) => {
    mocks.referralFindUnique.mockResolvedValue({ ...activeReferral, status });
    await markReferralFirstPurchase("friend-1");
    expect(mocks.transaction).not.toHaveBeenCalled();
    expect(mocks.notifyUser).not.toHaveBeenCalled();
  });

  it("preserves an already-granted legacy first-purchase bonus", async () => {
    mocks.referralFindUnique.mockResolvedValue({ ...activeReferral, purchaseCreditGranted: 60 });
    await markReferralFirstPurchase("friend-1");
    expect(mocks.transaction).not.toHaveBeenCalled();
    expect(mocks.notifyUser).not.toHaveBeenCalled();
  });

  it("allows referral grant only for a paid subscription checkout, never an add-on", () => {
    expect(shouldAwardReferralForCheckout("subscription", "paid", "new")).toBe(true);
    expect(shouldAwardReferralForCheckout("subscription", "paid", "renewal")).toBe(false);
    expect(shouldAwardReferralForCheckout("subscription", "paid", "upgrade")).toBe(false);
    expect(shouldAwardReferralForCheckout("subscription", "paid", "addon")).toBe(false);
    expect(shouldAwardReferralForCheckout("subscription", "no_payment_required", "plan")).toBe(false);
    expect(shouldAwardReferralForCheckout("payment", "paid", "addon")).toBe(false);
    expect(shouldAwardReferralForPaidInvoice("subscription_create", 10000)).toBe(true);
    expect(shouldAwardReferralForPaidInvoice("subscription_create", 0)).toBe(false);
    expect(shouldAwardReferralForPaidInvoice("subscription_cycle", 10000)).toBe(false);
  });

  it("allows one referrer to bind multiple distinct accounts, without immediate bonus", async () => {
    mocks.userFindFirst.mockResolvedValue({ id: "owner-1" });
    mocks.referralFindUnique.mockResolvedValue(null);
    mocks.referralCount.mockResolvedValue(0);
    mocks.referralCreate.mockResolvedValue({});
    await claimReferralCode({ referredUserId: "friend-1", referralCode: "dxabcdefgh" });
    await claimReferralCode({ referredUserId: "friend-2", referralCode: "dxabcdefgh" });
    expect(mocks.referralCreate).toHaveBeenCalledTimes(2);
    expect(mocks.referralCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ signupCreditGranted: 0, status: "active" }),
    }));
    expect(mocks.transaction).not.toHaveBeenCalled();
    expect(mocks.notifyUser).not.toHaveBeenCalled();
  });

  it("returns referral history without referred-user or anti-abuse PII", async () => {
    mocks.referralFindMany.mockResolvedValue([{
      id: "ref-1", status: "active", signupAt: new Date("2026-10-01T00:00:00Z"), firstUsageAt: null,
      firstPurchaseAt: new Date("2026-10-02T00:00:00Z"), signupCreditGranted: 0, usageCreditGranted: 25,
      purchaseCreditGranted: 10, referred: { name: "Private Name", email: "private@example.test" },
      claimedIp: "192.0.2.1", claimedUserAgent: "private-agent", adminNote: "private-note",
    }]);
    const dashboard = await getReferralDashboard("owner-1");
    expect(dashboard.stats).toEqual({ referredCount: 1, firstPurchases: 1, boostEarned: 35 });
    expect(dashboard.history[0]).not.toHaveProperty("referredName");
    expect(dashboard.history[0]).not.toHaveProperty("referredEmail");
    expect(dashboard.history[0]).not.toHaveProperty("claimedIp");
    expect(dashboard.history[0]).not.toHaveProperty("adminNote");
  });

  it("keeps referral responses private/no-store and exposes no friend identity", async () => {
    mocks.getSession.mockResolvedValue({ user: { email: "owner@example.test" } });
    mocks.referralFindMany.mockResolvedValue([{
      id: "ref-1", status: "active", signupAt: new Date(), firstUsageAt: null, firstPurchaseAt: null,
      signupCreditGranted: 0, usageCreditGranted: 0, purchaseCreditGranted: 0,
      referred: { name: "Private Name", email: "private@example.test" }, claimedIp: "192.0.2.1",
    }]);
    mocks.referralFindUnique.mockResolvedValue(null);
    const response = await GET();
    const body = await response.json();
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(JSON.stringify(body)).not.toContain("private@example.test");
    expect(JSON.stringify(body)).not.toContain("Private Name");
    expect(JSON.stringify(body)).not.toContain("192.0.2.1");
  });

  it("returns private no-store headers on unauthenticated GET and claim", async () => {
    const getResponse = await GET();
    const postResponse = await claimPost(new Request("http://localhost/api/referral/claim", { method: "POST", body: "{}" }));
    expect(getResponse.status).toBe(401);
    expect(postResponse.status).toBe(401);
    expect(getResponse.headers.get("cache-control")).toContain("no-store");
    expect(postResponse.headers.get("cache-control")).toContain("no-store");
  });

  it("returns private no-store headers after a successful claim", async () => {
    mocks.getSession.mockResolvedValue({ user: { email: "friend@example.test" } });
    mocks.userFindUnique.mockResolvedValue({ id: "friend-1" });
    mocks.userFindFirst.mockResolvedValue({ id: "owner-1" });
    mocks.referralFindUnique.mockResolvedValue(null);
    mocks.referralCount.mockResolvedValue(0);
    mocks.referralCreate.mockResolvedValue({});
    const response = await claimPost(new Request("http://localhost/api/referral/claim", {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ referralCode: "dxabcdefgh" }),
    }));
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toContain("no-store");
  });

  it("shows the +10 rule and copy-code control in profile", () => {
    const profile = readFileSync("app/app/profile/page.tsx", "utf8");
    expect(profile).toContain("Boost 10 สิทธิ์");
    expect(profile).toContain("คัดลอกรหัส");
    expect(profile).toContain("คัดลอกลิงก์ชวนเพื่อน");
    expect(profile).toContain("https://dischargex.net/signup?ref=");
    expect(profile).toContain("ส่งให้เพื่อนได้หลายคน");
    const signup = readFileSync("app/signup/page.tsx", "utf8");
    expect(signup).toContain('get("ref")');
    expect(signup).toContain("รหัสแนะนำ (ถ้ามี)");
    expect(signup).toContain("referralCode: referralCode.trim() || undefined");
    expect(signup).toContain("สมัครหรือทดลองใช้ฟรียังไม่ให้โบนัส");
  });
});
