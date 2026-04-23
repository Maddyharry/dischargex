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

export default function AdminKnowledgePage() {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploadSource, setUploadSource] = useState("");
  const [uploadContent, setUploadContent] = useState("");
  const [uploading, setUploading] = useState(false);
  const [pendingGaps, setPendingGaps] = useState<PendingGap[]>([]);
  const [pendingDocuments, setPendingDocuments] = useState<PendingDocument[]>([]);
  const [actingId, setActingId] = useState("");
  const [gapTargetSlug, setGapTargetSlug] = useState<Record<string, string>>({});
  const [gapTopicName, setGapTopicName] = useState<Record<string, string>>({});
  const [gapTab, setGapTab] = useState<"high" | "review_later">("high");

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
    try {
      await fetch("/api/admin/knowledge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceName: uploadSource.trim(),
          content: uploadContent.trim(),
          sourceType: "manual",
        }),
      });
      setUploadContent("");
      await loadAll();
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

  return (
    <main className="min-h-screen bg-[#081120] text-slate-100">
      <div className="mx-auto max-w-5xl px-4 py-8">
        <h1 className="text-2xl font-semibold">Admin Knowledge</h1>
        <p className="mt-2 text-sm text-slate-400">จัดการหัวข้อความรู้ที่ active/deprecate ได้ทันที เพื่อตัดข้อมูลเก่าออกจาก search/chat</p>
        <div className="mt-4 rounded-xl border border-amber-500/30 bg-amber-950/20 p-3 text-sm text-amber-100">
          มีข้อมูลใหม่รออนุมัติ {pendingGaps.length + pendingDocuments.length} รายการ
        </div>
        <div className="mt-4 space-y-4">
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
          <textarea
            value={uploadContent}
            onChange={(e) => setUploadContent(e.target.value)}
            placeholder="วางเนื้อหาเอกสารที่ต้องการ ingest"
            className="mt-2 h-32 w-full rounded-lg border border-slate-700 bg-slate-900/70 px-3 py-2 text-sm"
          />
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

