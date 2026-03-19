"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { useFeedbackContext } from "@/app/context/FeedbackContext";

type ChatMessage = {
  id: string;
  message: string;
  createdAt: string;
  isBot?: boolean;
};

const FALLBACK_REPLY =
  "ขอบคุณที่ติดต่อครับ เราได้รับข้อความแล้ว จะตรวจสอบและตอบกลับโดยเร็วที่สุด หากเป็นการแจ้งข้อผิดพลาด ทีมงานจะนำข้อมูลไปใช้ปรับปรุงระบบครับ";

function looksLikeErrorReport(message: string): boolean {
  const t = message.toLowerCase().trim();
  const keywords = [
    "ผิดพลาด", "บัค", "bug", "ไม่ทำงาน", "ค้าง", "error", "แจ้งข้อผิดพลาด",
    "ผิดปกติ", "มีปัญหา", "ใช้ไม่ได้", "เสีย", "หลุด", "ไม่ตรง", "ผิด",
  ];
  return keywords.some((k) => t.includes(k));
}

function botReplyAsksForAttachment(message: string): boolean {
  const t = message;
  return (
    t.includes("รายงานนี้จะอยู่ในรายการ") ||
    t.includes("แนบมาด้วย") ||
    t.includes("แนบรูป") ||
    t.includes("สกรีนช็อต") ||
    t.includes("order sheet") ||
    t.includes("ผลสรุป")
  );
}

type Tab = "chat" | "report";

export function FeedbackWidget() {
  const { workspaceSnapshot, feedbackOpen, feedbackTab, setFeedbackOpen, setFeedbackTab } = useFeedbackContext();
  const open = feedbackOpen;
  const setOpen = setFeedbackOpen;
  const tab: Tab = feedbackTab === "report" ? "report" : "chat";
  const setTab = useCallback((t: Tab) => setFeedbackTab(t), [setFeedbackTab]);

  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const [reportDesc, setReportDesc] = useState("");
  const [reportIncludeWorkspace, setReportIncludeWorkspace] = useState(true);
  const [reportFile, setReportFile] = useState<File | null>(null);
  const [reportSending, setReportSending] = useState(false);
  const [reportSent, setReportSent] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadChat = useCallback(async () => {
    try {
      setLoadError(null);
      const res = await fetch("/api/feedback?type=chat");
      const data = await res.json();
      if (!data.ok) {
        setLoadError(data.error || "โหลดประวัติไม่สำเร็จ");
        return;
      }
      const list: ChatMessage[] = (data.messages || []).map((m: { id: string; message: string; createdAt: string; isBot?: boolean }) => ({
        id: m.id,
        message: m.message,
        createdAt: m.createdAt,
        isBot: m.isBot === true,
      }));
      setChatMessages(list);
    } catch {
      setLoadError("โหลดประวัติไม่สำเร็จ");
    }
  }, []);


  useEffect(() => {
    if (open && tab === "chat") void loadChat();
  }, [open, tab, loadChat]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  async function sendReport() {
    const text = reportDesc.trim();
    if (!text || reportSending) return;
    setReportSending(true);
    try {
      let screenshotBase64: string | undefined;
      if (reportFile) {
        const buf = await reportFile.arrayBuffer();
        const bytes = new Uint8Array(buf);
        let binary = "";
        for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
        const b64 = typeof btoa !== "undefined" ? btoa(binary) : "";
        if (b64.length < 3_000_000) screenshotBase64 = b64;
      }
      const payloadObj: Record<string, unknown> = {};
      if (screenshotBase64) payloadObj.screenshot = screenshotBase64;
      if (reportIncludeWorkspace && workspaceSnapshot) {
        payloadObj.workspace = workspaceSnapshot;
      }
      const payload = Object.keys(payloadObj).length > 0 ? JSON.stringify(payloadObj) : undefined;

      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "error_report", message: text, payload }),
      });
      const data = await res.json();
      if (!data.ok) {
        alert(data.error || "ส่งไม่สำเร็จ");
        return;
      }
      setReportSent(true);
      setReportDesc("");
      setReportFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch {
      alert("ส่งไม่สำเร็จ กรุณาลองใหม่");
    } finally {
      setReportSending(false);
    }
  }

  async function sendChat() {
    const text = chatInput.trim();
    if (!text || chatLoading) return;
    setChatLoading(true);
    setChatInput("");
    const userMsgId = `user-${Date.now()}`;
    const botId = `bot-${Date.now()}`;
    setChatMessages((prev) => [...prev, { id: userMsgId, message: text, createdAt: new Date().toISOString(), isBot: false }]);

    try {
      const saveRes = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "chat", message: text }),
      });
      const saveData = await saveRes.json();
      if (!saveData.ok) {
        setChatMessages((prev) => [
          ...prev,
          { id: botId, message: saveData.error || "บันทึกข้อความไม่สำเร็จ", createdAt: new Date().toISOString(), isBot: true },
        ]);
        return;
      }

      // ถ้าข้อความดูเหมือนแจ้งข้อผิดพลาด ให้บันทึกเป็น error_report ด้วย (ให้ทีมเห็นในรายการแจ้งข้อผิดพลาด)
      if (looksLikeErrorReport(text)) {
        const payloadObj: Record<string, unknown> = {};
        if (workspaceSnapshot && (workspaceSnapshot.orderSheet || workspaceSnapshot.meta || workspaceSnapshot.blocks)) {
          payloadObj.workspace = workspaceSnapshot;
        }
        fetch("/api/feedback", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type: "error_report",
            message: text,
            payload: Object.keys(payloadObj).length > 0 ? JSON.stringify(payloadObj) : undefined,
          }),
        }).catch(() => {});
      }

      const history = [...chatMessages, { id: userMsgId, message: text, createdAt: new Date().toISOString(), isBot: false }]
        .slice(-20)
        .map((m) => ({ role: m.isBot ? ("assistant" as const) : ("user" as const), content: m.message }));

      const replyRes = await fetch("/api/feedback/chat-reply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, history }),
      });
      const replyData = await replyRes.json();
      const replyText =
        replyData.ok && typeof replyData.reply === "string"
          ? replyData.reply
          : typeof replyData.error === "string"
            ? `${FALLBACK_REPLY} (${replyData.error})`
            : FALLBACK_REPLY;

      // Persist bot reply so history remains after reload.
      fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "chat",
          message: replyText,
          payload: JSON.stringify({ isBot: true, source: "ai" }),
        }),
      }).catch(() => {});

      setChatMessages((prev) => [
        ...prev,
        { id: botId, message: replyText, createdAt: new Date().toISOString(), isBot: true },
      ]);
    } catch {
      setChatMessages((prev) => [
        ...prev,
        { id: botId, message: FALLBACK_REPLY, createdAt: new Date().toISOString(), isBot: true },
      ]);
    } finally {
      setChatLoading(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setFeedbackTab("chat");
          setOpen(!open);
        }}
        className="fixed bottom-6 right-6 z-[100] flex h-14 w-14 items-center justify-center rounded-full bg-cyan-500 text-white shadow-lg shadow-cyan-900/40 transition hover:bg-cyan-600"
        title="แชทช่วยเหลือ"
        aria-label="เปิดแชทช่วยเหลือ"
      >
        <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
        </svg>
      </button>

      {open && (
        <div className="fixed bottom-24 right-6 z-[100] flex w-[380px] max-w-[calc(100vw-3rem)] flex-col overflow-hidden rounded-2xl border border-slate-700 bg-slate-900 shadow-xl">
          <div className="flex border-b border-slate-700 bg-slate-800/80">
            <button
              type="button"
              onClick={() => setTab("chat")}
              className={`flex-1 px-4 py-3 text-sm font-medium ${tab === "chat" ? "bg-slate-700 text-white" : "text-slate-400 hover:text-white"}`}
            >
              แชท
            </button>
            <button
              type="button"
              onClick={() => setTab("report")}
              className={`flex-1 px-4 py-3 text-sm font-medium ${tab === "report" ? "bg-slate-700 text-white" : "text-slate-400 hover:text-white"}`}
            >
              แจ้งข้อผิดพลาด
            </button>
          </div>

          <div className="flex max-h-[420px] flex-1 flex-col overflow-hidden">
            {tab === "chat" ? (
              <>
                <div className="flex-1 overflow-y-auto p-3 space-y-3 min-h-[200px]">
                  {loadError && (
                    <p className="text-xs text-amber-400">{loadError}</p>
                  )}
                  {chatMessages.length === 0 && !loadError && (
                    <p className="text-sm text-slate-500">สวัสดีครับ พิมพ์คำถามหรือแจ้งข้อผิดพลาดได้เลย เราจะตอบกลับโดยเร็ว</p>
                  )}
                  {chatMessages.map((m) => (
                    <div key={m.id} className="space-y-1">
                      <div
                        className={`rounded-2xl px-4 py-2 text-sm ${m.isBot ? "ml-4 mr-8 bg-slate-700/80 text-slate-200" : "ml-8 mr-4 bg-cyan-600/80 text-white"}`}
                      >
                        <div className="whitespace-pre-wrap leading-relaxed">{m.message}</div>
                      </div>
                      {m.isBot && botReplyAsksForAttachment(m.message) ? (
                        <div className="ml-4 mr-8 flex flex-wrap gap-2 pl-1">
                          <button
                            type="button"
                            onClick={() => { setTab("report"); setOpen(true); }}
                            className="rounded-xl border border-slate-600 bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-slate-700"
                          >
                            แนบรูปหน้าจอ
                          </button>
                          <button
                            type="button"
                            onClick={() => { setTab("report"); setOpen(true); }}
                            className="rounded-xl border border-cyan-700 bg-cyan-900/50 px-3 py-1.5 text-xs font-medium text-cyan-200 hover:bg-cyan-800/50"
                          >
                            ส่งรายงานเพิ่ม (order sheet/ผลสรุป)
                          </button>
                        </div>
                      ) : null}
                    </div>
                  ))}
                  {chatLoading ? (
                    <div className="ml-4 mr-8 rounded-2xl bg-slate-700/80 px-4 py-2.5 text-sm text-slate-300 animate-pulse">
                      <span className="inline-flex items-center gap-1.5">
                        <span className="flex gap-1" aria-hidden>
                          <span className="size-1.5 rounded-full bg-slate-400" />
                          <span className="size-1.5 rounded-full bg-slate-400" />
                          <span className="size-1.5 rounded-full bg-slate-400" />
                        </span>
                        กำลังประมวลผล
                      </span>
                    </div>
                  ) : null}
                  <div ref={chatEndRef} />
                </div>
                <div className="border-t border-slate-700 p-3">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendChat()}
                      placeholder="พิมพ์ข้อความ..."
                      className="flex-1 rounded-xl border border-slate-600 bg-slate-800 px-4 py-2 text-sm text-white placeholder-slate-500 outline-none focus:border-cyan-500"
                    />
                    <button
                      type="button"
                      onClick={sendChat}
                      disabled={chatLoading || !chatInput.trim()}
                      className="rounded-xl bg-cyan-500 px-4 py-2 text-sm font-medium text-white hover:bg-cyan-600 disabled:opacity-50"
                    >
                      ส่ง
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <div className="overflow-y-auto p-4 space-y-4">
                {reportSent ? (
                  <div className="rounded-2xl border border-emerald-700/50 bg-emerald-950/30 p-4 text-sm text-emerald-200">
                    ส่งการแจ้งข้อผิดพลาดเรียบร้อยแล้ว เราจะนำไปใช้ปรับปรุงระบบครับ
                    <button
                      type="button"
                      onClick={() => setReportSent(false)}
                      className="mt-3 block text-cyan-400 hover:underline"
                    >
                      ส่งรายงานเพิ่ม
                    </button>
                  </div>
                ) : (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-1">อธิบายข้อผิดพลาดหรือสิ่งที่พบ *</label>
                      <textarea
                        value={reportDesc}
                        onChange={(e) => setReportDesc(e.target.value)}
                        placeholder="เช่น วันที่ DC ไม่ตรง, ผลสรุปไม่ตรงกับ order sheet..."
                        rows={4}
                        className="w-full rounded-xl border border-slate-600 bg-slate-800 px-4 py-3 text-sm text-white placeholder-slate-500 outline-none focus:border-cyan-500"
                      />
                    </div>
                    {workspaceSnapshot && (workspaceSnapshot.orderSheet || workspaceSnapshot.meta || workspaceSnapshot.blocks) ? (
                      <label className="flex items-center gap-2 text-sm text-slate-300">
                        <input
                          type="checkbox"
                          checked={reportIncludeWorkspace}
                          onChange={(e) => setReportIncludeWorkspace(e.target.checked)}
                          className="h-4 w-4 rounded border-slate-600 bg-slate-800 text-cyan-500"
                        />
                        แนบข้อมูล Workspace (order sheet และผลสรุปชาร์จ)
                      </label>
                    ) : null}
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-1">แนบรูปหน้าจอ (ถ้ามี)</label>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        onChange={(e) => setReportFile(e.target.files?.[0] ?? null)}
                        className="w-full text-sm text-slate-400 file:mr-2 file:rounded-lg file:border-0 file:bg-cyan-500/20 file:px-3 file:py-1 file:text-cyan-300"
                      />
                      {reportFile ? <p className="mt-1 text-xs text-slate-500">{reportFile.name}</p> : null}
                    </div>
                    <button
                      type="button"
                      onClick={sendReport}
                      disabled={reportSending || !reportDesc.trim()}
                      className="w-full rounded-xl bg-amber-500/90 py-3 text-sm font-medium text-white hover:bg-amber-500 disabled:opacity-50"
                    >
                      {reportSending ? "กำลังส่ง..." : "ส่งการแจ้งข้อผิดพลาด"}
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
