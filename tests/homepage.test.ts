import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

describe("homepage conversion content", () => {
  const page = readFileSync("app/page.tsx", "utf8");

  it("keeps a prominent no-signup sample CTA and restores the getting-started video", () => {
    expect(page).toContain('const demoHref = "/app/guest?tutorial=1"');
    expect(page).toContain("ลองตัวอย่างทันที ไม่ต้องสมัคร");
    expect(page).toContain('src="/media/getting-started.mp4"');
    expect(page).toContain("controls playsInline preload=\"metadata\"");
  });

  it("keeps verifiable impact stats and avoids AI Chat marketing copy", () => {
    expect(page).toContain("<ImpactStats />");
    expect(readFileSync("app/components/ImpactStats.tsx", "utf8")).toContain("ทุกงานสรุป มีผลลัพธ์ที่ตรวจสอบได้");
    expect(page).not.toMatch(/AI\s*Chat|AI\s*แชท|แชท\s*AI/i);
  });
});
