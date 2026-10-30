import { describe, expect, it } from "vitest";
import { commitSummaryUsageOnce, runBestEffortSideEffect, upsertSummaryJobCompleted } from "../lib/summary-idempotency";

describe("summary commit behavior", () => {
  it("does not consume quota or add another usage record for an already committed job", async () => {
    const committedJobs = new Set<string>(["user-1:job-1"]);
    let baseQuota = 4;
    let boostQuota = 2;
    let usageRows = 1;
    const commit = async () => commitSummaryUsageOnce({
      findExisting: async () => committedJobs.has("user-1:job-1"),
      commit: async () => {
        baseQuota -= 1;
        boostQuota -= 1;
        usageRows += 1;
      },
    });

    expect(await commit()).toBe(false);
    expect({ baseQuota, boostQuota, usageRows }).toEqual({ baseQuota: 4, boostQuota: 2, usageRows: 1 });
  });

  it("does not propagate a post-commit ancillary failure to the summary response", async () => {
    let responseReady = false;
    responseReady = await commitSummaryUsageOnce({
      findExisting: async () => false,
      commit: async () => { responseReady = true; },
    });
    await runBestEffortSideEffect(async () => { throw new Error("telemetry offline"); });
    expect(responseReady).toBe(true);
  });

  it("updates failed metadata to completed for the same job without creating a duplicate", async () => {
    let status = "failed";
    let creates = 0;
    await upsertSummaryJobCompleted({
      updateIncomplete: async () => {
        if (status === "completed") return 0;
        status = "completed";
        return 1;
      },
      create: async () => { creates += 1; },
    });
    expect({ status, creates }).toEqual({ status: "completed", creates: 0 });
  });

  it("recovers from an insert race by completing the existing failed row", async () => {
    let status = "failed";
    let attempts = 0;
    await upsertSummaryJobCompleted({
      updateIncomplete: async () => {
        if (attempts++ === 0) return 0;
        status = "completed";
        return 1;
      },
      create: async () => { throw new Error("unique constraint"); },
    });
    expect(status).toBe("completed");
  });
});
