import { describe, expect, it } from "vitest";
import { analyzeOpdCase } from "../lib/chartAssist/analyzeCase";

describe("analyzeOpdCase orderedProblemIds", () => {
  it("reorders layer2 and rebuilds layer1 when orderedProblemIds is provided", () => {
    const raw = "ผื่นขึ้นทั้งขา คันมาก ไอ น้ำมูก สองวันแล้ว";
    const baseline = analyzeOpdCase(raw, null);
    const ids = baseline.opdFramework.layer2.map((b) => b.id);
    expect(ids.length).toBeGreaterThanOrEqual(2);

    const reversed = [...ids].reverse();
    const reordered = analyzeOpdCase(raw, null, { orderedProblemIds: reversed });

    expect(reordered.opdFramework.layer2.map((b) => b.id)).toEqual(reversed);
    expect(reordered.appliedProblemOrder).toEqual(reversed);
    expect(reordered.opdFramework.layer1.problemListOrDx).not.toBe(baseline.opdFramework.layer1.problemListOrDx);
  });
});
