import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import UsagePolicyCard from "../app/components/UsagePolicyCard";

describe("UsagePolicyCard", () => {
  it("renders precise Thailand-time daily and budget resets without throwing", () => {
    const markup = renderToStaticMarkup(createElement(UsagePolicyCard, {
      used: 2, remaining: 8, total: 10,
      summaryUsedToday: 2, summaryDailyLimit: 5,
      summaryResetAt: "2026-10-19T00:00:00.000Z", periodEnd: "2026-10-20T00:00:00.000Z",
      periodPercentUsed: 20, boostCredits: 3, active: true, canPurchaseBoost: true,
    }));
    expect(markup).toContain("รีเซ็ตรายวัน:");
    expect(markup).toContain("รอบแพ็กเกจรีเซ็ต:");
    expect(markup).toContain("เวลาไทย");
    expect(markup).toContain("฿109");
    expect(markup).toContain("฿329");
    expect(markup).toContain("Boost คงเหลือ");
  });

  it("does not render Boost purchase actions when the subscription or usage state is not eligible", () => {
    const markup = renderToStaticMarkup(createElement(UsagePolicyCard, {
      used: 0, remaining: 0, total: 0, summaryUsedToday: 0, summaryDailyLimit: 2,
      summaryResetAt: null, periodEnd: null, periodPercentUsed: null, boostCredits: 5,
      active: false, canPurchaseBoost: false,
    }));
    expect(markup).not.toContain("ซื้อ Boost");
  });
});
