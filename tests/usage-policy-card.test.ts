import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import UsagePolicyCard from "../app/components/UsagePolicyCard";

describe("UsagePolicyCard", () => {
  it("wires policy mode and legacy counters from usage API into the profile card", () => {
    const profile = readFileSync("app/app/profile/page.tsx", "utf8");
    expect(profile).toContain("used={usage?.used ?? 0}");
    expect(profile).toContain("remaining={usage?.remaining ?? 0}");
    expect(profile).toContain("total={usage?.total ?? 0}");
    expect(profile).toContain("allowanceDisplayMode={usage?.periodAllowanceDisplayMode");
    const endpoint = readFileSync("app/api/usage/route.ts", "utf8");
    expect(endpoint).toContain('periodAllowanceDisplayMode: plan.isPaid ? (usesRevenue5x ? "ai_cost" : "legacy_units")');
  });

  it("renders precise Thailand-time daily and budget resets without throwing", () => {
    const markup = renderToStaticMarkup(createElement(UsagePolicyCard, {
      used: 0, remaining: 1260, total: 1260,
      summaryUsedToday: 2, summaryDailyLimit: 5,
      summaryResetAt: "2026-10-19T00:00:00.000Z", periodAllowanceResetAt: "2026-10-20T00:00:00.000Z",
      periodEnd: "2026-11-01T00:00:00.000Z", grandfathered: true,
      allowanceDisplayMode: "legacy_units",
      periodPercentUsed: 20, boostCredits: 3, active: true, canPurchaseBoost: true,
    }));
    expect(markup).toContain("รีเซ็ตรายวัน:");
    expect(markup).toContain("ใช้ไป 20%");
    expect(markup).toContain("ไม่ใช่จำนวนเคสหรือยอดเรียกเก็บจริง");
    expect(markup).not.toContain("1260");
    expect(markup).toContain("สิ้นสุดรอบแพ็กเกจ:");
    expect(markup).toContain("เงื่อนไขใหม่จึงเริ่มเมื่อรอบต่ออายุ");
    expect(markup).toContain("โควตารายวัน");
    expect(markup).toContain("2 / 5 เคส");
    expect(markup).toContain("เวลาไทย");
    expect(markup).toContain("฿109");
    expect(markup).toContain("฿299");
    expect(markup).toContain("Boost คงเหลือ");
  });

  it("does not render Boost purchase actions when the subscription or usage state is not eligible", () => {
    const markup = renderToStaticMarkup(createElement(UsagePolicyCard, {
      summaryUsedToday: 0, summaryDailyLimit: 2,
      summaryResetAt: null, periodAllowanceResetAt: null, periodEnd: null, grandfathered: false,
      used: 0, remaining: 0, total: 0, allowanceDisplayMode: "not_applicable",
      periodPercentUsed: null, boostCredits: 5,
      active: false, canPurchaseBoost: false,
    }));
    expect(markup).not.toContain("ซื้อ Boost");
    expect(markup).toContain("ข้อมูลวงเงิน AI ยังไม่พร้อมแสดง");
    expect(markup).not.toContain("1260");
  });

  it("does not show renewal/grandfather copy for a new-policy period", () => {
    const markup = renderToStaticMarkup(createElement(UsagePolicyCard, {
      summaryUsedToday: 1, summaryDailyLimit: 5, summaryResetAt: null,
      periodAllowanceResetAt: null, periodEnd: null, grandfathered: false,
      used: 0, remaining: 1260, total: 1260, allowanceDisplayMode: "ai_cost",
      periodPercentUsed: 0, boostCredits: 0, active: true, canPurchaseBoost: false,
    }));
    expect(markup).toContain("วงเงิน AI รอบนี้ (ประเมินตามปริมาณประมวลผล)");
    expect(markup).toContain("ใช้วงเงิน AI ไปแล้ว 0%");
    expect(markup).not.toContain("1260");
    expect(markup).not.toContain("หน่วยสิทธิ์รอบเดิม");
    expect(markup).not.toContain("เงื่อนไขเดิม");
  });
});
