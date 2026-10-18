import { describe, expect, it } from "vitest";
import {
  isSensitiveAnalyticsPath,
  sanitizeAnalyticsLocation,
  sanitizeAnalyticsPath,
} from "@/app/components/GoogleTag";

describe("analytics route privacy helpers", () => {
  it.each([
    "/app",
    "/app/profile",
    "/admin/users",
    "/chat",
    "/login?next=/app",
    "/auth/callback",
    "/register?token=secret",
    "/signup",
    "/forgot-password",
    "/reset-password/token",
    "/api/feedback",
    "/summary-charge",
    "/icd10-review",
    "/automator",
    "/knowledge",
    "/guidelines",
  ])("marks sensitive route %s", (path) => {
    expect(isSensitiveAnalyticsPath(path)).toBe(true);
  });

  it.each(["/", "/pricing", "/about", "/application", "/administer"]) (
    "keeps marketing route %s outside the sensitive route filter",
    (path) => {
      expect(isSensitiveAnalyticsPath(path)).toBe(false);
    }
  );

  it("strips query strings and fragments from paths and page locations", () => {
    expect(sanitizeAnalyticsPath("/pricing?ref=patient-token#checkout")).toBe("/pricing");
    expect(
      sanitizeAnalyticsLocation(
        "/pricing?ref=patient-token#checkout",
        "https://dischargex.example/?campaign=secret#fragment"
      )
    ).toBe("https://dischargex.example/pricing");
  });
});
