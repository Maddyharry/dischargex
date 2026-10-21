import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

describe("homepage conversion content", () => {
  const page = readFileSync("app/page.tsx", "utf8");

  it("places the privacy-enhanced tutorial video in the hero with a fallback link", () => {
    expect(page).toContain('const demoHref = "/app/guest?tutorial=1"');
    expect(page).toContain("ลองตัวอย่างทันที ไม่ต้องสมัคร");
    expect(page).toContain('src="https://www.youtube-nocookie.com/embed/_mIpiKuYrV4"');
    expect(page).toContain('title="วิดีโอแนะนำวิธีเริ่มใช้ DischargeX"');
    expect(page).toContain('referrerPolicy="strict-origin-when-cross-origin"');
    expect(page).toContain("allowFullScreen");
    expect(page).toContain("https://youtu.be/_mIpiKuYrV4?si=6-msUGWTH_9h4lQV");
    expect(page).toContain("ดูวิธีใช้งานก่อนเริ่มทดลอง");
    expect(page).not.toContain('id="video"');
  });

  it("presents the approved product hero using the bundled Prompt font and keeps pricing", () => {
    expect(page).toContain('import { Prompt } from "next/font/google"');
    expect(page).toContain('subsets: ["latin", "thai"]');
    expect(page).toContain("prompt.className");
    expect(page).toContain("ผู้ช่วยจัดร่างสรุปชาร์จและทบทวน coding สำหรับ IPD");
    expect(page).toContain("จัดร่างให้เป็นระบบ");
    expect(page).toContain("ตรวจทานได้ชัดเจน");
    expect(page).toContain("ลองตัวอย่างทันที ไม่ต้องสมัคร");
    expect(page).toContain('href={demoHref}');
    expect(page).not.toContain("dischargex-real-app.png");
    expect(page).not.toContain("ภาพตัวอย่างหน้าจอผลิตภัณฑ์");
    expect(page).toContain("<LandingPricingPreview />");
    expect(page).toContain('from "./components/LandingPricingPreview"');
    expect(page).toContain("discharge summary");
    expect(page).toContain("diagnosis");
    expect(page).toContain("coding");
  });

  it("does not market discontinued features or unreconciled impact stats, and keeps disclaimers", () => {
    expect(page).not.toMatch(/AI\s*Chat|AI\s*แชท|แชท\s*AI/i);
    expect(page).not.toMatch(/Auto\s*(?:Chat|จ่าย|สรุป)|อัตโนมัติ(?:ทั้งหมด|ทุกขั้นตอน)/i);
    expect(page).not.toContain("<ImpactStats />");
    expect(page).not.toContain('import ImpactStats');
    expect(page).toContain("ผลลัพธ์เป็นร่างสำหรับตรวจทาน");
    expect(page).toContain("ไม่ใช่การวินิจฉัย");
    expect(page).toContain("การรับรอง DRG อย่างเป็นทางการ");
    expect(page).toContain("หรือการรับประกันผลเบิกจ่าย");
    expect(page).toContain("ตรวจสอบความถูกต้องกับเวชระเบียนต้นทาง");
    expect(page).toContain("ไม่ได้รับรองการลบข้อมูลระบุตัวตน");
    expect(page).toContain("การรับรอง PDPA");
  });
});
