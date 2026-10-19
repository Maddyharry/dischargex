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
    expect(knowledge).toContain("Trial ทดลองได้ 1 ช่วงต่อบัญชีเป็นเวลา 14 วัน รวมสำเร็จได้ 5 เคสตลอดช่วง และจำกัดสูงสุด 2 เคสต่อวัน");
    expect(knowledge).toContain("Basic 5, Standard 10, Pro 20");
    expect(knowledge).toContain("Basic 15–18, Standard 30–35, Pro 55–65");
    expect(knowledge).toContain("5 สิทธิ์ ฿109");
    expect(knowledge).toContain("15 สิทธิ์ ฿299");
    expect(knowledge).toContain("ผู้แนะนำได้รับ Boost 10 สิทธิ์");
    expect(knowledge).toContain("การสมัคร ทดลองใช้ หรือกรอกรหัสอย่างเดียวไม่ให้โบนัส");
    expect(knowledge).toContain("ตัวเลข 120/420/1260 เป็นหน่วยสิทธิ์");
    expect(knowledge).toContain("ไม่ใช่จำนวนเคส");
    expect(knowledge).toContain("ประเมินต้นทุน API จากปริมาณ token");
    expect(knowledge).toContain("หลังระบบยืนยันการชำระเงินสำเร็จเท่านั้น");
    expect(knowledge).toContain("วงเงินเดิม 3600 เป็นหน่วยภายใน");
    expect(knowledge).toContain("snapshot ข้อความที่ผ่านการปกปิดแบบ best-effort ทุกแพ็กเกจ");
    expect(knowledge).toContain("ดูหรือ export ที่ /app/history ได้เฉพาะ Pro");
    expect(knowledge).toContain("ทุกแพ็กเกจลบข้อความที่เก็บไว้ได้");
    expect(knowledge).toContain("ไม่ใช่การรับรองการปฏิบัติตาม PDPA");
    expect(knowledge).toContain("หากการสร้างสรุปล้มเหลวก่อนบันทึกสำเร็จ");
    expect(knowledge).toContain("ผลิตภัณฑ์ AI Chat ยุติให้บริการแล้ว และ /chat จะนำไปยัง /app");
    expect(knowledge).toContain("ห้ามแนะนำ AI Chat หรือ /chat ให้ลูกค้า");
    expect(knowledge).not.toMatch(/(?:แนะนำ(?:ให้)?(?:ลูกค้า)?(?:ไปที่|ใช้|เปิด)|recommend(?: the)?).*\/chat/i);
  });

  it.each([
    ["Boost คืออะไร", "ถึงขีดจำกัดรายวันหรือรอบแพ็กเกจ", "1 สิทธิ์", "2 สิทธิ์"],
    ["บูส ราคาเท่าไหร่", "5 สิทธิ์ ฿109", "15 สิทธิ์ ฿299"],
    ["ซื้อ Boost ยังไง", "/app/profile", "ชำระ", "สำเร็จ"],
    ["How can I buy boost?", "5 สิทธิ์ ฿109", "/pricing"],
    ["ทำไม Boost ไม่หักอัตโนมัติ", "ไม่ถูกใช้เอง", "กด"],
    ["Can Boost bypass daily limit and period cap?", "ถึงขีดจำกัดรายวันหรือรอบแพ็กเกจ", "ไม่รีเซ็ต"],
    ["เคสยาวกับภาพใช้กี่ pass", "เคสยาว", "2 สิทธิ์"],
    ["Boost หมดอายุไหม", "ไม่มีตัวนับวันหมดอายุ", "active"],
    ["แพ็กเกจไม่ active ใช้ Boost ได้หรือเปล่า", "ไม่อนุญาต", "/app/profile"],
    ["ดูยอด Boost กับ history ที่ไหน", "/app/profile", "ประวัติ"],
    ["Referral ได้โบนัสอะไร", "Boost 10 สิทธิ์", "ไม่มีโบนัสตอนสมัคร", "active"],
    ["รีเฟอร์รัลเพื่อนได้อะไร", "Boost 10 สิทธิ์", "ไม่มีโบนัสตอนสมัคร"],
    ["How do I invite a friend with my referral code?", "/app/profile", "/signup?ref=CODE", "Boost 10 สิทธิ์", "ทดลองใช้"],
    ["เพื่อนกรอกรหัส referral ที่ไหน", "รหัสแนะนำ (ถ้ามี)", "/signup?ref=CODE", "ไม่มีโบนัสทันที"],
    ["Trial ได้วันละกี่เคส", "รวม 5 เคส", "14 วัน", "สูงสุดวันละ 2 เคส", "Basic 5", "Standard 10", "Pro 20", "วงเงิน AI", "ซื้อ Boost"],
    ["What is the daily quota per day?", "รวม 5 เคส", "14 วัน", "สูงสุดวันละ 2 เคส", "Basic 5", "Pro 20", "AI", "Boost"],
    ["ทำไมโควตาแพ็กเกจขึ้น 0 / 1260", "จำนวนครั้ง/เคส", "หน่วยสิทธิ์", "ไม่ใช่จำนวนเคส", "ลูกค้าเก่า", "Boost"],
    ["รอบบิล reset เมื่อไหร่", "วันสิ้นสุดรอบ", "/app/profile"],
    ["ถ้าสรุป error จะหักโควตาไหม", "ล้มเหลวก่อนระบบบันทึกผลสำเร็จ", "จะไม่ตัดโควตา", "ต้นทุน"],
    ["ปิดหน้าเว็บแล้วจะดูผลสรุปเก่าได้ไหม", "/app/history", "เฉพาะ Pro", "snapshot", "ทุกแพ็กเกจ", "best-effort", "ไม่รับประกัน", "ลบ"],
    ["AI error, service is down", "บริการ AI ขัดข้องชั่วคราว", "ไม่ส่งข้อมูลผู้ป่วย"],
    ["Can I paste patient data in support chat?", "อย่าส่งข้อมูลผู้ป่วย", "QR code", "/app"],
  ])("answers support intent without LLM: %s", async (message, ...phrases) => {
    vi.stubEnv("OPENAI_API_KEY", "");
    const response = await POST(new Request("http://localhost/api/feedback/chat-reply", {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ message }),
    }) as never);
    const body = await response.json();
    expect(response.status).toBe(200);
    for (const phrase of phrases) expect(body.reply).toContain(phrase);
    expect(body.reply).not.toMatch(/\/chat|AI Chat|Specialist Chat/i);
    expect(create).not.toHaveBeenCalled();
  });

  it("returns the deterministic safe reply when the API key is missing", async () => {
    vi.stubEnv("OPENAI_API_KEY", "");
    const response = await POST(new Request("http://localhost/api/feedback/chat-reply", {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ message: "How do I report an error?" }),
    }) as never);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true, reply: outageReply, degraded: true });
    expect(create).not.toHaveBeenCalled();
  });

  it.each(["ยกเลิกแพ็กเกจ", "อยากลดแพคเกจ", "ปรับแพ็กเกจและยกเลิกการต่ออายุ"])(
    "answers billing request %s completely without calling AI, even with no key",
    async (message) => {
      vi.stubEnv("OPENAI_API_KEY", "");
      const response = await POST(new Request("http://localhost/api/feedback/chat-reply", {
        method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ message }),
      }) as never);
      const body = await response.json();
      expect(response.status).toBe(200);
      expect(body.reply).toContain("/app/profile → Billing → เปลี่ยนแพ็กเกจ");
      expect(body.reply).toContain("รอบชำระถัดไป");
      expect(body.reply).toContain("ปุ่มจัดการ/ยกเลิกในส่วน Billing ของแอป");
      expect(body.reply).toContain("จนสิ้นสุดรอบปัจจุบัน");
      expect(body.reply).toContain("ยังไม่ได้ดำเนินการเปลี่ยนแปลงหรือยกเลิก");
      expect(body.degraded).toBeUndefined();
      expect(create).not.toHaveBeenCalled();
    },
  );

  it("uses a safe complete fallback for empty or truncated provider output", async () => {
    vi.stubEnv("OPENAI_API_KEY", "test-key");
    create.mockResolvedValueOnce({ output_text: "ได้ครับ" });
    const response = await POST(new Request("http://localhost/api/feedback/chat-reply", {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ message: "How do I report an error?" }),
    }) as never);
    expect(await response.json()).toEqual({ ok: true, reply: outageReply, degraded: true });
    expect(create).toHaveBeenCalledOnce();
  });

  it.each(["429 no credits remaining", "insufficient_quota", "https://platform.openai.com/settings/organization/billing/"])(
    "does not send known provider billing error %s to the model",
    async (message) => {
      vi.stubEnv("OPENAI_API_KEY", "test-key");
      const response = await POST(new Request("http://localhost/api/feedback/chat-reply", {
        method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ message }),
      }) as never);
      expect(await response.json()).toEqual({ ok: true, reply: outageReply, degraded: true });
      expect(create).not.toHaveBeenCalled();
    },
  );

  it("uses a safe fallback for a long response marked incomplete", async () => {
    vi.stubEnv("OPENAI_API_KEY", "test-key");
    create.mockResolvedValueOnce({ output_text: "คำตอบที่ดูยาวพอสมควรแต่ยังไม่จบประโยคและมีเนื้อหาบางส่วน", status: "incomplete", incomplete_details: { reason: "max_output_tokens" } });
    const response = await POST(new Request("http://localhost/api/feedback/chat-reply", {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ message: "How do I report a technical error?" }),
    }) as never);
    expect(await response.json()).toEqual({ ok: true, reply: outageReply, degraded: true });
  });

  it("answers pricing directly without treating it as a subscription action", async () => {
    vi.stubEnv("OPENAI_API_KEY", "test-key");
    create.mockResolvedValue({ output_text: "ขอรายละเอียดเพิ่มเติมได้ไหมครับ? ขอบคุณครับ" });
    for (const message of ["ยกเลิกยา"]) {
      const response = await POST(new Request("http://localhost/api/feedback/chat-reply", {
        method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ message }),
      }) as never);
      expect((await response.json()).degraded).toBeUndefined();
    }
    const pricing = await POST(new Request("http://localhost/api/feedback/chat-reply", {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ message: "ราคาแพ็กเกจเท่าไร" }),
    }) as never);
    expect((await pricing.json()).reply).toContain("Basic ฿299/เดือน");
    expect(create).toHaveBeenCalledTimes(1);
  });

  it("validates the request body before returning the no-key fallback", async () => {
    vi.stubEnv("OPENAI_API_KEY", "");
    const response = await POST(new Request("http://localhost/api/feedback/chat-reply", {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ message: "  " }),
    }) as never);
    expect(response.status).toBe(400);
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
