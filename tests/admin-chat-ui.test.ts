import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  formatAdminChatTimestamp,
  isChatScrollNearBottom,
  shouldAutoScrollToLatest,
} from "../lib/admin-chat-ui";

describe("admin customer inbox behavior", () => {
  it("keeps the inbox APIs available when the separate AI chat feature is disabled", async () => {
    const { isChatProtectedPath, isPathBlockedByChatFeature } = await import("../lib/feature-flags");

    expect(isPathBlockedByChatFeature("/api/admin/chat/threads", false)).toBe(false);
    expect(isPathBlockedByChatFeature("/api/admin/chat/messages", false)).toBe(false);
    expect(isPathBlockedByChatFeature("/api/admin/chat/reply", false)).toBe(false);
    expect(isChatProtectedPath("/api/admin/chat/threads")).toBe(true);
    expect(isPathBlockedByChatFeature("/api/specialist-chat", false)).toBe(true);
    expect(isPathBlockedByChatFeature("/api/specialist-chat", true)).toBe(false);
  });

  it("only scrolls automatically for a forced action or when the user is near the latest message", () => {
    expect(shouldAutoScrollToLatest(true, false)).toBe(true);
    expect(shouldAutoScrollToLatest(false, true)).toBe(true);
    expect(shouldAutoScrollToLatest(false, false)).toBe(false);
  });

  it("detects the near-bottom threshold without moving an older-message reader", () => {
    expect(isChatScrollNearBottom({ scrollHeight: 1000, scrollTop: 850, clientHeight: 100 })).toBe(true);
    expect(isChatScrollNearBottom({ scrollHeight: 1000, scrollTop: 700, clientHeight: 100 })).toBe(false);
  });

  it("formats every message time in Thai locale and Bangkok timezone", () => {
    const timestamp = formatAdminChatTimestamp("2026-10-19T00:00:00.000Z");
    expect(timestamp).toContain("19 ต.ค. 2569");
    expect(timestamp).toContain("07:00");
    expect(formatAdminChatTimestamp("invalid")).toBe("เวลาไม่ถูกต้อง");
  });

  it("renders message timestamps as semantic time elements in the admin inbox", () => {
    const widget = readFileSync("app/components/FeedbackWidget.tsx", "utf8");
    expect(widget).toContain('<time dateTime={m.createdAt}');
    expect(widget).toContain("formatAdminChatTimestamp(m.createdAt)");
    expect(widget).toContain("onScroll={() => {");
  });
});
