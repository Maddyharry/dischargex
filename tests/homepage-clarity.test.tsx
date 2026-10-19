import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ImpactStatsPanel } from "../app/components/ImpactStats";
import { ValueCalculator } from "../app/components/ValueCalculator";
import { calculateDailyTimeDifferenceMinutes, formatMinutesAsThaiDuration } from "../lib/value-calculator";

describe("homepage usage statistics display", () => {
  it("keeps the panel and explicitly shows zero when there are no recorded jobs", () => {
    const markup = renderToStaticMarkup(<ImpactStatsPanel stats={{ available: true, completedJobs: 0, averageGenerationSeconds: null }} failed={false} />);
    expect(markup).toContain(">0</strong>");
    expect(markup).toContain("ยังไม่มีรายการที่บันทึกได้ในช่วงเวลานี้");
    expect(markup).toContain("ข้อมูลจากการใช้งานจริง");
    expect(markup).not.toContain("0 วินาที");
  });

  it("shows the service problem instead of presenting an API error as zero usage", () => {
    const markup = renderToStaticMarkup(<ImpactStatsPanel stats={null} failed />);
    expect(markup).toContain("ตอนนี้ยังเชื่อมต่อข้อมูลสถิติไม่ได้");
    expect(markup).not.toContain(">0</strong>");
  });

  it("renders actual available values and the update timestamp", () => {
    const markup = renderToStaticMarkup(<ImpactStatsPanel stats={{ available: true, completedJobs: 24, averageGenerationSeconds: 8.6, updatedAt: "2026-10-19T06:30:00.000Z" }} failed={false} />);
    expect(markup).toContain("24");
    expect(markup).toContain("9 วินาที");
    expect(markup).toContain("ข้อมูลล่าสุด");
  });
});

describe("homepage time calculator", () => {
  it("explains the three inputs and what the result means in plain Thai", () => {
    const markup = renderToStaticMarkup(<ValueCalculator />);
    expect(markup).toContain("สรุปกี่เคสต่อวัน?");
    expect(markup).toContain("ตอนนี้ใช้เวลากี่นาทีต่อเคส?");
    expect(markup).toContain("ถ้าใช้ DischargeX คาดว่าจะใช้กี่นาที?");
    expect(markup).toContain("รวมเวลาที่คุณตรวจและแก้ร่างแล้ว");
    expect(markup).toContain("คำนวณเวลาต่อวัน");
    expect(markup).toContain("ผลจริงขึ้นกับแต่ละเคส");
  });

  it("calculates the difference from the user's own estimates", () => {
    expect(calculateDailyTimeDifferenceMinutes(10, 15, 8)).toBe(70);
    expect(formatMinutesAsThaiDuration(70)).toBe("1 ชั่วโมง 10 นาที");
    expect(calculateDailyTimeDifferenceMinutes(10, 8, 15)).toBe(-70);
  });
});
