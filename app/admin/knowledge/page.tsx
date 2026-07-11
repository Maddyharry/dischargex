"use client";

import { useEffect, useState } from "react";

type Item = {
  slug: string;
  name: string;
  version?: string;
  effectiveDate?: string;
  deprecated?: boolean;
};
type PendingGap = {
  id: string;
  topicKey: string;
  suggestedTitle: string;
  summary: string;
  questionCount: number;
  sampleQuestions: string[];
  refs: string[];
  suggestedAction: "new_topic" | "expand_topic";
  candidateTargetSlugs: string[];
  priorityScore: number;
  priorityTier: "high" | "review_later";
  externalSources?: Array<{ title: string; url: string; sourceName: string }>;
  icd10Candidates?: string[];
  createdAt: string;
  lastSeenAt: string;
};
type PendingDocument = {
  id: string;
  sourceName: string;
  sourceType: string;
  version?: string | null;
  createdAt: string;
};

type GuidelineAssistantAnalysis = {
  suggestedAction: "new_topic" | "expand_topic";
  targetSlug: string;
  topicName: string;
  changeSummary: string[];
  fields: {
    diagnosisToWrite: string[];
    thinkWhen: string[];
    considerMore: string[];
    notYetDiagnosis: string[];
    investigations: string[];
    icd10: string[];
    refs: string[];
    diagnosticCriteria: Array<{
      label: string;
      criteria: string;
      priority?: "core" | "supporting";
      sourceType?: "thai_guideline" | "thai_reference" | "international_fallback";
      sourceNote?: string;
      lastReviewed?: string;
    }>;
  };
  candidateTopics: Array<{ slug: string; name: string }>;
  externalSources: Array<{ sourceName: string; title: string; url: string }>;
  sourceMeta?: { sourceName?: string; sourceType?: string; charCount?: number };
};

export default function AdminKnowledgePage() {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploadSource, setUploadSource] = useState("");
  const [uploadVersion, setUploadVersion] = useState("");
  const [uploadContent, setUploadContent] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadNotice, setUploadNotice] = useState<string | null>(null);
  const [pendingGaps, setPendingGaps] = useState<PendingGap[]>([]);
  const [pendingDocuments, setPendingDocuments] = useState<PendingDocument[]>([]);
  const [actingId, setActingId] = useState("");
  const [gapTargetSlug, setGapTargetSlug] = useState<Record<string, string>>({});
  const [gapTopicName, setGapTopicName] = useState<Record<string, string>>({});
  const [gapTab, setGapTab] = useState<"high" | "review_later">("high");
  const [assistantTopicHint, setAssistantTopicHint] = useState("");
  const [assistantSourceName, setAssistantSourceName] = useState("");
  const [assistantContent, setAssistantContent] = useState("");
  const [assistantFile, setAssistantFile] = useState<File | null>(null);
  const [assistantLoading, setAssistantLoading] = useState(false);
  const [assistantNotice, setAssistantNotice] = useState<string | null>(null);
  const [assistantAnalysis, setAssistantAnalysis] = useState<GuidelineAssistantAnalysis | null>(null);

  async function loadAll() {
    const resp = await fetch("/api/admin/knowledge", { cache: "no-store" });
    const data = (await resp.json()) as {
      ok?: boolean;
      items?: Item[];
      pendingGaps?: PendingGap[];
      pendingDocuments?: PendingDocument[];
    };
    if (data.ok) {
      setItems(data.items || []);
      setPendingGaps(data.pendingGaps || []);
      setPendingDocuments(data.pendingDocuments || []);
    }
  }

  useEffect(() => {
    loadAll().finally(() => setLoading(false));
  }, []);

  async function toggleDeprecated(item: Item) {
    await fetch("/api/admin/knowledge", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        slug: item.slug,
        deprecated: !item.deprecated,
      }),
    });
    await loadAll();
  }

  async function uploadKnowledge() {
    if (!uploadSource.trim() || !uploadContent.trim()) return;
    setUploading(true);
    setUploadNotice(null);
    try {
      const res = await fetch("/api/admin/knowledge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceName: uploadSource.trim(),
          version: uploadVersion.trim() || undefined,
          content: uploadContent.trim(),
          sourceType: "manual",
        }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        error?: string;
        duplicate?: boolean;
        existing?: { sourceName?: string; version?: string | null };
      };
      if (!res.ok || !data.ok) {
        throw new Error(data.error || "อัปโหลดไม่สำเร็จ");
      }
      setUploadNotice(
        data.duplicate
          ? `พบเอกสารซ้ำในระบบแล้ว: ${data.existing?.sourceName || uploadSource.trim()}${data.existing?.version ? ` (${data.existing.version})` : ""}`
          : "อัปโหลดเข้า pending review แล้ว"
      );
      setUploadContent("");
      setUploadVersion("");
      await loadAll();
    } catch (error) {
      setUploadNotice(error instanceof Error ? error.message : "อัปโหลดไม่สำเร็จ");
    } finally {
      setUploading(false);
    }
  }

  async function reviewGap(
    action: "approve_pending_gap" | "reject_pending_gap",
    gap: PendingGap,
    options?: { publishMode?: "new_topic" | "expand_topic"; targetSlug?: string; topicName?: string }
  ) {
    setActingId(gap.id);
    try {
      await fetch("/api/admin/knowledge", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          gapId: gap.id,
          publishMode: options?.publishMode,
          targetSlug: options?.targetSlug,
          topicName: options?.topicName,
        }),
      });
      await loadAll();
    } finally {
      setActingId("");
    }
  }

  async function reviewDocument(action: "approve_document" | "reject_document", documentId: string) {
    setActingId(documentId);
    try {
      await fetch("/api/admin/knowledge", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, documentId }),
      });
      await loadAll();
    } finally {
      setActingId("");
    }
  }

  async function runGuidelineAssistant(discoverOnly = false) {
    setAssistantLoading(true);
    setAssistantNotice(null);
    setAssistantAnalysis(null);
    try {
      const form = new FormData();
      form.set("topicHint", assistantTopicHint.trim());
      form.set("sourceName", assistantSourceName.trim());
      form.set("discoverOnly", discoverOnly ? "1" : "0");
      form.set("content", assistantContent.trim());
      if (assistantFile) form.set("file", assistantFile);
      const res = await fetch("/api/admin/knowledge/update-assistant", {
        method: "POST",
        body: form,
      });
      const data = (await res.json()) as {
        ok?: boolean;
        error?: string;
        mode?: string;
        analysis?: GuidelineAssistantAnalysis;
        externalSources?: Array<{ sourceName: string; title: string; url: string }>;
      };
      if (!res.ok || !data.ok) throw new Error(data.error || "วิเคราะห์ guideline ไม่สำเร็จ");
      if (discoverOnly) {
        setAssistantNotice(`ค้นหาอัปเดตเสร็จแล้ว พบแหล่งอ้างอิง ${data.externalSources?.length || 0} รายการ`);
      } else if (data.analysis) {
        setAssistantAnalysis(data.analysis);
        setAssistantNotice("AI วิเคราะห์เสร็จแล้ว — ตรวจทานแล้วกด Approve ได้ทันที");
      }
    } catch (error) {
      setAssistantNotice(error instanceof Error ? error.message : "วิเคราะห์ guideline ไม่สำเร็จ");
    } finally {
      setAssistantLoading(false);
    }
  }

  async function approveAssistantUpdate() {
    if (!assistantAnalysis) return;
    const actionBody =
      assistantAnalysis.suggestedAction === "new_topic"
        ? {
            action: "approve_pending_gap",
            gapId: "",
            publishMode: "new_topic",
            topicName: assistantAnalysis.topicName,
          }
        : null;
    if (actionBody) {
      setAssistantNotice("กรุณาสร้างหัวข้อใหม่ผ่าน Pending gaps เพื่อคง trace ของเอกสาร");
      return;
    }
    if (!assistantAnalysis.targetSlug) {
      setAssistantNotice("ยังไม่มี target topic ที่จะอัปเดต");
      return;
    }
    setAssistantLoading(true);
    try {
      const res = await fetch("/api/admin/knowledge", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "approve_topic_edit",
          slug: assistantAnalysis.targetSlug,
          payload: assistantAnalysis.fields,
        }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) throw new Error(data.error || "approve ไม่สำเร็จ");
      setAssistantNotice(`Approve update สำเร็จ: ${assistantAnalysis.targetSlug}`);
      await loadAll();
    } catch (error) {
      setAssistantNotice(error instanceof Error ? error.message : "approve ไม่สำเร็จ");
    } finally {
      setAssistantLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#081120] text-slate-100">
      <div className="mx-auto max-w-5xl px-4 py-8">
        <h1 className="text-2xl font-semibold">Admin Knowledge</h1>
        <p className="mt-2 text-sm text-slate-400">จัดการหัวข้อความรู้ที่ active/deprecate ได้ทันที เพื่อตัดข้อมูลเก่าออกจาก search/chat</p>
        <p className="mt-2 rounded-lg border border-cyan-500/20 bg-cyan-950/25 px-3 py-2 text-xs text-cyan-50/95">
          เกณฑ์เนื้อหา: อัปเดตล่าสุด ชัดเจนต่อการสรุปชาร์จและแนวทาง{" "}
          <span className="font-medium text-cyan-100">สปสช</span> — ระบุแหล่ง/ฉบับเอกสาร; ICD-10 ควรอ้างคู่มือหรือประกาศ สปสช
          ที่ตรวจสอบได้
        </p>
        <div className="mt-4 rounded-xl border border-amber-500/30 bg-amber-950/20 p-3 text-sm text-amber-100">
          มีข้อมูลใหม่รออนุมัติ {pendingGaps.length + pendingDocuments.length} รายการ
        </div>
        <div className="mt-4 space-y-4">
          <div className="rounded-xl border border-indigo-500/25 bg-indigo-950/15 p-4">
            <div className="text-sm font-semibold text-indigo-100">Guideline Update Assistant (Text / PDF)</div>
            <p className="mt-1 text-xs text-slate-300">
              วาง guideline ใหม่หรือแนบ PDF แล้วให้ AI สรุปว่าอะไรเปลี่ยน ควรปรับหัวข้อไหน และกด approve เข้า knowledge ได้
            </p>
            <input
              value={assistantTopicHint}
              onChange={(e) => setAssistantTopicHint(e.target.value)}
              placeholder="โรค/หัวข้อ เช่น acute diarrhea, UTI, stroke fast track"
              className="mt-3 w-full rounded-lg border border-slate-700 bg-slate-900/70 px-3 py-2 text-sm"
            />
            <input
              value={assistantSourceName}
              onChange={(e) => setAssistantSourceName(e.target.value)}
              placeholder="ชื่อเอกสาร/แหล่ง เช่น MOPH guideline 2026"
              className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-900/70 px-3 py-2 text-sm"
            />
            <textarea
              value={assistantContent}
              onChange={(e) => setAssistantContent(e.target.value)}
              placeholder="วางเนื้อหา guideline (ถ้าแนบ PDF ไม่จำเป็น)"
              className="mt-2 h-28 w-full rounded-lg border border-slate-700 bg-slate-900/70 px-3 py-2 text-sm"
            />
            <input
              type="file"
              accept=".pdf,text/plain"
              onChange={(e) => setAssistantFile(e.target.files?.[0] || null)}
              className="mt-2 block w-full text-xs text-slate-300"
            />
            {assistantNotice ? <div className="mt-2 text-xs text-indigo-100">{assistantNotice}</div> : null}
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                onClick={() => void runGuidelineAssistant(true)}
                disabled={assistantLoading || !assistantTopicHint.trim()}
                className="rounded-md border border-cyan-700 px-2 py-1 text-xs text-cyan-200 disabled:opacity-60"
              >
                {assistantLoading ? "กำลังค้น..." : "ค้นหาว่ามีโรคไหนอัปเดตบ้าง"}
              </button>
              <button
                onClick={() => void runGuidelineAssistant(false)}
                disabled={assistantLoading || (!assistantContent.trim() && !assistantFile)}
                className="rounded-md border border-indigo-700 px-2 py-1 text-xs text-indigo-200 disabled:opacity-60"
              >
                {assistantLoading ? "กำลังวิเคราะห์..." : "AI วิเคราะห์ update"}
              </button>
              <button
                onClick={() => void approveAssistantUpdate()}
                disabled={assistantLoading || !assistantAnalysis}
                className="rounded-md border border-emerald-700 px-2 py-1 text-xs text-emerald-200 disabled:opacity-60"
              >
                Approve update เข้า knowledge
              </button>
            </div>
            {assistantAnalysis ? (
              <div className="mt-3 rounded-lg border border-white/10 bg-slate-950/40 p-3 text-xs text-slate-200">
                <div>
                  Action: {assistantAnalysis.suggestedAction} | Target: {assistantAnalysis.targetSlug || "-"} | Topic:{" "}
                  {assistantAnalysis.topicName}
                </div>
                {assistantAnalysis.changeSummary?.length ? (
                  <div className="mt-2 space-y-1">
                    {assistantAnalysis.changeSummary.map((row, idx) => (
                      <div key={`chg-${idx}`}>- {row}</div>
                    ))}
                  </div>
                ) : null}
                {assistantAnalysis.externalSources?.length ? (
                  <div className="mt-2 space-y-1 text-slate-300">
                    {assistantAnalysis.externalSources.slice(0, 4).map((src, idx) => (
                      <div key={`src-${idx}`}>ReferenceSource: {src.sourceName} - {src.title} ({src.url})</div>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
          <div className="rounded-xl border border-emerald-500/25 bg-emerald-950/15 p-4">
            <div className="text-sm font-semibold text-emerald-100">Pending knowledge gaps from user demand</div>
            <div className="mt-3 flex gap-2">
              <button
                onClick={() => setGapTab("high")}
                className={`rounded-md border px-2 py-1 text-xs ${
                  gapTab === "high"
                    ? "border-emerald-600 bg-emerald-500/20 text-emerald-100"
                    : "border-slate-700 text-slate-300"
                }`}
              >
                High priority ({pendingGaps.filter((g) => g.priorityTier === "high").length})
              </button>
              <button
                onClick={() => setGapTab("review_later")}
                className={`rounded-md border px-2 py-1 text-xs ${
                  gapTab === "review_later"
                    ? "border-cyan-600 bg-cyan-500/20 text-cyan-100"
                    : "border-slate-700 text-slate-300"
                }`}
              >
                Review later ({pendingGaps.filter((g) => g.priorityTier === "review_later").length})
              </button>
            </div>
            <div className="mt-3 space-y-3">
              {pendingGaps
                .filter((gap) => gap.priorityTier === gapTab)
                .map((gap) => (
                <div key={gap.id} className="rounded-lg border border-white/10 bg-slate-950/40 p-3">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
                    <span>{new Date(gap.lastSeenAt).toLocaleString("th-TH")}</span>
                    <span>•</span>
                    <span>{gap.questionCount} คำถามที่เกี่ยวข้อง</span>
                    <span>•</span>
                    <span>{gap.suggestedAction === "expand_topic" ? "ควรเสริมหัวข้อเดิม" : "ควรสร้างหัวข้อใหม่"}</span>
                    <span>•</span>
                    <span>score {gap.priorityScore}</span>
                  </div>
                  <div className="mt-1 text-sm text-slate-100">{gap.suggestedTitle}</div>
                  {gap.sampleQuestions?.length ? (
                    <div className="mt-2 space-y-1 text-xs text-slate-300">
                      {gap.sampleQuestions.map((q, idx) => (
                        <div key={`${gap.id}-q-${idx}`}>Q: {q}</div>
                      ))}
                    </div>
                  ) : null}
                  <div className="mt-2 line-clamp-4 whitespace-pre-wrap text-xs text-slate-300">{gap.summary}</div>
                  {gap.icd10Candidates?.length ? (
                    <div className="mt-2 text-xs text-cyan-200">ICD-10 candidates: {gap.icd10Candidates.join(", ")}</div>
                  ) : null}
                  {gap.externalSources?.length ? (
                    <div className="mt-2 space-y-1 text-xs text-slate-300">
                      {gap.externalSources.slice(0, 3).map((src, i) => (
                        <div key={`${gap.id}-${i}`}>
                          ReferenceSource: {src.sourceName} - {src.title} ({src.url})
                        </div>
                      ))}
                    </div>
                  ) : null}
                  <div className="mt-3 grid gap-2 md:grid-cols-2">
                    <input
                      value={gapTopicName[gap.id] ?? gap.suggestedTitle}
                      onChange={(e) => setGapTopicName((prev) => ({ ...prev, [gap.id]: e.target.value }))}
                      placeholder="ชื่อหัวข้อใหม่"
                      className="rounded-md border border-slate-700 bg-slate-900/70 px-2 py-1 text-xs"
                    />
                    <select
                      value={gapTargetSlug[gap.id] ?? gap.candidateTargetSlugs?.[0] ?? ""}
                      onChange={(e) => setGapTargetSlug((prev) => ({ ...prev, [gap.id]: e.target.value }))}
                      className="rounded-md border border-slate-700 bg-slate-900/70 px-2 py-1 text-xs"
                    >
                      <option value="">เลือกหัวข้อเดิมที่จะเสริมข้อมูล</option>
                      {items
                        .filter((item) => !item.deprecated)
                        .map((item) => (
                          <option key={`${gap.id}-${item.slug}`} value={item.slug}>
                            {item.name} ({item.slug})
                          </option>
                        ))}
                    </select>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <button
                      onClick={() =>
                        void reviewGap("approve_pending_gap", gap, {
                          publishMode: "new_topic",
                          topicName: (gapTopicName[gap.id] ?? gap.suggestedTitle).trim(),
                        })
                      }
                      disabled={actingId === gap.id}
                      className="rounded-md border border-emerald-700 px-2 py-1 text-xs text-emerald-200 disabled:opacity-60"
                    >
                      Approve: Create new topic
                    </button>
                    <button
                      onClick={() =>
                        void reviewGap("approve_pending_gap", gap, {
                          publishMode: "expand_topic",
                          targetSlug: gapTargetSlug[gap.id] ?? gap.candidateTargetSlugs?.[0] ?? "",
                        })
                      }
                      disabled={actingId === gap.id || !(gapTargetSlug[gap.id] ?? gap.candidateTargetSlugs?.[0])}
                      className="rounded-md border border-cyan-700 px-2 py-1 text-xs text-cyan-200 disabled:opacity-60"
                    >
                      Approve: Add to existing topic
                    </button>
                    <button
                      onClick={() => void reviewGap("reject_pending_gap", gap)}
                      disabled={actingId === gap.id}
                      className="rounded-md border border-rose-700 px-2 py-1 text-xs text-rose-200 disabled:opacity-60"
                    >
                      Reject
                    </button>
                  </div>
                </div>
              ))}
              {pendingGaps.filter((gap) => gap.priorityTier === gapTab).length === 0 ? (
                <div className="text-xs text-slate-500">
                  {gapTab === "high" ? "ยังไม่มีรายการความสำคัญสูง" : "ยังไม่มีรายการไว้ทบทวนภายหลัง"}
                </div>
              ) : null}
            </div>
          </div>
          <div className="rounded-xl border border-violet-500/25 bg-violet-950/15 p-4">
            <div className="text-sm font-semibold text-violet-100">Pending ingested documents</div>
            <div className="mt-3 space-y-2">
              {pendingDocuments.map((doc) => (
                <div key={doc.id} className="flex items-center justify-between rounded-lg border border-white/10 bg-slate-950/40 p-3">
                  <div>
                    <div className="text-sm text-slate-100">{doc.sourceName}</div>
                    <div className="text-xs text-slate-400">
                      {doc.sourceType} · {doc.version || "-"} · {new Date(doc.createdAt).toLocaleString("th-TH")}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => void reviewDocument("approve_document", doc.id)}
                      disabled={actingId === doc.id}
                      className="rounded-md border border-emerald-700 px-2 py-1 text-xs text-emerald-200 disabled:opacity-60"
                    >
                      Publish
                    </button>
                    <button
                      onClick={() => void reviewDocument("reject_document", doc.id)}
                      disabled={actingId === doc.id}
                      className="rounded-md border border-rose-700 px-2 py-1 text-xs text-rose-200 disabled:opacity-60"
                    >
                      Reject
                    </button>
                  </div>
                </div>
              ))}
              {pendingDocuments.length === 0 ? <div className="text-xs text-slate-500">ไม่มีเอกสาร ingest ที่รอ publish</div> : null}
            </div>
          </div>
        </div>
        <div className="mt-4 rounded-xl border border-cyan-500/20 bg-cyan-950/15 p-4">
          <div className="text-sm font-medium text-cyan-100">Upload knowledge (manual, MVP)</div>
          <input
            value={uploadSource}
            onChange={(e) => setUploadSource(e.target.value)}
            placeholder="ชื่อเอกสาร เช่น guideline_acute_diarrhea_2026"
            className="mt-3 w-full rounded-lg border border-slate-700 bg-slate-900/70 px-3 py-2 text-sm"
          />
          <input
            value={uploadVersion}
            onChange={(e) => setUploadVersion(e.target.value)}
            placeholder="version หรือปีอ้างอิง เช่น 2026 หรือ v1.2"
            className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-900/70 px-3 py-2 text-sm"
          />
          <textarea
            value={uploadContent}
            onChange={(e) => setUploadContent(e.target.value)}
            placeholder="วางเนื้อหาเอกสารที่ต้องการ ingest"
            className="mt-2 h-32 w-full rounded-lg border border-slate-700 bg-slate-900/70 px-3 py-2 text-sm"
          />
          {uploadNotice ? <div className="mt-2 text-xs text-cyan-100">{uploadNotice}</div> : null}
          <button
            onClick={() => void uploadKnowledge()}
            disabled={uploading}
            className="mt-2 rounded-lg border border-cyan-500/40 bg-cyan-500/15 px-3 py-2 text-xs text-cyan-100 hover:bg-cyan-500/25 disabled:opacity-60"
          >
            {uploading ? "กำลัง ingest..." : "Ingest เอกสาร (รอ approve ก่อน publish)"}
          </button>
        </div>
        <div className="mt-5 overflow-hidden rounded-xl border border-white/10">
          <table className="w-full text-sm">
            <thead className="bg-white/5 text-slate-300">
              <tr>
                <th className="px-3 py-2 text-left">Topic</th>
                <th className="px-3 py-2 text-left">Version</th>
                <th className="px-3 py-2 text-left">Effective</th>
                <th className="px-3 py-2 text-left">Status</th>
                <th className="px-3 py-2 text-left">Action</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.slug} className="border-t border-white/10">
                  <td className="px-3 py-2">
                    <div className="font-medium">{item.name}</div>
                    <div className="text-xs text-slate-500">{item.slug}</div>
                  </td>
                  <td className="px-3 py-2">{item.version || "-"}</td>
                  <td className="px-3 py-2">{item.effectiveDate || "-"}</td>
                  <td className="px-3 py-2">{item.deprecated ? "Deprecated" : "Active"}</td>
                  <td className="px-3 py-2">
                    <button
                      onClick={() => toggleDeprecated(item)}
                      className="rounded-md border border-slate-600 px-2 py-1 hover:bg-white/10"
                    >
                      {item.deprecated ? "Restore" : "Deprecate"}
                    </button>
                  </td>
                </tr>
              ))}
              {!loading && items.length === 0 ? (
                <tr>
                  <td className="px-3 py-4 text-slate-400" colSpan={5}>
                    No items.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}

