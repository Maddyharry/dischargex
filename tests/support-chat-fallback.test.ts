import { afterEach, describe, expect, it, vi } from "vitest";

const { create } = vi.hoisted(() => ({ create: vi.fn() }));
vi.mock("next-auth", () => ({ getServerSession: vi.fn(async () => null) }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("@/lib/openai", () => ({ openai: { responses: { create } } }));
vi.mock("@/lib/chatbot-settings", () => ({ getChatbotKnowledge: vi.fn(async () => "safe test knowledge") }));
vi.mock("@/lib/prisma", () => ({ prisma: { user: { findUnique: vi.fn() }, feedback: { findFirst: vi.fn() } } }));

import { POST } from "../app/api/feedback/chat-reply/route";
import { FEEDBACK_AI_KNOWLEDGE } from "../lib/feedback-knowledge";
import { PRODUCT_HELP_CURRENT } from "../lib/product-help";

const outageReply = "ขออภัยครับ ขณะนี้บริการ AI ขัดข้องชั่วคราว ทีมงานกำลังตรวจสอบและแก้ไข กรุณาลองใหม่ภายหลัง หากยังพบปัญหา แจ้งเวลาและข้อความผิดพลาดได้ทางแชท โดยไม่ส่งข้อมูลผู้ป่วยครับ";

afterEach(() => {
  vi.unstubAllEnvs();
  create.mockReset();
});

describe("customer support guidance and deterministic outage fallback", () => {
  it("documents safe cancellation, API billing, and manual image redaction guidance", () => {
    const knowledge = `${FEEDBACK_AI_KNOWLEDGE}\n${PRODUCT_HELP_CURRENT}`;
    expect(knowledge).toContain("การเปลี่ยนผ่านเว็บไซต์มีผลในรอบชำระถัดไป");
    expect(knowledge).toContain("Stripe Billing Portal ผ่านเว็บไซต์ DischargeX");
    expect(knowledge).toContain("ไม่ต้องมีบัญชี Stripe แยก");
    expect(knowledge).toContain("ห้ามขอให้ลูกค้าเติมเงิน");
    expect(knowledge).toContain("QR code และ barcode");
    expect(knowledge).toContain("ระบบไม่สามารถตรวจยืนยันได้ว่าพิกเซล");
    expect(knowledge).toContain("ไม่ยกเลิกหน้าที่ด้านกฎหมาย");
  });

  it("returns the deterministic safe reply when the API key is missing", async () => {
    vi.stubEnv("OPENAI_API_KEY", "");
    const response = await POST(new Request("http://localhost/api/feedback/chat-reply", {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ message: "How do I cancel?" }),
    }) as never);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true, reply: outageReply, degraded: true });
    expect(create).not.toHaveBeenCalled();
  });

  it("hides provider quota and auth details when the upstream call fails", async () => {
    vi.stubEnv("OPENAI_API_KEY", "test-key");
    create.mockRejectedValueOnce(new Error("insufficient_quota; billing details"));
    const response = await POST(new Request("http://localhost/api/feedback/chat-reply", {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ message: "AI error" }),
    }) as never);
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body).toEqual({ ok: true, reply: outageReply, degraded: true });
    expect(JSON.stringify(body)).not.toMatch(/quota|billing|auth/i);
  });
});
