import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ feedbackFindMany: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: { feedback: { findMany: mocks.feedbackFindMany } } }));

import { GET } from "../app/api/impact/route";

const row = (id: string, status: string, data: unknown) => ({ id, status, payload: JSON.stringify(data) });

beforeEach(() => {
  vi.clearAllMocks();
});

describe("homepage impact endpoint", () => {
  it("counts each successful production Generate once, including admin jobs, and ignores failed, recalc, and retry rows", async () => {
    mocks.feedbackFindMany.mockResolvedValue([
      row("admin-generate-1", "completed", { production: true, mode: "generate", durationMs: 12_000 }),
      row("failed-1", "failed", { production: true, mode: "generate", durationMs: 10_000 }),
      row("recalc-1", "completed", { production: true, mode: "recalc", durationMs: 10_000 }),
      row("legacy-unknown-mode", "completed", { production: true, durationMs: 40_000 }),
      row("admin-generate-1", "completed", { production: true, mode: "generate", durationMs: 12_000 }),
      row("local-1", "completed", { production: false, mode: "generate", durationMs: 8_000 }),
    ]);

    const response = await GET();
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ available: true, completedJobs: 1, averageGenerationSeconds: 12 });
    expect(mocks.feedbackFindMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ type: "summary_job", status: "completed" }),
      select: { id: true, status: true, payload: true },
    }));
  });
});
