import { describe, expect, it } from "vitest";
import { commitSummaryUsageOnce, runBestEffortSideEffect } from "../lib/summary-idempotency";

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
});
