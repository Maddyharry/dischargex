import { prisma } from "@/lib/prisma";
import { FEEDBACK_AI_KNOWLEDGE } from "@/lib/feedback-knowledge";

const CHATBOT_KNOWLEDGE_KEY = "chatbot_knowledge_v1";

export async function getChatbotKnowledge(): Promise<string> {
  try {
    const row = await prisma.appSetting.findUnique({
      where: { key: CHATBOT_KNOWLEDGE_KEY },
      select: { value: true },
    });
    return row?.value?.trim() || FEEDBACK_AI_KNOWLEDGE;
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
