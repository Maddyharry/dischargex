export const PENDING_REFERRAL_CODE_KEY = "dischargex_pending_referral_code";

export function normalizeReferralCode(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const code = value.trim().toUpperCase();
  return /^[A-Z0-9]{2,32}$/.test(code) ? code : null;
}
