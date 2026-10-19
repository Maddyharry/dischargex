import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("summary persistence and quota boundary", () => {
  const route = readFileSync("app/api/summarize/route.ts", "utf8");

  it("writes legacy token accounting before the transaction that consumes quota", () => {
    const ledgerWrite = route.indexOf('source: "summary_generate"');
    const quotaTransaction = route.indexOf("await prisma.$transaction(", ledgerWrite);
    expect(ledgerWrite).toBeGreaterThan(-1);
    expect(quotaTransaction).toBeGreaterThan(ledgerWrite);
  });

  it("persists only a bounded deidentified source/result snapshot with successful usage", () => {
    expect(route).toContain("createDeidentifiedSummarySnapshot(mergedRaw, exportText)");
    expect(route).toContain("...(summarySnapshot ? { summarySnapshot } : {})");
  });

  it("uses a stable client job id and checks existing committed usage inside the transaction", () => {
    expect(route).toContain("body.summaryJobId");
    expect(route).toContain("where: { userId, caseId: summaryJobId }");
    expect(route).toContain("commitSummaryUsageOnce");
    expect(route).toContain('errorCode: "SUMMARY_ALREADY_COMMITTED"');
  });

  it("limits snapshot deletion to the authenticated owner's usage log", () => {
    const snapshotRoute = readFileSync("app/api/usage/snapshot/route.ts", "utf8");
    expect(snapshotRoute).toContain("export async function DELETE");
    expect(snapshotRoute).toContain("where: { id: logId, userId: user.id }");
    expect(snapshotRoute).toContain("data: { summarySnapshot: null }");
  });
});
