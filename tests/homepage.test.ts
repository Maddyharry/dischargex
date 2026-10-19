import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

describe("homepage conversion content", () => {
  const page = readFileSync("app/page.tsx", "utf8");

  it("keeps a prominent no-signup sample CTA and uses the privacy-enhanced YouTube embed", () => {
    expect(page).toContain('const demoHref = "/app/guest?tutorial=1"');
    expect(page).toContain("ลองตัวอย่างทันที ไม่ต้องสมัคร");
    expect(page).toContain('src="https://www.youtube-nocookie.com/embed/_mIpiKuYrV4"');
    expect(page).toContain('title="วิดีโอแนะนำวิธีเริ่มใช้ DischargeX"');
    expect(page).toContain('referrerPolicy="strict-origin-when-cross-origin"');
    expect(page).toContain("allowFullScreen");
    expect(page).toContain("https://youtu.be/_mIpiKuYrV4?si=6-msUGWTH_9h4lQV");
  });

  it("restores the centered DischargeX brand hero and the original product explanation", () => {
    expect(page).toContain("Discharge<span className=\"bg-gradient-to-br from-cyan-300 to-sky-500 bg-clip-text text-transparent\">X</span>");
    expect(page).toContain("AI สำหรับสรุปชาร์จ · เวชระเบียน IPD · ทบทวน ICD-10");
    expect(page).toContain("สรุปชาร์จไวขึ้น");
    expect(page).toContain("จัดโครง coding เป็นระบบมากขึ้น");
    expect(page).toContain("discharge summary");
    expect(page).toContain("diagnosis");
    expect(page).toContain("procedure");
    expect(page).toContain("AdjRW");
    expect(page).toContain("ผลลัพธ์เป็นร่าง ข้อเสนอ หรือค่าประมาณ");
    expect(page).toContain("ไม่ใช่การรับรองผลการเบิกจ่าย");
  });

  it("keeps verifiable impact stats and avoids AI Chat marketing copy", () => {
    expect(page).toContain("<ImpactStats />");
    expect(readFileSync("app/components/ImpactStats.tsx", "utf8")).toContain("รวมงานของผู้ดูแลระบบโดยไม่หักโควตา");
    expect(page).not.toMatch(/AI\s*Chat|AI\s*แชท|แชท\s*AI/i);
  });
});
