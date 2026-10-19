import { describe, expect, it } from "vitest";
import { createDeidentifiedSummarySnapshot } from "../lib/summary-snapshot";

describe("deidentified summary history snapshots", () => {
  it("stores redacted source text alongside the generated result", () => {
    const snapshot = createDeidentifiedSummarySnapshot(
      "HN: ABC123\nPatient name: Somchai Example\nDiagnosis: pneumonia",
      "Summary: pneumonia treated with antibiotics",
    );
    expect(snapshot).not.toBeNull();
    expect(snapshot).toContain("ข้อมูลต้นทาง");
    expect(snapshot).toContain("ผลสรุป");
    expect(snapshot).toContain("Diagnosis: pneumonia");
    expect(snapshot).not.toContain("ABC123");
    expect(snapshot).not.toContain("Somchai Example");
  });

  it("omits source when empty and bounds overlong snapshots", () => {
    expect(createDeidentifiedSummarySnapshot("", "result")).toContain("ผลสรุป");
    expect(createDeidentifiedSummarySnapshot("", "result")).toContain("ไม่ได้บันทึกข้อความต้นทาง");
    const snapshot = createDeidentifiedSummarySnapshot("source".repeat(10_000), "result".repeat(10_000));
    expect(snapshot?.length).toBeLessThanOrEqual(48_000);
    expect(snapshot).toContain("ถูกตัดให้สั้น");
  });
});
