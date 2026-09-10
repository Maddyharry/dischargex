import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ user: vi.fn(), find: vi.fn(), count: vi.fn(), create: vi.fn() }));
vi.mock("@/lib/automator-auth", () => ({ automatorUser: mocks.user }));
vi.mock("@/lib/prisma", () => ({ prisma: { feedback: { findUnique: mocks.find, count: mocks.count, create: mocks.create } } }));
import { POST } from "../app/api/automator/incidents/route";
const report = { schema: 1, incidentId: "a".repeat(32), at: "2026-09-09T00:00:00Z", appVersion: "0.12.6", failure: 1, timeline: [], automaticResumeAllowed: false, windowsVersion: "10.0", screenWidth: 1920, screenHeight: 1080 };
function request(body: unknown = report, key = report.incidentId) {
  return new Request("https://dischargex.net/api/automator/incidents", { method: "POST", headers: { "Content-Type": "application/json", "Idempotency-Key": key }, body: JSON.stringify(body) });
}
beforeEach(() => { vi.resetAllMocks(); mocks.user.mockResolvedValue({ id: "test-user" }); mocks.find.mockResolvedValue(null); mocks.count.mockResolvedValue(0); mocks.create.mockResolvedValue({}); });
describe("incident API (mock storage, no patient data)", () => {
  it("requires authentication before touching storage", async () => { mocks.user.mockResolvedValue(null); expect((await POST(request())).status).toBe(401); expect(mocks.find).not.toHaveBeenCalled(); });
  it("acknowledges the exact report ID", async () => { const r = await POST(request()); expect(r.status).toBe(201); expect(await r.json()).toEqual({ incidentId: report.incidentId, status: "received" }); expect(mocks.create).toHaveBeenCalledOnce(); });
  it("rejects arbitrary identifying fields", async () => { expect((await POST(request({ ...report, patientName: "SYNTHETIC" }))).status).toBe(400); expect(mocks.create).not.toHaveBeenCalled(); });
  it("rejects a mismatched idempotency key", async () => { expect((await POST(request(report, "wrong"))).status).toBe(400); expect(mocks.create).not.toHaveBeenCalled(); });
  it("does not insert the same incident twice", async () => { mocks.find.mockResolvedValue({ id: "existing" }); expect((await POST(request())).status).toBe(200); expect(mocks.create).not.toHaveBeenCalled(); });
  it("isolates deduplication by account", async () => { await POST(request()); const first = mocks.find.mock.calls[0][0].where.id; mocks.user.mockResolvedValue({ id: "second-user" }); await POST(request()); expect(mocks.find.mock.calls[1][0].where.id).not.toBe(first); });
  it("limits incident submissions", async () => { mocks.count.mockResolvedValue(30); expect((await POST(request())).status).toBe(429); expect(mocks.create).not.toHaveBeenCalled(); });
  it("acknowledges a concurrent duplicate insert", async () => { mocks.create.mockRejectedValue({ code: "P2002" }); expect((await POST(request())).status).toBe(201); });
  it("does not report success on storage failure", async () => { mocks.create.mockRejectedValue(new Error("synthetic failure")); const r = await POST(request()); expect(r.status).toBe(503); expect(await r.text()).not.toContain("synthetic failure"); });
});
