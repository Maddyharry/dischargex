import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

describe("homepage matches the approved landing mockup", () => {
  const page = readFileSync("app/page.tsx", "utf8");
  const pricing = readFileSync("app/components/LandingPricingPreview.tsx", "utf8");

  it("places the tutorial video in the hero preview", () => {
    expect(page).toContain('src="https://www.youtube-nocookie.com/embed/_mIpiKuYrV4"');
    expect(page).toContain('title="วิดีโอแนะนำวิธีเริ่มใช้ DischargeX"');
    expect(page).toContain('referrerPolicy="strict-origin-when-cross-origin"');
    expect(page).toContain("allowFullScreen");
    expect(page).toContain("https://youtu.be/_mIpiKuYrV4?si=6-msUGWTH_9h4lQV");
    expect(page).not.toContain('id="video"');
    expect(page).not.toContain("ภาพตัวอย่างหน้าจอผลิตภัณฑ์");
    expect(page).not.toContain("Mockup สำหรับรีวิวเท่านั้น");
  });

  it("keeps the mockup layout, typography, palette, and core sections", () => {
    expect(page).toContain('import { Prompt } from "next/font/google"');
    expect(page).toContain('subsets: ["latin", "thai"]');
    expect(page).toContain('variable: "--font-prompt"');
    expect(page).toContain("สรุปชาร์จ");
    expect(page).toContain("ให้เป็น<span className={styles.gradientText}>ระเบียบ</span>");
    expect(page).toContain("ความสามารถหลัก");
    expect(page).toContain("ประโยชน์ของ DischargeX");
    expect(page).toContain('id="how-it-works"');
    expect(page).toContain('aria-label="ภาพรวมการใช้งาน"');
    expect(page).toContain("<LandingPricingPreview />");
    expect(page).toContain("ผลลัพธ์เป็นร่างสำหรับตรวจทานก่อนใช้งานจริง");
    expect(page).toContain("<LandingImpactStats />");
    expect(page).not.toContain("แสดงจากข้อมูลฝั่งเซิร์ฟเวอร์เมื่อเชื่อมระบบจริง");
  });

  it("keeps the approved trial, pricing, monthly/yearly toggle, and live destinations", () => {
    expect(page).toContain('const demoHref = "/app/guest?tutorial=1"');
    expect(page).toContain('href={demoHref}');
    expect(pricing).toContain('href="/signup"');
    expect(pricing).toContain('href="/pricing"');
    expect(pricing).toContain('onClick={() => setCycle(value)}');
    expect(pricing).toContain('aria-pressed={active}');
    expect(pricing).toContain('monthly: "299", yearly: "2,990"');
    expect(pricing).toContain('monthly: "590", yearly: "5,990"');
    expect(pricing).toContain('monthly: "1,090", yearly: "10,990"');
    expect(pricing).toContain("รวม 5 เคสตลอดช่วงทดลอง");
    expect(pricing).toContain("สูงสุด 2 เคสต่อวัน");
  });

  it("does not market discontinued features and retains review and privacy notices", () => {
    expect(page).not.toMatch(/AI\s*Chat|AI\s*แชท|แชท\s*AI/i);
    expect(page).not.toMatch(/Auto\s*(?:Chat|จ่าย|สรุป)|อัตโนมัติ(?:ทั้งหมด|ทุกขั้นตอน)/i);
    expect(page).toContain("ไม่ใช่ระบบวินิจฉัยหรือรับรองการจัดกลุ่ม DRG อย่างเป็นทางการ");
    expect(page).toContain("ตรวจทานข้อมูลก่อนส่ง AI");
  });
});
