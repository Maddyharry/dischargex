import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const route = readFileSync("app/api/summarize/route.ts", "utf8");
const page = readFileSync("app/app/page.tsx", "utf8");

describe("summary reliability source contracts", () => {
  it("bounds long cases without silent truncation", () => {
    expect(route).toContain("const MAX_SUMMARY_CLINICAL_CHARS = 80_000");
    expect(route).toContain('errorCode: "SUMMARY_INPUT_TOO_LONG"');
    expect(route).toContain("ระบบไม่ได้ตัดข้อมูลออกให้อัตโนมัติ");
  });

  it("exposes truthful request progress stages in the UI", () => {
    for (const stage of ["preparing", "processing", "validating", "applying_results"]) {
      expect(page).toContain(`"${stage}"`);
    }
    expect(page).not.toContain('"sending"');
    expect(page).not.toContain('"saving"');
    expect(page).toContain("โดยไม่แสดงเปอร์เซ็นต์สมมติ");
  });

  it("keeps actionable model failure codes visible to the client", () => {
    for (const code of ["MODEL_EMPTY_OUTPUT", "MODEL_INVALID_JSON", "MODEL_REPAIR_INVALID_JSON", "PROVIDER_TIMEOUT"]) {
      expect(route).toContain(code);
    }
  });
});
