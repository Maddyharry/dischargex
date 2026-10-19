import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ImpactStatsPanel } from "../app/components/ImpactStats";
import { readFileSync } from "node:fs";

describe("homepage usage statistics display", () => {
  it("keeps the panel and explicitly shows zero when there are no recorded jobs", () => {
    const markup = renderToStaticMarkup(<ImpactStatsPanel stats={{ available: true, completedJobs: 0, averageGenerationSeconds: null }} failed={false} />);
    expect(markup).toContain(">0 <span");
    expect(markup).toContain("ยังไม่มีงานสำเร็จในประวัติที่เก็บอยู่");
    expect(markup).toContain("ภาพรวมจากผู้ใช้งานทุกบัญชี");
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
    expect(markup).toContain("0 นาที 9 วินาที");
    expect(markup).toContain("เวลา Generate เฉลี่ย");
    expect(markup).toContain("ภาพรวมจากผู้ใช้งานทุกบัญชี");
    expect(markup).not.toContain("ประหยัด");
    expect(markup).not.toContain("10 นาที/เคส");
    expect(markup).toContain("ข้อมูลล่าสุด");
  });
});
describe("pricing quota clarity", () => {
  it("clearly distinguishes daily maximums, period budget, and Trial total on the pricing page", () => {
    const source = readFileSync("app/pricing/page.tsx", "utf8");
    expect(source).toContain("จำนวนครั้งสูงสุดที่กดสรุปได้ ไม่ใช่จำนวนเคสที่รับประกัน");
    expect(source).toContain("วงเงิน AI ต่อรอบบิลเป็นตัวกำหนดจำนวนเคสจริง");
    expect(source).toContain("รวม 5 เคสตลอดช่วงทดลอง สูงสุดวันละ 2 เคส");
    expect(source).toContain("Basic 15–18, Standard 30–35, Pro 55–65 เคสมาตรฐาน");
    expect(source).not.toContain(">15 เคส</td>");
    expect(source).not.toContain(">40 เคส</td>");
  });
});
