import { describe, expect, it } from "vitest";
import { assessPeriodRepair } from "../scripts/reconcile-stripe-period";

describe("assessPeriodRepair", () => {
  it("accepts a small UTC timestamp offset when the paid-through date extends by one day", () => {
    const oldStart = "2030-01-12 12:03:30.221";
    const oldEnd = "2030-02-11 12:03:30.221";
    const actualStart = Date.parse("2030-01-12T12:03:25.000Z") / 1000;
    const actualEnd = Date.parse("2030-02-12T12:03:25.000Z") / 1000;
    expect(assessPeriodRepair(oldStart, oldEnd, actualStart, actualEnd)).toMatchObject({
      oldStart: new Date("2030-01-12T12:03:30.221Z"),
      oldEnd: new Date("2030-02-11T12:03:30.221Z"),
      newStart: new Date("2030-01-12T12:03:25.000Z"),
      newEnd: new Date("2030-02-12T12:03:25.000Z"),
    });
  });

  it("rejects a non-extension, a difference over two days, and missing timestamps", () => {
    const oldStart = "2030-01-12 12:00:00.000";
    const oldEnd = "2030-02-11 12:00:00.000";
    const start = Date.parse("2030-01-12T12:00:00Z") / 1000;
    expect(assessPeriodRepair(oldStart, oldEnd, start, Date.parse(oldEnd.replace(" ", "T") + "Z") / 1000)).toBeNull();
    expect(assessPeriodRepair(oldStart, oldEnd, start, Date.parse("2030-02-14T12:00:00Z") / 1000)).toBeNull();
    expect(assessPeriodRepair(null, oldEnd, start, Date.parse("2030-02-12T12:00:00Z") / 1000)).toBeNull();
  });
});
