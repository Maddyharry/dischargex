/**
 * Chat (specialist-chat, opd-assist chat) is disabled by default for the
 * productized launch — the product sells discharge-summary generation only.
 * Set NEXT_PUBLIC_FEATURE_CHAT=true to re-enable without code changes.
 */
export function isChatEnabled() {
  return process.env.NEXT_PUBLIC_FEATURE_CHAT === "true";
}
