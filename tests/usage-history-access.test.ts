import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  userFindUnique: vi.fn(),
  usageFindMany: vi.fn(),
  usageFindFirst: vi.fn(),
  usageUpdateMany: vi.fn(),
}));

vi.mock("next-auth", () => ({ getServerSession: mocks.getSession }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: { findUnique: mocks.userFindUnique },
    usageLog: { findMany: mocks.usageFindMany, findFirst: mocks.usageFindFirst, updateMany: mocks.usageUpdateMany },
  },
}));

import { GET as getHistory } from "../app/api/usage/history/route";
import { DELETE as deleteSnapshot, GET as getSnapshot } from "../app/api/usage/snapshot/route";

const request = (method = "GET") => new Request("https://dischargex.net/api/usage/snapshot?logId=log-1", { method });

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getSession.mockResolvedValue({ user: { email: "user@example.test" } });
  mocks.userFindUnique.mockResolvedValue({ id: "user-1", plan: "basic_monthly" });
  mocks.usageFindMany.mockResolvedValue([{ id: "log-1", createdAt: new Date("2026-10-01T00:00:00Z"), creditsUsed: 1, summarySnapshot: "private text" }]);
  mocks.usageFindFirst.mockResolvedValue({ summarySnapshot: "private text" });
  mocks.usageUpdateMany.mockResolvedValue({ count: 1 });
});

describe("usage history snapshot access", () => {
  it("returns plan and access metadata without including snapshot content in history", async () => {
    const response = await getHistory(new Request("https://dischargex.net/api/usage/history"));
    const body = await response.json();
    expect(body).toMatchObject({ plan: "basic_monthly", canViewSnapshots: false, logs: [{ id: "log-1", hasSnapshot: true }] });
    expect(JSON.stringify(body)).not.toContain("private text");
  });

  it.each(["pro_monthly", "pro_yearly"])("allows Pro plan %s to view a snapshot", async (plan) => {
    mocks.userFindUnique.mockResolvedValue({ id: "user-1", plan });
    const response = await getSnapshot(request());
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ ok: true, text: "private text" });
  });

  it("blocks non-Pro snapshot reads before looking up the stored text", async () => {
    const response = await getSnapshot(request());
    expect(response.status).toBe(403);
    expect(JSON.stringify(await response.json())).not.toContain("private text");
    expect(mocks.usageFindFirst).not.toHaveBeenCalled();
  });

  it("allows the owner to delete a stored snapshot on any plan", async () => {
    const response = await deleteSnapshot(request("DELETE"));
    expect(response.status).toBe(200);
    expect(mocks.usageUpdateMany).toHaveBeenCalledWith({
      where: { id: "log-1", userId: "user-1" },
      data: { summarySnapshot: null },
    });
  });
});
