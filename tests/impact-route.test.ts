import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ feedbackFindMany: vi.fn(), userAggregate: vi.fn(), usageLogFindMany: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: { feedback: { findMany: mocks.feedbackFindMany }, user: { aggregate: mocks.userAggregate }, usageLog: { findMany: mocks.usageLogFindMany } } }));

import { GET } from "../app/api/impact/route";

const row = (id: string, status: string, data: unknown) => ({ id, status, payload: JSON.stringify(data) });

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("VERCEL_ENV", "production");
  mocks.userAggregate.mockResolvedValue({ _sum: { totalGenerations: 439 } });
  mocks.feedbackFindMany.mockResolvedValue([]);
  mocks.usageLogFindMany.mockResolvedValue([{ caseId: null, reason: "generate" }]);
});

afterEach(() => vi.unstubAllEnvs());

describe("homepage impact endpoint", () => {
  it("uses the lifetime user aggregate, including legacy summaries without caseId logs", async () => {
    mocks.userAggregate.mockResolvedValue({ _sum: { totalGenerations: 439 } });
    // Legacy successful UsageLog entries can have null caseId; the lifetime aggregate
    // already includes them, so the public count must not depend on this log table.
    mocks.feedbackFindMany.mockResolvedValue([
      row("summary_admin-job", "completed", { production: true, mode: "generate", durationMs: 12_000 }),
      row("summary-failed", "failed", { production: true, mode: "generate", durationMs: 10_000 }),
      row("summary-recalc", "completed", { production: true, mode: "recalc", durationMs: 10_000 }),
      row("summary-legacy", "completed", { production: true, durationMs: 40_000 }),
      row("summary-local", "completed", { production: false, mode: "generate", durationMs: 8_000 }),
    ]);

    const response = await GET();
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toMatchObject({
      available: true, completedJobs: 439, timedJobs: 1, averageGenerationSeconds: 12,
      manualMinutesPerCase: 10, estimatedSavedMinutes: 9.8,
    });
    expect(mocks.userAggregate).toHaveBeenCalledWith({ _sum: { totalGenerations: true } });
    expect(mocks.usageLogFindMany).not.toHaveBeenCalled();
    expect(mocks.feedbackFindMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ type: "summary_job", status: "completed" }),
      orderBy: { id: "asc" },
      take: 1000,
      select: { id: true, status: true, payload: true },
    }));
    expect(body.periodDays).toBeUndefined();
  });

  it("paginates all timed production jobs while keeping the lifetime count independent of duration records", async () => {
    mocks.userAggregate.mockResolvedValue({ _sum: { totalGenerations: 1_234 } });
    mocks.feedbackFindMany
      .mockResolvedValueOnce(Array.from({ length: 1000 }, (_, index) => row(`summary_${String(index).padStart(4, "0")}`, "completed", { production: false, mode: "generate" })))
      .mockResolvedValueOnce([row("summary_old", "completed", { production: true, mode: "generate", durationMs: 6000 })]);

    const response = await GET();
    expect(await response.json()).toMatchObject({ available: true, completedJobs: 1_234, timedJobs: 1, averageGenerationSeconds: 6 });
    expect(mocks.feedbackFindMany).toHaveBeenCalledTimes(2);
    expect(mocks.feedbackFindMany).toHaveBeenLastCalledWith(expect.objectContaining({ cursor: { id: "summary_0999" }, skip: 1 }));
  });

  it("keeps the exact aggregate count and withholds a partial timing average when history exceeds the scan", async () => {
    let pageNumber = 0;
    mocks.feedbackFindMany.mockImplementation(async () => {
      const page = Array.from({ length: 1000 }, (_, index) => ({
        id: `summary_${pageNumber}-${index}`,
        status: "completed",
        payload: JSON.stringify({ production: true, mode: "generate", durationMs: 1000 }),
      }));
      pageNumber += 1;
      return page;
    });
    const response = await GET();
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      available: true,
      completedJobs: 439,
      durationAvailable: false,
      averageGenerationSeconds: null,
    });
    expect(mocks.feedbackFindMany).toHaveBeenCalledTimes(101);
  });

  it("keeps the lifetime count available if timing records cannot be read", async () => {
    mocks.userAggregate.mockResolvedValue({ _sum: { totalGenerations: 439 } });
    mocks.feedbackFindMany.mockRejectedValue(new Error("timing records unavailable"));
    const response = await GET();
    expect(await response.json()).toMatchObject({
      available: true,
      completedJobs: 439,
      durationAvailable: false,
      averageGenerationSeconds: null,
    });
  });

  it("shows a real zero when no successful Generate jobs were recorded", async () => {
    mocks.userAggregate.mockResolvedValue({ _sum: { totalGenerations: null } });
    const response = await GET();
    expect(await response.json()).toMatchObject({ available: true, completedJobs: 0, averageGenerationSeconds: null });
  });

  it("reports unavailable instead of a misleading zero when the lifetime aggregate query fails", async () => {
    mocks.userAggregate.mockRejectedValue(new Error("database unavailable"));
    const response = await GET();
    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({ available: false });
  });

  it("does not use environment-ambiguous usage logs on preview deployments", async () => {
    vi.stubEnv("VERCEL_ENV", "preview");
    mocks.userAggregate.mockResolvedValue({ _sum: { totalGenerations: 439 } });
    mocks.feedbackFindMany.mockResolvedValue([
      row("summary_preview-production-job", "completed", { production: true, mode: "generate", durationMs: 12_000 }),
    ]);
    const response = await GET();
    expect(await response.json()).toMatchObject({ available: true, completedJobs: 439 });
  });
});
