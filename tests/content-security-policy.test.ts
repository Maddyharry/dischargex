import { describe, expect, it } from "vitest";
import { buildContentSecurityPolicy } from "../lib/content-security-policy";

function parseDirectives(policy: string) {
  return new Map(policy.split(";").map((directive) => {
    const [name, ...sources] = directive.trim().split(/\s+/);
    return [name, sources];
  }));
}

describe("Google Analytics CSP", () => {
  it("allows only the documented GA4 script and measurement hosts in production", () => {
    const directives = parseDirectives(buildContentSecurityPolicy(false));
    expect(directives.get("script-src")).toEqual(expect.arrayContaining([
      "'self'",
      "'unsafe-inline'",
      "https://www.googletagmanager.com",
    ]));
    expect(directives.get("connect-src")).toEqual(expect.arrayContaining([
      "https://www.googletagmanager.com",
      "https://*.google-analytics.com",
      "https://*.google.com",
    ]));
    expect(directives.get("img-src")).toEqual(expect.arrayContaining([
      "'self'",
      "data:",
      "blob:",
      "https://www.googletagmanager.com",
      "https://*.google-analytics.com",
    ]));
  });

  it("does not use broad wildcards, broad HTTPS sources, or advertising hosts", () => {
    const policy = buildContentSecurityPolicy(false);
    const directives = parseDirectives(policy);
    for (const name of ["script-src", "connect-src", "img-src"]) {
      const sources = directives.get(name) ?? [];
      expect(sources).not.toContain("*");
      expect(sources).not.toContain("https:");
    }
    expect(policy).not.toMatch(/googleadservices|doubleclick|googlesyndication|adservice/i);
  });

  it("keeps production free of unsafe-eval and limits it to development", () => {
    expect(parseDirectives(buildContentSecurityPolicy(false)).get("script-src")).not.toContain("'unsafe-eval'");
    expect(parseDirectives(buildContentSecurityPolicy(true)).get("script-src")).toContain("'unsafe-eval'");
  });

  it("preserves existing frame hosts without adding a Google Tag Manager frame", () => {
    expect(parseDirectives(buildContentSecurityPolicy(false)).get("frame-src")).toEqual([
      "'self'",
      "https://www.youtube.com",
      "https://www.youtube-nocookie.com",
    ]);
  });
});
