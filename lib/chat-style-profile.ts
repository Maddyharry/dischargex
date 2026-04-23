import { prisma } from "@/lib/prisma";

export type ChatStyleProfile = {
  responseLength: "short" | "balanced" | "detailed";
  outputFormat: "auto" | "bullet" | "paragraph";
  tone: "neutral" | "formal" | "friendly";
};

const CHAT_STYLE_PROFILE_PREFIX = "chat_style_profile_v1:";

export const DEFAULT_CHAT_STYLE_PROFILE: ChatStyleProfile = {
  responseLength: "balanced",
  outputFormat: "auto",
  tone: "neutral",
};

function keyForUser(userId: string) {
  return `${CHAT_STYLE_PROFILE_PREFIX}${userId}`;
}

function sanitizeProfile(raw: unknown): ChatStyleProfile {
  const obj = (raw || {}) as Partial<ChatStyleProfile>;
  const responseLength =
    obj.responseLength === "short" || obj.responseLength === "balanced" || obj.responseLength === "detailed"
      ? obj.responseLength
      : DEFAULT_CHAT_STYLE_PROFILE.responseLength;
  const outputFormat =
    obj.outputFormat === "auto" || obj.outputFormat === "bullet" || obj.outputFormat === "paragraph"
      ? obj.outputFormat
      : DEFAULT_CHAT_STYLE_PROFILE.outputFormat;
  const tone =
    obj.tone === "neutral" || obj.tone === "formal" || obj.tone === "friendly"
      ? obj.tone
      : DEFAULT_CHAT_STYLE_PROFILE.tone;
  return { responseLength, outputFormat, tone };
}

export function mergeChatStyleProfile(base: ChatStyleProfile, patch?: Partial<ChatStyleProfile>) {
  return sanitizeProfile({ ...base, ...(patch || {}) });
}

export async function getUserChatStyleProfile(userId: string): Promise<ChatStyleProfile> {
  const row = await prisma.appSetting.findUnique({
    where: { key: keyForUser(userId) },
    select: { value: true },
  });
  if (!row?.value) return DEFAULT_CHAT_STYLE_PROFILE;
  try {
    return sanitizeProfile(JSON.parse(row.value));
  } catch {
    return DEFAULT_CHAT_STYLE_PROFILE;
  }
}

export async function setUserChatStyleProfile(userId: string, profile: ChatStyleProfile): Promise<ChatStyleProfile> {
  const next = sanitizeProfile(profile);
  await prisma.appSetting.upsert({
    where: { key: keyForUser(userId) },
    create: { key: keyForUser(userId), value: JSON.stringify(next) },
    update: { value: JSON.stringify(next) },
  });
  return next;
}

