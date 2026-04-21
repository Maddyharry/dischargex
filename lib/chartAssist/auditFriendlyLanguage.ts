/**
 * Audit-friendly phrasing for AI-assisted clinical documentation (physician-facing).
 * Complements rule overlays — does not replace clinical judgment.
 */

export const AUDIT_FRIENDLY_LANGUAGE_RULES: string[] = [
  "ใช้ถ้อยคำแบบ \"พิจารณาได้ถ้า…\" / \"consider if…\" เมื่อยังไม่มีหลักฐานครบ — ไม่สรุปแน่นอนเกินข้อมูล",
  "ใช้ \"ถ้าตรวจพบ… แล้ว diagnosis สนับสนุนมากขึ้น\" — ผูกกับ finding ที่ต้องยืนยัน",
  "หลีกเลี่ยงความมั่นใจสังเคราะห์ (fabricated certainty) — ระบุ provisional / ข้อมูลยังไม่ครบเมื่อจริง",
  "แยกข้อเท็จจริงที่บันทึกแล้ว กับ inference — ไม่เติมผลตรวจ/วิตัลที่ไม่ได้วัด",
  "เหมาะสำหรับบันทึกตรวจสอบ (audit trail): rationale, ทางเลือกที่ยังเป็นไปได้, follow-up",
];

export function formatAuditFriendlyLanguageForAiPrompt(): string {
  return [
    "AUDIT_FRIENDLY_LANGUAGE (fixed rules for all clinical drafts):",
    ...AUDIT_FRIENDLY_LANGUAGE_RULES.map((x) => `- ${x}`),
  ].join("\n");
}
