import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
describe("summary-first navigation", () => {
  it.each(["app/page.tsx", "app/pricing/page.tsx", "app/guidelines/page.tsx", "app/app/page.tsx", "app/summary-charge/page.tsx", "app/components/Header.tsx"])("does not promote retired chat in %s", file => {
    const text = readFileSync(file, "utf8");
    expect(text).not.toMatch(/href="\/chat"|AI Chat|Specialist Chat/);
  });
  it("redirects old chat links without deleting history", () => {
    expect(readFileSync("app/chat/page.tsx", "utf8")).toContain('redirect("/app")');
  });
});
