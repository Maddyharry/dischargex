"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

type FeedbackItem = {
  id: string;
  type: string;
  message: string;
  payload: string | null;
  userId: string | null;
  userEmail: string | null;
  userName: string | null;
  category?: string | null;
  shortSummary?: string | null;
  aiScore?: number | null;
  aiSuggestedCredit?: number | null;
  adminFinalCredit?: number | null;
  status?: string | null;
  adminNote?: string | null;
  isBot?: boolean;
  createdAt: string;
};

export default function AdminFeedbackPage() {
  const [feedback, setFeedback] = useState<FeedbackItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState<string>(""); // "" | "chat" | "error_report"
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [refundingUserId, setRefundingUserId] = useState<string | null>(null);
  const [reviewingId, setReviewingId] = useState<string | null>(null);
  const [knowledge, setKnowledge] = useState("");
  const [savingKnowledge, setSavingKnowledge] = useState(false);
  const [insights, setInsights] = useState<null | {
    total: number;
    chats: number;
    errors: number;
    topChatKeywords: Array<{ key: string; count: number }>;
    topErrorKeywords: Array<{ key: string; count: number }>;
    aiSummary: string | null;
  }>(null);
  const [insightsLoading, setInsightsLoading] = useState(false);
  const [replyDraft, setReplyDraft] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const url = typeFilter ? `/api/admin/feedback?type=${encodeURIComponent(typeFilter)}` : "/api/admin/feedback";
      const res = await fetch(url);
      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error || "โหลดรายการไม่สำเร็จ");
      }
      const mapped: FeedbackItem[] = (data.feedback || []).map((f: FeedbackItem & { payload?: string | null }) => {
        let isBot = false;
        try {
          const p = f.payload ? (JSON.parse(f.payload) as { isBot?: boolean }) : null;
          isBot = p?.isBot === true;
        } catch {
          isBot = false;
        }
        return { ...f, isBot };
      });
      setFeedback(mapped);
    } catch (err) {
      setError(err instanceof Error ? err.message : "โหลดข้อมูลล้มเหลว");
    } finally {
      setLoading(false);
    }
  }, [typeFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    async function loadKnowledge() {
      try {
        const res = await fetch("/api/admin/chatbot-settings");
        const data = await res.json();
        if (res.ok && data.ok) setKnowledge(data.knowledge || "");
      } catch {
        // ignore
      }
    }
    void loadKnowledge();
  }, []);

  function parsePayload(payload: string | null): { workspace?: unknown; screenshot?: string } | null {
    if (!payload) return null;
    try {
      return JSON.parse(payload) as { workspace?: unknown; screenshot?: string };
    } catch {
      return null;
    }
  }

  async function handleRefundCredit(userId: string) {
    if (!confirm("ยืนยันคืนเครดิตให้ผู้ใช้รายนี้? (จะลบรายการใช้งานล่าสุดของ user)")) return;
    setRefundingUserId(userId);
    try {
      const res = await fetch("/api/admin/refund-credit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error || "ดำเนินการไม่สำเร็จ");
      }
      alert(data.message || "คืนเครดิตให้ผู้ใช้แล้ว");
      void load();
    } catch (err) {
      alert(err instanceof Error ? err.message : "ดำเนินการไม่สำเร็จ");
    } finally {
      setRefundingUserId(null);
    }
  }

  async function handleReview(
    id: string,
    action: "approve" | "reject" | "duplicate" | "implemented" | "revoke",
    suggestedCredit?: number | null
  ) {
    const credit =
      action === "approve"
        ? Number(
            prompt(
              "จำนวนเครดิตที่จะให้ (ปรับได้):",
              String(suggestedCredit ?? 0)
            ) ?? suggestedCredit ?? 0
          )
        : undefined;
    setReviewingId(id);
    try {
      const res = await fetch("/api/admin/feedback", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, action, credit }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) {
        throw new Error(data.error || "อัปเดตสถานะไม่สำเร็จ");
      }
      void load();
    } catch (err) {
      alert(err instanceof Error ? err.message : "อัปเดตสถานะไม่สำเร็จ");
    } finally {
      setReviewingId(null);
    }
  }

  async function handleSaveKnowledge() {
    if (!knowledge.trim()) return;
    setSavingKnowledge(true);
    try {
      const res = await fetch("/api/admin/chatbot-settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ knowledge }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) throw new Error(data.error || "บันทึกไม่สำเร็จ");
      alert("บันทึกข้อมูลความรู้ของ chatbot แล้ว");
    } catch (err) {
      alert(err instanceof Error ? err.message : "บันทึกไม่สำเร็จ");
    } finally {
      setSavingKnowledge(false);
    }
  }

  async function handleGenerateInsights() {
    setInsightsLoading(true);
    try {
      const res = await fetch("/api/admin/chatbot-insights");
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) throw new Error(data.error || "สร้างสรุปไม่สำเร็จ");
      setInsights(data);
    } catch (err) {
      alert(err instanceof Error ? err.message : "สร้างสรุปไม่สำเร็จ");
    } finally {
      setInsightsLoading(false);
    }
  }

  async function handleReplyToChat(feedbackId: string) {
    const reply = (replyDraft[feedbackId] || "").trim();
    if (!reply) return;
    try {
      const res = await fetch("/api/admin/chatbot-reply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ feedbackId, reply }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) throw new Error(data.error || "ส่งคำตอบไม่สำเร็จ");
      setReplyDraft((prev) => ({ ...prev, [feedbackId]: "" }));
      alert("ส่งคำตอบจากแอดมินแล้ว");
    } catch (err) {
      alert(err instanceof Error ? err.message : "ส่งคำตอบไม่สำเร็จ");
    }
  }

  return (
    <main className="min-h-screen bg-[#081120] text-slate-100">
      <div className="mx-auto max-w-5xl px-4 py-8 space-y-6">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold text-white">แจ้งข้อผิดพลาด & แชทลูกค้า</h1>
            <p className="mt-1 text-sm text-slate-300">
              ดูรายการแชทและรายงานข้อผิดพลาดที่ลูกค้าส่งมา
            </p>
          </div>
          <div className="flex gap-2">
            <Link
              href="/admin"
              className="rounded-2xl border border-slate-700 bg-slate-900/80 px-4 py-2 text-sm font-medium text-slate-100 transition hover:bg-slate-800"
            >
              กลับหลังบ้าน
            </Link>
          </div>
        </header>

        <div className="flex flex-wrap items-center gap-3">
          <span className="text-sm text-slate-400">แสดง:</span>
          <button
            type="button"
            onClick={() => setTypeFilter("")}
            className={`rounded-xl px-4 py-2 text-sm font-medium transition ${typeFilter === "" ? "bg-cyan-500/80 text-white" : "border border-slate-600 bg-slate-900/80 text-slate-300 hover:bg-slate-800"}`}
          >
            ทั้งหมด
          </button>
          <button
            type="button"
            onClick={() => setTypeFilter("chat")}
            className={`rounded-xl px-4 py-2 text-sm font-medium transition ${typeFilter === "chat" ? "bg-cyan-500/80 text-white" : "border border-slate-600 bg-slate-900/80 text-slate-300 hover:bg-slate-800"}`}
          >
            แชท
          </button>
          <button
            type="button"
            onClick={() => setTypeFilter("error_report")}
            className={`rounded-xl px-4 py-2 text-sm font-medium transition ${typeFilter === "error_report" ? "bg-amber-500/80 text-white" : "border border-slate-600 bg-slate-900/80 text-slate-300 hover:bg-slate-800"}`}
          >
            แจ้งข้อผิดพลาด
          </button>
        </div>

        <section className="rounded-2xl border border-slate-700 bg-slate-950/60 p-4 space-y-3">
          <h2 className="text-sm font-semibold text-white">ความรู้ที่ chatbot ควรรู้ (แก้ไขได้)</h2>
          <textarea
            value={knowledge}
            onChange={(e) => setKnowledge(e.target.value)}
            rows={10}
            className="w-full rounded-xl border border-slate-700 bg-slate-900/70 px-3 py-2 text-xs text-slate-100 outline-none focus:border-cyan-500"
          />
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleSaveKnowledge}
              disabled={savingKnowledge}
              className="rounded-xl bg-cyan-600 px-3 py-2 text-xs font-medium text-white hover:bg-cyan-500 disabled:opacity-50"
            >
              {savingKnowledge ? "กำลังบันทึก..." : "บันทึกความรู้ chatbot"}
            </button>
            <button
              type="button"
              onClick={handleGenerateInsights}
              disabled={insightsLoading}
              className="rounded-xl bg-emerald-700 px-3 py-2 text-xs font-medium text-white hover:bg-emerald-600 disabled:opacity-50"
            >
              {insightsLoading ? "กำลังสร้าง..." : "Generate สรุปคำถาม/ข้อผิดพลาดยอดฮิต"}
            </button>
          </div>
          {insights ? (
            <div className="rounded-xl border border-slate-700 bg-slate-900/70 p-3 text-xs text-slate-200 space-y-2">
              <div>30 วันล่าสุด: ทั้งหมด {insights.total} รายการ · แชท {insights.chats} · error {insights.errors}</div>
              <div>Top คำถาม: {insights.topChatKeywords.map((k) => `${k.key}(${k.count})`).join(", ") || "-"}</div>
              <div>Top error: {insights.topErrorKeywords.map((k) => `${k.key}(${k.count})`).join(", ") || "-"}</div>
              {insights.aiSummary ? <pre className="whitespace-pre-wrap text-xs text-slate-300">{insights.aiSummary}</pre> : null}
            </div>
          ) : null}
        </section>

        {error ? (
          <div className="rounded-2xl border border-red-900/60 bg-red-950/40 px-4 py-3 text-sm text-red-200">
            {error}
          </div>
        ) : null}

        {loading ? (
          <div className="text-sm text-slate-300">กำลังโหลด...</div>
        ) : feedback.length === 0 ? (
          <div className="rounded-2xl border border-slate-700 bg-slate-950/60 px-4 py-6 text-sm text-slate-300">
            ยังไม่มีรายการ
          </div>
        ) : (
          <div className="space-y-3">
            {feedback.map((f) => {
              const payloadObj = parsePayload(f.payload);
              const hasPayload = payloadObj && (payloadObj.workspace || payloadObj.screenshot);
              const isExpanded = expandedId === f.id;

              return (
                <div
                  key={f.id}
                  className="rounded-2xl border border-slate-700/80 bg-slate-950/60 overflow-hidden"
                >
                  <button
                    type="button"
                    onClick={() => setExpandedId(isExpanded ? null : f.id)}
                    className="w-full px-4 py-3 flex items-center justify-between gap-3 text-left hover:bg-slate-900/60 transition"
                  >
                    <div className="min-w-0 flex-1 flex items-center gap-3 flex-wrap">
                      <span
                        className={`shrink-0 rounded-lg px-2 py-0.5 text-xs font-medium ${f.type === "error_report" ? "bg-amber-900/60 text-amber-200" : "bg-slate-700 text-slate-300"}`}
                      >
                        {f.type === "error_report" ? "แจ้งข้อผิดพลาด" : "แชท"}
                      </span>
                      <span className="text-sm text-slate-200 truncate max-w-md">
                        {f.message.length > 120 ? f.message.slice(0, 120) + "…" : f.message}
                      </span>
                      {f.status ? (
                        <span className="rounded px-2 py-0.5 text-[11px] border border-slate-600 text-slate-300">
                          {f.status}
                        </span>
                      ) : null}
                      <span className="text-xs text-slate-500">
                        {f.userEmail || f.userName || "ไม่ล็อกอิน"} · {new Date(f.createdAt).toLocaleString("th-TH", { timeZone: "Asia/Bangkok", dateStyle: "short", timeStyle: "short" })}
                      </span>
                    </div>
                    <span className="text-slate-500 shrink-0">
                      {hasPayload ? "มีข้อมูลแนบ" : ""} {isExpanded ? "▼" : "▶"}
                    </span>
                  </button>

                  {isExpanded && (
                    <div className="border-t border-slate-700/80 px-4 py-4 space-y-4 bg-slate-900/40">
                      <div>
                        <div className="text-xs font-medium text-slate-400 mb-1">ข้อความเต็ม</div>
                        <pre className="whitespace-pre-wrap text-sm text-slate-200 rounded-xl bg-slate-950/80 p-3 max-h-48 overflow-y-auto">
                          {f.message}
                        </pre>
                        {f.type === "chat" ? (
                          <div className="mt-3 rounded-xl border border-slate-700 bg-slate-950/70 p-3 space-y-2">
                            <div className="text-xs text-slate-400">
                              ประเภทข้อความ: {f.isBot ? "ข้อความจากบอท/แอดมิน" : "ข้อความจากผู้ใช้"}
                            </div>
                            {!f.isBot ? (
                              <>
                                <textarea
                                  value={replyDraft[f.id] || ""}
                                  onChange={(e) => setReplyDraft((prev) => ({ ...prev, [f.id]: e.target.value }))}
                                  rows={3}
                                  placeholder="พิมพ์คำตอบจากแอดมินเพื่อส่งผ่าน chatbot..."
                                  className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none focus:border-cyan-500"
                                />
                                <button
                                  type="button"
                                  onClick={() => handleReplyToChat(f.id)}
                                  className="rounded-lg bg-cyan-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-cyan-600"
                                >
                                  ส่งคำตอบแอดมินผ่าน chatbot
                                </button>
                              </>
                            ) : null}
                          </div>
                        ) : null}
                      </div>

                      <div className="grid gap-2 sm:grid-cols-4 text-xs">
                        <div className="rounded bg-slate-950/70 border border-slate-700 p-2">
                          <div className="text-slate-500">Category</div>
                          <div className="text-slate-200">{f.category || "-"}</div>
                        </div>
                        <div className="rounded bg-slate-950/70 border border-slate-700 p-2">
                          <div className="text-slate-500">AI score</div>
                          <div className="text-slate-200">{f.aiScore ?? "-"}</div>
                        </div>
                        <div className="rounded bg-slate-950/70 border border-slate-700 p-2">
                          <div className="text-slate-500">AI suggested</div>
                          <div className="text-cyan-300">{f.aiSuggestedCredit ?? 0} เครดิต</div>
                        </div>
                        <div className="rounded bg-slate-950/70 border border-slate-700 p-2">
                          <div className="text-slate-500">Admin final</div>
                          <div className="text-emerald-300">{f.adminFinalCredit ?? 0} เครดิต</div>
                        </div>
                      </div>

                      {payloadObj?.screenshot ? (
                        <div>
                          <div className="text-xs font-medium text-slate-400 mb-1">รูปหน้าจอที่แนบ</div>
                          <img
                            src={`data:image/png;base64,${payloadObj.screenshot}`}
                            alt="Screenshot"
                            className="max-w-full max-h-80 rounded-xl border border-slate-700 object-contain bg-slate-950"
                          />
                        </div>
                      ) : null}

                      {payloadObj?.workspace ? (
                        <div>
                          <div className="text-xs font-medium text-slate-400 mb-1">ข้อมูล Workspace ที่แนบ</div>
                          <div className="rounded-xl bg-slate-950/80 border border-slate-700/80 p-3 space-y-3 text-sm max-h-96 overflow-y-auto">
                            {typeof (payloadObj.workspace as { orderSheet?: string }).orderSheet === "string" && (
                              <details>
                                <summary className="cursor-pointer text-slate-300">Order sheet</summary>
                                <pre className="mt-2 whitespace-pre-wrap text-xs text-slate-400 max-h-40 overflow-y-auto">
                                  {(payloadObj.workspace as { orderSheet?: string }).orderSheet?.slice(0, 5000) || ""}
                                  {(payloadObj.workspace as { orderSheet?: string }).orderSheet && (payloadObj.workspace as { orderSheet?: string }).orderSheet!.length > 5000 ? "\n… (ตัดให้แสดงส่วนต้น)" : ""}
                                </pre>
                              </details>
                            )}
                            {(payloadObj.workspace as { meta?: unknown }).meta != null && (
                              <details>
                                <summary className="cursor-pointer text-slate-300">Clinical Signal (meta)</summary>
                                <pre className="mt-2 whitespace-pre-wrap text-xs text-slate-400">
                                  {JSON.stringify((payloadObj.workspace as { meta?: unknown }).meta, null, 2)}
                                </pre>
                              </details>
                            )}
                            {(payloadObj.workspace as { preprocess?: unknown }).preprocess != null && (
                              <details>
                                <summary className="cursor-pointer text-slate-300">Preprocess summary</summary>
                                <pre className="mt-2 whitespace-pre-wrap text-xs text-slate-400">
                                  {JSON.stringify((payloadObj.workspace as { preprocess?: unknown }).preprocess, null, 2)}
                                </pre>
                              </details>
                            )}
                            {(payloadObj.workspace as { blocks?: unknown }).blocks != null && (
                              <details>
                                <summary className="cursor-pointer text-slate-300">Blocks</summary>
                                <pre className="mt-2 whitespace-pre-wrap text-xs text-slate-400 max-h-48 overflow-y-auto">
                                  {JSON.stringify((payloadObj.workspace as { blocks?: unknown }).blocks, null, 2)}
                                </pre>
                              </details>
                            )}
                            {(payloadObj.workspace as { warnings?: string[] }).warnings?.length ? (
                              <details>
                                <summary className="cursor-pointer text-slate-300">Warnings</summary>
                                <pre className="mt-2 whitespace-pre-wrap text-xs text-slate-400">
                                  {(payloadObj.workspace as { warnings?: string[] }).warnings?.join("\n")}
                                </pre>
                              </details>
                            ) : null}
                          </div>
                        </div>
                      ) : null}

                      {!hasPayload && f.payload ? (
                        <div>
                          <div className="text-xs font-medium text-slate-400 mb-1">Payload (ดิบ)</div>
                          <pre className="whitespace-pre-wrap text-xs text-slate-500 break-all max-h-32 overflow-y-auto">
                            {f.payload!.length > 2000 ? f.payload!.slice(0, 2000) + "…" : f.payload}
                          </pre>
                        </div>
                      ) : null}

                      {f.type === "error_report" && f.userId ? (
                        <div className="pt-2 border-t border-slate-700/80">
                          <button
                            type="button"
                            onClick={() => handleRefundCredit(f.userId!)}
                            disabled={refundingUserId === f.userId}
                            className="rounded-xl border border-emerald-600 bg-emerald-500/20 px-4 py-2 text-sm font-medium text-emerald-200 hover:bg-emerald-500/30 disabled:opacity-50"
                          >
                            {refundingUserId === f.userId ? "กำลังดำเนินการ…" : "คืนเครดิตจากรายการล่าสุด"}
                          </button>
                          <p className="mt-1 text-xs text-slate-500">
                            จะลบรายการใช้งานล่าสุดของ user นี้ และคืนเครดิตตามที่รายการนั้นใช้จริง
                          </p>
                        </div>
                      ) : null}

                      {f.type === "error_report" ? (
                        <div className="pt-2 border-t border-slate-700/80 flex flex-wrap gap-2">
                          <button
                            type="button"
                            disabled={reviewingId === f.id}
                            onClick={() => handleReview(f.id, "approve", f.aiSuggestedCredit)}
                            className="rounded-xl bg-emerald-600/70 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
                          >
                            อนุมัติ+ให้เครดิต
                          </button>
                          <button
                            type="button"
                            disabled={reviewingId === f.id}
                            onClick={() => handleReview(f.id, "duplicate")}
                            className="rounded-xl bg-slate-700 px-3 py-1.5 text-xs font-medium text-slate-100 disabled:opacity-50"
                          >
                            ทำเครื่องหมายซ้ำ
                          </button>
                          <button
                            type="button"
                            disabled={reviewingId === f.id}
                            onClick={() => handleReview(f.id, "implemented")}
                            className="rounded-xl bg-cyan-700 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
                          >
                            ทำเครื่องหมายนำไปใช้แล้ว
                          </button>
                          <button
                            type="button"
                            disabled={reviewingId === f.id}
                            onClick={() => handleReview(f.id, "reject")}
                            className="rounded-xl bg-red-700 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
                          >
                            ปฏิเสธ
                          </button>
                          <button
                            type="button"
                            disabled={reviewingId === f.id}
                            onClick={() => handleReview(f.id, "revoke")}
                            className="rounded-xl bg-amber-700 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
                          >
                            ยกเลิกเครดิต
                          </button>
                        </div>
                      ) : null}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
