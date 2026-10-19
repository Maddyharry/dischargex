import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("workspace AdjRW controls", () => {
  const page = readFileSync("app/app/page.tsx", "utf8");

  it("does not render or retain the unavailable Thai DRG formula calculator", () => {
    expect(page).not.toContain("AdjRW จากสูตร Thai DRG 6.3.3");
    expect(page).not.toContain("Appendix H");
    expect(page).not.toContain("fetchAdjrwFromFormula");
    expect(page).not.toContain("formulaAdjrwResult");
    expect(page).not.toContain("คำนวณ AdjRW");
  });

  it("keeps the model's approximate AdjRW result", () => {
    expect(page).toContain('label="Adj RW (โมเดลประมาณการ)"');
    expect(page).toContain("AdjRW ที่คาด (ประมาณการ)");
  });
});
