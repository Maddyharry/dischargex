import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { fetchHeaderUsage, getHeaderUsageRows, mapHeaderUsage } from "../lib/header-usage";

const usagePayload = {
  ok: true,
  plan: "basic_monthly",
  summaryUsedToday: 4,
  summaryDailyLimit: 5,
  nextDailyResetAt: "2026-11-03T00:00:00.000Z",
  periodAllowancePercentUsed: 63,
  periodAllowanceResetAt: "2026-11-30T17:00:00.000Z",
  usagePolicyKnown: true,
  periodAllowanceReached: false,
  extraCredits: 2,
  subscriptionStatus: "active",
};

describe("account menu usage data", () => {
  it("maps the exact /api/usage field names and renders separate daily and package rows", () => {
    const usage = mapHeaderUsage(usagePayload);
    expect(usage).toMatchObject({
      summaryUsedToday: 4,
      summaryDailyLimit: 5,
      nextDailyResetAt: usagePayload.nextDailyResetAt,
      periodAllowancePercentUsed: 63,
      periodAllowanceResetAt: usagePayload.periodAllowanceResetAt,
      usagePolicyKnown: true,
      periodAllowanceReached: false,
      extraCredits: 2,
      subscriptionStatus: "active",
    });

    const rows = getHeaderUsageRows(usage);
    const dailyReset = new Date(usagePayload.nextDailyResetAt).toLocaleString("th-TH", {
      dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Bangkok",
    });
    const periodReset = new Date(usagePayload.periodAllowanceResetAt).toLocaleString("th-TH", {
      dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Bangkok",
    });
    expect(rows[0]).toEqual({ label: "โควตารายวัน", value: `4/5 เคส · รีเซ็ต ${dailyReset}` });
    expect(rows[1]).toEqual({ label: "วงเงิน AI รอบแพ็กเกจ", value: `ใช้ไป 63% · รีเซ็ต ${periodReset}` });
    expect(rows[2]).toEqual({ label: "Boost", value: "2 สิทธิ์" });
  });

  it("shows an honest unavailable package-allowance value when usage policy is unknown", () => {
    const usage = mapHeaderUsage({ ...usagePayload, usagePolicyKnown: false, periodAllowancePercentUsed: null });
    const rows = getHeaderUsageRows(usage);
    expect(rows[1]).toEqual({ label: "วงเงิน AI รอบแพ็กเกจ", value: "ไม่พร้อมแสดงข้อมูล" });
  });

  it("fetches fresh private usage without browser caching", async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify(usagePayload), { status: 200 })) as unknown as typeof fetch;
    await fetchHeaderUsage("trial", fetcher);
    expect(fetcher).toHaveBeenCalledWith("/api/usage", { cache: "no-store" });
  });

  it("refreshes on dropdown open and usage-updated while deduplicating in-flight fetches", () => {
    const source = readFileSync("app/components/Header.tsx", "utf8");
    expect(source).toContain("if (menuOpen) void refreshUsage();");
    expect(source).toContain('window.addEventListener("usage-updated", onUsageUpdated)');
    expect(source).toContain("if (usageRequestRef.current) return usageRequestRef.current;");
  });
});
