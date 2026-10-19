import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  userFindUnique: vi.fn(),
  userCreate: vi.fn(),
  userFindFirst: vi.fn(),
  referralFindUnique: vi.fn(),
  referralCount: vi.fn(),
  referralCreate: vi.fn(),
  transaction: vi.fn(),
  adminAlert: vi.fn(),
}));

vi.mock("bcryptjs", () => ({ hash: vi.fn(async () => "hashed-password") }));
vi.mock("@/lib/app-origin", () => ({ getTrustedAppOrigin: () => "https://dischargex.net" }));
vi.mock("@/lib/admin-alert", () => ({ sendAdminAlertEmail: mocks.adminAlert }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: { findUnique: mocks.userFindUnique },
    $transaction: mocks.transaction,
  },
}));

import { POST } from "../app/api/auth/register/route";

function request(referralCode: string) {
  return new Request("https://dischargex.net/api/auth/register", {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": "203.0.113.8", "user-agent": "test-agent" },
    body: JSON.stringify({ email: "friend@example.test", password: "123456", referralCode }),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.userFindUnique.mockResolvedValue(null);
  mocks.userCreate.mockResolvedValue({ id: "friend-1" });
  mocks.userFindFirst.mockResolvedValue({ id: "referrer-1" });
  mocks.referralFindUnique.mockResolvedValue(null);
  mocks.referralCount.mockResolvedValue(0);
  mocks.referralCreate.mockResolvedValue({});
  mocks.adminAlert.mockResolvedValue(undefined);
  // claimReferralCode resolves the referrer through tx.user.findFirst.
  mocks.transaction.mockImplementation(async (callback: (tx: unknown) => unknown) => callback({
    user: { create: mocks.userCreate, findFirst: mocks.userFindFirst },
    referral: { findUnique: mocks.referralFindUnique, count: mocks.referralCount, create: mocks.referralCreate },
  }));
});

describe("registration referral transaction", () => {
  it("creates the account and binds referral together without granting a signup bonus", async () => {
    const response = await POST(request("DXABCDEFGH"));
    expect(response.status).toBe(200);
    expect(mocks.userCreate).toHaveBeenCalledOnce();
    expect(mocks.referralCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        referredUserId: "friend-1",
        referrerUserId: "referrer-1",
        claimedIp: "203.0.113.8",
        claimedUserAgent: "test-agent",
        signupCreditGranted: 0,
        status: "active",
      }),
    }));
    expect(JSON.stringify(await response.json())).not.toContain("Boost");
  });

  it("does not create an account when the referral code is invalid or unknown", async () => {
    mocks.userFindFirst.mockResolvedValue(null);
    const response = await POST(request("DXABCDEFGH"));
    expect(response.status).toBe(400);
    expect(mocks.referralCreate).not.toHaveBeenCalled();
    // A transaction implementation rejects its callback, so the created user is rolled back.
    expect(mocks.transaction).toHaveBeenCalledOnce();
  });

  it("rejects malformed referral codes before creating an account", async () => {
    const response = await POST(request("bad code!"));
    expect(response.status).toBe(400);
    expect(mocks.transaction).not.toHaveBeenCalled();
    expect(mocks.userCreate).not.toHaveBeenCalled();
  });
});
