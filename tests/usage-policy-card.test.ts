import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import UsagePolicyCard from "../app/components/UsagePolicyCard";

describe("UsagePolicyCard", () => {
  it("renders precise Thailand-time daily and budget resets without throwing", () => {
    const markup = renderToStaticMarkup(createElement(UsagePolicyCard, {
      policy: {
        mode: "legacy_internal", capThb: 100, spendThb: 10, remainingThb: 90,
        resetAt: "2026-10-19T00:00:00.000Z", status: "active",
        costEstimate: { basis: "legacy_internal", status: "known", uncertainty: [] },
      },
      summaryUsedToday: 2, summaryDailyLimit: 10,
      summaryResetAt: "2026-10-19T00:00:00.000Z", paidPlan: true,
    }));
    expect(markup).toContain("รีเซ็ตสรุปรายวัน:");
    expect(markup).toContain("รอบงบรีเซ็ต:");
    expect(markup).toContain("เวลาไทย");
    expect(markup).toContain("หน่วยงบ AI");
    expect(markup).not.toContain("฿");
    expect(markup).toContain("ครั้งถัดไป");
  });
});
