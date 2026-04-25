import { prisma } from "@/lib/prisma";

const TRIAL_EXPIRED_POLICY_KEY = "trial_expired_policy_v1";

export type TrialExpiredChatScope = "icd10_only" | "icd10_guidance";

export type TrialExpiredPolicy = {
  enabled: boolean;
  chatScope: TrialExpiredChatScope;
  allowOpdDemo: boolean;
  allowSummarize: boolean;
  forceFastModel: boolean;
};

export const DEFAULT_TRIAL_EXPIRED_POLICY: TrialExpiredPolicy = {
  enabled: true,
  chatScope: "icd10_only",
  allowOpdDemo: false,
  allowSummarize: false,
  forceFastModel: true,
};

function normalizePolicy(raw: unknown): TrialExpiredPolicy {
  if (!raw || typeof raw !== "object") return DEFAULT_TRIAL_EXPIRED_POLICY;
  const obj = raw as Record<string, unknown>;
  const chatScope = obj.chatScope === "icd10_guidance" ? "icd10_guidance" : "icd10_only";
  return {
    enabled: obj.enabled !== false,
    chatScope,
    allowOpdDemo: obj.allowOpdDemo === true,
    allowSummarize: obj.allowSummarize === true,
    forceFastModel: obj.forceFastModel !== false,
  };
}

export async function getTrialExpiredPolicy(): Promise<TrialExpiredPolicy> {
  try {
    const row = await prisma.appSetting.findUnique({
      where: { key: TRIAL_EXPIRED_POLICY_KEY },
      select: { value: true },
    });
    if (!row?.value) return DEFAULT_TRIAL_EXPIRED_POLICY;
    return normalizePolicy(JSON.parse(row.value));
  } catch {
    return DEFAULT_TRIAL_EXPIRED_POLICY;
  }
}

export async function setTrialExpiredPolicy(next: Partial<TrialExpiredPolicy>): Promise<TrialExpiredPolicy> {
  const current = await getTrialExpiredPolicy();
  const merged = normalizePolicy({ ...current, ...next });
  await prisma.appSetting.upsert({
    where: { key: TRIAL_EXPIRED_POLICY_KEY },
    update: { value: JSON.stringify(merged) },
    create: { key: TRIAL_EXPIRED_POLICY_KEY, value: JSON.stringify(merged) },
  });
  return merged;
}

export { TRIAL_EXPIRED_POLICY_KEY };
