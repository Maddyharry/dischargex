import { describe, expect, it } from "vitest";
import {
  isSensitiveAnalyticsPath,
  isPublicAnalyticsPageViewPath,
  isPublicKnowledgeDetailPath,
  shouldLoadGoogleTag,
  sanitizeAnalyticsLocation,
  sanitizeAnalyticsPath,
  buildSafePublicPageViewParameters,
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

  it("provides only sanitized GA page context and denies public page views on sensitive routes", () => {
    const pathname = sanitizeAnalyticsPath("/pricing?email=patient@example.test#case");
    expect({
      page_location: sanitizeAnalyticsLocation(pathname, "https://dischargex.example/?token=secret"),
      page_referrer: "",
    }).toEqual({ page_location: "https://dischargex.example/pricing", page_referrer: "" });
    expect(isSensitiveAnalyticsPath("/app/profile?session_id=cs_live_secret")).toBe(true);
    expect(isPublicAnalyticsPageViewPath("/pricing?email=private#checkout")).toBe(true);
    expect(isPublicAnalyticsPageViewPath("/knowledge/pneumonia")).toBe(true);
    expect(isPublicAnalyticsPageViewPath("/app/profile")).toBe(false);
  });

  it("allows only a single lowercase ASCII knowledge-detail slug and ignores query or hash variants", () => {
    expect(isPublicKnowledgeDetailPath("/knowledge/acute-heart-failure")).toBe(true);
    expect(isPublicAnalyticsPageViewPath("/knowledge/acute-heart-failure")).toBe(true);
    expect(isPublicAnalyticsPageViewPath("/knowledge/acute-heart-failure", "?hn=private", "#case-id")).toBe(true);
    expect(buildSafePublicPageViewParameters(
      "/knowledge/acute-heart-failure",
      "https://dischargex.example",
      "G-TEST",
    )).toEqual({
      send_to: "G-TEST",
      page_location: "https://dischargex.example/knowledge/acute-heart-failure",
      page_referrer: "",
    });

    for (const path of [
      "/knowledge",
      "/knowledge/admin",
      "/knowledge/admin-users",
      "/knowledge/Heart-Failure",
      "/knowledge/heart_failure",
      "/knowledge/not-a-static-topic",
      "/knowledge/heart-failure/extra",
    ]) {
      expect(isPublicKnowledgeDetailPath(path), path).toBe(false);
      expect(isSensitiveAnalyticsPath(path), path).toBe(true);
      expect(isPublicAnalyticsPageViewPath(path), path).toBe(false);
    }
  });

  it("keeps the Google tag unloaded without a consent choice or after rejection", () => {
    expect(shouldLoadGoogleTag("/knowledge/acute-heart-failure", null, true, false)).toBe(false);
    expect(shouldLoadGoogleTag("/knowledge/acute-heart-failure", {
      analytics: false,
      marketing: false,
      savedAt: "2026-10-27T00:00:00.000Z",
    }, true, false)).toBe(false);
    expect(shouldLoadGoogleTag("/knowledge/acute-heart-failure", {
      analytics: true,
      marketing: false,
      savedAt: "2026-10-27T00:00:00.000Z",
    }, true, false)).toBe(true);

    for (const path of ["/knowledge", "/guidelines", "/app", "/admin/users", "/auth/callback"]) {
      expect(shouldLoadGoogleTag(path, {
        analytics: true,
        marketing: true,
        savedAt: "2026-10-27T00:00:00.000Z",
      }, true, true), path).toBe(false);
    }
  });
});
