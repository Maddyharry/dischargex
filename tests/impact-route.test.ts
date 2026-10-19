import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ feedbackFindMany: vi.fn(), usageLogFindMany: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: { feedback: { findMany: mocks.feedbackFindMany }, usageLog: { findMany: mocks.usageLogFindMany } } }));

import { GET } from "../app/api/impact/route";

const row = (id: string, status: string, data: unknown) => ({ id, status, payload: JSON.stringify(data) });

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("VERCEL_ENV", "production");
  mocks.usageLogFindMany.mockResolvedValue([]);
  mocks.feedbackFindMany.mockResolvedValue([]);
});

afterEach(() => vi.unstubAllEnvs());

describe("homepage impact endpoint", () => {
  it("counts successful Generate jobs from usage records, includes admin, and deduplicates by job id", async () => {
    mocks.usageLogFindMany.mockResolvedValue([
      { caseId: "admin-job", reason: "token_generate" },
      { caseId: "user-job", reason: "generate" },
      { caseId: "user-job", reason: "generate" },
      { caseId: null, reason: "generate" },
    ]);
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
      available: true, completedJobs: 2, timedJobs: 1, averageGenerationSeconds: 12,
      manualMinutesPerCase: 10, estimatedSavedMinutes: 9.8,
    });
    expect(mocks.usageLogFindMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ reason: { in: ["generate", "long_case_generate", "token_generate"] } }),
      orderBy: { id: "asc" },
      take: 1000,
      select: { id: true, caseId: true, reason: true },
    }));
    expect(mocks.feedbackFindMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ type: "summary_job", status: "completed" }),
      orderBy: { id: "asc" },
      take: 1000,
      select: { id: true, status: true, payload: true },
    }));
    expect(body.periodDays).toBeUndefined();
  });

  it("paginates beyond the old 30-day window and includes older retained production records", async () => {
    mocks.usageLogFindMany
      .mockResolvedValueOnce(Array.from({ length: 1000 }, (_, index) => ({ id: `usage-${index}`, caseId: `case-${index}`, reason: "generate" })))
      .mockResolvedValueOnce([{ id: "usage-old", caseId: "older-case", reason: "generate" }]);
    mocks.feedbackFindMany
      .mockResolvedValueOnce(Array.from({ length: 1000 }, (_, index) => row(`summary_${String(index).padStart(4, "0")}`, "completed", { production: false, mode: "generate" })))
      .mockResolvedValueOnce([row("summary_old", "completed", { production: true, mode: "generate", durationMs: 6000 })]);

    const response = await GET();
    expect(await response.json()).toMatchObject({ available: true, completedJobs: 1002, timedJobs: 1, averageGenerationSeconds: 6 });
    expect(mocks.usageLogFindMany).toHaveBeenCalledTimes(2);
    expect(mocks.usageLogFindMany).toHaveBeenLastCalledWith(expect.objectContaining({ cursor: { id: "usage-999" }, skip: 1 }));
    expect(mocks.feedbackFindMany).toHaveBeenCalledTimes(2);
  });

  it("does not publish a partial total when retained history exceeds the bounded scan", async () => {
    let pageNumber = 0;
    mocks.usageLogFindMany.mockImplementation(async () => {
      const page = Array.from({ length: 1000 }, (_, index) => ({
        id: `usage-${pageNumber}-${index}`,
        caseId: `case-${pageNumber}-${index}`,
        reason: "generate",
      }));
      pageNumber += 1;
      return page;
    });
    const response = await GET();
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ available: false });
    expect(mocks.usageLogFindMany).toHaveBeenCalledTimes(101);
  });

  it("shows a real zero when no successful Generate jobs were recorded", async () => {
    const response = await GET();
    expect(await response.json()).toMatchObject({ available: true, completedJobs: 0, averageGenerationSeconds: null });
  });

  it("reports unavailable instead of a misleading zero when log queries fail", async () => {
    mocks.usageLogFindMany.mockRejectedValue(new Error("database unavailable"));
    const response = await GET();
    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({ available: false });
  });

  it("does not use environment-ambiguous usage logs on preview deployments", async () => {
    vi.stubEnv("VERCEL_ENV", "preview");
    mocks.usageLogFindMany.mockResolvedValue([{ caseId: "preview-job", reason: "generate" }]);
    mocks.feedbackFindMany.mockResolvedValue([
      row("summary_preview-production-job", "completed", { production: true, mode: "generate", durationMs: 12_000 }),
    ]);
    const response = await GET();
    expect(await response.json()).toMatchObject({ available: true, completedJobs: 1 });
    expect(mocks.usageLogFindMany).not.toHaveBeenCalled();
  });
});
