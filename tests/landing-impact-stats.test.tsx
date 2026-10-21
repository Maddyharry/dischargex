import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { LandingImpactStatsPanel } from "../app/components/LandingImpactStats";

describe("landing page live impact statistics", () => {
  it("shows loading status in the existing two statistic cards", () => {
    const markup = renderToStaticMarkup(<LandingImpactStatsPanel state="loading" stats={null} />);
    expect(markup.match(/กำลังโหลด…/g)).toHaveLength(2);
    expect(markup).toContain("ผลการใช้งานจริง");
    expect(markup).toContain("ระยะเวลา Generate");
  });

  it("distinguishes a real zero from missing timing data", () => {
    const markup = renderToStaticMarkup(<LandingImpactStatsPanel state="ready" stats={{ available: true, completedJobs: 0, averageGenerationSeconds: null }} />);
    expect(markup).toContain(">0 <span>งาน</span>");
    expect(markup).toContain("ยังไม่มีงานสำเร็จในประวัติที่เก็บอยู่");
    expect(markup).toContain("ยังไม่มีข้อมูลงานที่บันทึกเวลาไว้");
    expect(markup).not.toContain("0 นาที 0 วินาที");
  });

  it("shows actual totals, average server generation time, and no sample count", () => {
    const markup = renderToStaticMarkup(<LandingImpactStatsPanel state="ready" stats={{ available: true, completedJobs: 439, averageGenerationSeconds: 66.558, updatedAt: "2026-10-19T06:30:00.000Z" }} />);
    expect(markup).toContain("439");
    expect(markup).toContain("1 นาที 7 วินาที");
    expect(markup).toContain("เฉพาะงานที่มีข้อมูลเวลา Generate");
    expect(markup).not.toMatch(/เฉลี่ยจาก\s*\d+/);
    expect(markup).toContain("ข้อมูลล่าสุด");
  });

  it("does not turn unavailable server data into zero", () => {
    const markup = renderToStaticMarkup(<LandingImpactStatsPanel state="unavailable" stats={null} />);
    expect(markup.match(/ยังโหลดข้อมูลไม่ได้/g)).toHaveLength(2);
    expect(markup).not.toContain(">0 <span>งาน</span>");
  });
});
