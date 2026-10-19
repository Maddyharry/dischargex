/**
 * Chat (specialist-chat, opd-assist chat) is disabled by default for the
 * productized launch — the product sells discharge-summary generation only.
 * Set NEXT_PUBLIC_FEATURE_CHAT=true to re-enable without code changes.
 */
export function isChatEnabled() {
  return process.env.NEXT_PUBLIC_FEATURE_CHAT === "true";
}

const CHAT_BLOCKED_PATH_PREFIXES = [
  "/chat",
  "/admin/chat",
  "/admin/opd-assist-lab",
  "/admin/opd-assist-logs",
  "/api/specialist-chat",
  "/api/chat-threads",
  "/api/chat-style",
  "/api/opd-assist",
  "/api/admin/chatbot-insights",
  "/api/admin/chatbot-reply",
  "/api/admin/chatbot-settings",
];

const CHAT_PROTECTED_PATH_PREFIXES = [
  ...CHAT_BLOCKED_PATH_PREFIXES,
  "/api/admin/chat/threads",
  "/api/admin/chat/messages",
  "/api/admin/chat/reply",
];

/**
 * The product's AI chat feature flag must not disable the separate, human
 * customer-support inbox endpoints under /api/admin/chat.
 */
export function isChatBlockedPath(pathname: string) {
  return CHAT_BLOCKED_PATH_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

export function isPathBlockedByChatFeature(pathname: string, chatEnabled = isChatEnabled()) {
  return !chatEnabled && isChatBlockedPath(pathname);
}

export function isChatProtectedPath(pathname: string) {
  return CHAT_PROTECTED_PATH_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}
