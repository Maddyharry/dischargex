import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  formatAdminChatTimestamp,
  isChatScrollNearBottom,
  shouldAutoScrollToLatest,
} from "../lib/admin-chat-ui";
import { parseChatMessage } from "../lib/chat-message-format";

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

  it("keeps admin and customer chat composers visible inside a viewport-sized panel", () => {
    const widget = readFileSync("app/components/FeedbackWidget.tsx", "utf8");
    expect(widget).toContain("100dvh-env(safe-area-inset-top)-env(safe-area-inset-bottom)");
    expect(widget).toContain("grid-rows-[minmax(5rem,25%)_minmax(0,1fr)]");
    expect(widget).toContain('className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-3 space-y-3"');
    expect(widget.match(/shrink-0 border-t border-slate-700 p-3 pb-\[max\(0\.75rem,env\(safe-area-inset-bottom\)\)\]/g)).toHaveLength(2);
    expect(widget).not.toContain("min-h-[200px]");
  });

  it("parses bold markers and preserves every newline as separate text lines", () => {
    expect(parseChatMessage("สวัสดี **คุณหมอ**\n\nบรรทัดสอง")).toEqual([
      [
        { text: "สวัสดี ", bold: false },
        { text: "คุณหมอ", bold: true },
      ],
      [{ text: "", bold: false }],
      [{ text: "บรรทัดสอง", bold: false }],
    ]);
    expect(parseChatMessage("<img src=x onerror=alert(1)> **ไม่ปิด")).toEqual([
      [{ text: "<img src=x onerror=alert(1)> **ไม่ปิด", bold: false }],
    ]);
  });

  it("uses one safe formatted renderer and multiline composers on both chat sides", () => {
    const widget = readFileSync("app/components/FeedbackWidget.tsx", "utf8");
    expect(widget.match(/<ChatMessageBody message={m\.message} \/>/g)).toHaveLength(2);
    expect(widget.match(/<textarea\s+ref=\{(?:admin|customer)ComposerRef\}/g)).toHaveLength(2);
    expect(widget.match(/e\.key === "Enter" && \(e\.ctrlKey \|\| e\.metaKey\)/g)).toHaveLength(2);
    expect(widget).toContain("Math.min(e.currentTarget.scrollHeight, 160)");
    expect(widget).toContain('message: text,');
    expect(widget).not.toContain("dangerouslySetInnerHTML");
    expect(widget).toContain("<strong key={partIndex}");
    expect(widget).toContain("<br />");
  });

  it("exposes message editing only in the admin thread and only for admin-origin messages", () => {
    const widget = readFileSync("app/components/FeedbackWidget.tsx", "utf8");
    const adminView = widget.split(") : tab === \"chat\" ? (")[0];
    expect(adminView).toContain('m.source === "admin" ? (');
    expect(adminView).toContain("setEditingAdminMessageId(m.id)");
    expect(adminView).toContain('method: "PATCH"');
    expect(adminView).toContain("aria-label=\"แก้ไขข้อความที่ส่งให้ลูกค้า\"");
    expect(adminView).toContain("onClick={() => void saveAdminMessage(m.id)}");
    expect(widget.match(/<ChatMessageBody message={m\.message} \/>/g)).toHaveLength(2);
  });
});
