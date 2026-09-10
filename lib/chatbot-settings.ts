import { prisma } from "@/lib/prisma";
import { FEEDBACK_AI_KNOWLEDGE } from "@/lib/feedback-knowledge";

const CHATBOT_KNOWLEDGE_KEY = "chatbot_knowledge_v1";

export async function getChatbotKnowledge(): Promise<string> {
  try {
    const row = await prisma.appSetting.findUnique({
      where: { key: CHATBOT_KNOWLEDGE_KEY },
      select: { value: true },
    });
    return (row?.value?.trim() || FEEDBACK_AI_KNOWLEDGE) + "\n\nข้อมูลผลิตภัณฑ์ล่าสุด (ใช้แทนคำแนะนำเส้นทางเดิม): ยกเลิกหน้า Specialist Chat /chat แล้ว ห้ามแนะนำให้คุยเคสกับ AI Chat ก่อน ให้ทดลองข้อมูลตัวอย่างที่ /app/guest หรือสร้างสรุปที่ /app ดูโปรแกรม Auto ที่ /downloads และคู่มือ /learn แชตช่วยเหลือยังใช้ตอบเรื่องการใช้งานและบัญชี ไม่รับข้อมูลผู้ป่วย";
  } catch {
    return FEEDBACK_AI_KNOWLEDGE;
  }
}

export async function setChatbotKnowledge(value: string): Promise<void> {
  const nextValue = value.trim();
  await prisma.appSetting.upsert({
    where: { key: CHATBOT_KNOWLEDGE_KEY },
    update: { value: nextValue || FEEDBACK_AI_KNOWLEDGE },
    create: { key: CHATBOT_KNOWLEDGE_KEY, value: nextValue || FEEDBACK_AI_KNOWLEDGE },
  });
}

export { CHATBOT_KNOWLEDGE_KEY };
