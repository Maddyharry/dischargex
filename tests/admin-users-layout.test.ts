import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("admin users table layout", () => {
  const page = readFileSync("app/admin/users/page.tsx", "utf8");
  const headingMarkup = page.slice(page.indexOf("<thead"), page.indexOf("</thead>"));

  it("keeps the main table to eight decision-focused columns", () => {
    expect((headingMarkup.match(/<th\b/g) ?? [])).toHaveLength(8);
    for (const heading of ["ผู้ใช้", "แผน / สถานะ", "ใช้วันนี้ / เพดานรายวัน", "วงเงิน AI รอบแพ็กเกจ", "Boost", "ต้นทุน API ประเมิน", "วันจบรอบ", "จัดการ"]) {
      expect(headingMarkup).toContain(heading);
    }
    expect(headingMarkup).not.toMatch(/legacy|อุปกรณ์|สมัครเมื่อ|สะสม/);
    expect(page).toContain("min-w-[1320px]");
    expect(page).toContain("overflow-x-auto");
  });

  it("explains the old counter in per-user details", () => {
    expect(page).toContain("ดูรายละเอียด");
    expect(page).toContain("เครดิตรอบเดิม (หน่วยภายใน)");
    expect(page).toContain("120/420/1260 เป็นเครดิตภายใน ไม่ใช่จำนวนเคส");
    expect(page).toContain("วงเงินภายใน 3600 หน่วยร่วมกัน");
    expect(page).toContain("ไม่ใช่บาท");
  });

  it("preserves plan, role, quota, activity, delete, and Boost filter controls", () => {
    for (const control of [
      "สิทธิ์บัญชีของ", "แผนของ", "ปรับโควตา/วัน", "กิจกรรมเคส", "ซ่อนกิจกรรม", "openDeleteModal", "userFilter",
      "ผู้ใช้ทั้งหมด", "มีสิทธิ์คงเหลือ", "มีประวัติซื้อ/ใช้",
    ]) {
      expect(page).toContain(control);
    }
  });
});
