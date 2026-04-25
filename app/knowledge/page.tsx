"use client";

import { useEffect, useMemo, useState } from "react";
import type { DiseaseCatalogAudit, DiseaseSummary, KnowledgeReference } from "@/lib/clinical-knowledge";

const BLOCK_STYLES: Record<string, string> = {
  "วินิจฉัยที่ควรเขียน": "border-emerald-500/35 bg-emerald-950/20",
  "คิดถึงโรคนี้เมื่อ": "border-sky-500/35 bg-sky-950/20",
  "สิ่งที่ควรนึกถึงเพิ่ม": "border-violet-500/35 bg-violet-950/20",
  "ยังไม่ควรลงวินิจฉัยว่า": "border-rose-500/35 bg-rose-950/20",
  "Investigations ที่ควรพิจารณา": "border-amber-500/35 bg-amber-950/20",
  "คำที่ควรพิมพ์ในสรุปชาร์จ + ICD ที่เกี่ยวข้อง": "border-cyan-500/35 bg-cyan-950/20",
  "Checklist การลงวินิจฉัย": "border-fuchsia-500/35 bg-fuchsia-950/20",
  "ดูหัวข้อถัดไป": "border-slate-500/35 bg-slate-900/40",
};

export default function KnowledgePage() {
  const [items, setItems] = useState<DiseaseSummary[]>([]);
  const [references, setReferences] = useState<KnowledgeReference[]>([]);
  const [catalogMeta, setCatalogMeta] = useState<DiseaseCatalogAudit | null>(null);
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<string>("");

  useEffect(() => {
    const load = async () => {
      const resp = await fetch("/api/knowledge", { cache: "no-store" });
      const data = (await resp.json()) as {
        ok?: boolean;
        items?: DiseaseSummary[];
        references?: KnowledgeReference[];
        catalogMeta?: DiseaseCatalogAudit;
      };
      if (!data.ok) return;
      const nextItems = data.items || [];
      setItems(nextItems);
      setReferences(data.references || []);
      setCatalogMeta(data.catalogMeta ?? null);
      if (nextItems.length > 0) setSelected(nextItems[0].slug);
    };
    void load();
  }, []);

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    if (!query) return items;
    return items.filter((d) => {
      const blob = [d.name, ...d.aliases, ...d.diagnosisToWrite, ...d.icd10, ...(d.icd9 || []), ...d.investigations].join(" ");
      return blob.toLowerCase().includes(query);
    });
  }, [items, q]);

  const active = filtered.find((d) => d.slug === selected) || filtered[0] || null;
  const icdDisplayItems = useMemo(() => {
    if (!active) return [];
    return formatIcdDisplay(active);
  }, [active]);
  const checklist = useMemo(() => {
    if (!active) return null;
    return buildChecklist(active);
  }, [active]);
  const refIdsOrdered = useMemo(() => {
    if (!active) return [];
    const rest = active.refs.filter((id) => id !== "R7");
    return ["R7", ...rest];
  }, [active]);
  const codingReviewNotes = useMemo(() => {
    if (!active) return [];
    const notes: string[] = [];
    const broadIcd10 = active.icd10.filter((code) => isBroadIcdCode(code));
    if (broadIcd10.length > 0) {
      notes.push(`มีรหัส ICD-10 แบบช่วง/กว้างที่ต้องเลือกให้จำเพาะตามเวชระเบียนจริง: ${broadIcd10.join(", ")}`);
    }
    if ((active.icd9 || []).length > 0) {
      notes.push("หัวข้อนี้มีรหัสหัตถการ ICD-9-CM ให้ใช้กับ procedure; อย่าใช้แทนรหัสโรคหลัก");
    }
    const hasPlaceholder = icdDisplayItems.some((line) => line.includes("ยังไม่มีข้อมูลอ้างอิง"));
    if (hasPlaceholder) {
      notes.push("บางบรรทัดยังไม่มีรหัสอ้างอิงเพียงพอ ควรตรวจสอบ guideline/เอกสารต้นทางก่อนลงรหัส");
    }
    return notes;
  }, [active, icdDisplayItems]);

  return (
    <main className="min-h-screen bg-[#081120] text-slate-100">
      <div className="mx-auto grid max-w-7xl grid-cols-1 gap-4 px-4 py-6 md:grid-cols-[300px_1fr]">
        <aside className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
          <h1 className="text-base font-semibold">Clinical Knowledge Search</h1>
          <p className="mt-1 text-xs text-slate-400">ค้นจากโรค อาการ Investigation และ ICD-10 โดยไม่เรียก LLM</p>
          <p className="mt-1 text-xs text-slate-500">เนื้อหาสรุปเพื่อใช้งานเร็ว และอ้างอิงเอกสารมาตรฐานด้วยรหัส [R#]</p>
          <p className="mt-2 rounded-lg border border-amber-500/25 bg-amber-950/20 px-2 py-1.5 text-[11px] leading-snug text-amber-100/95">
            ชุดข้อมูลควรอัปเดตและเจาะจงกับการสรุปชาร์จ / แนวทาง{" "}
            <span className="font-medium text-amber-50">สปสช</span> เป็นหลัก; รหัส ICD-10 ควรอิงเอกสารคู่มือ/ประกาศ สปสช
            หรือแนวทางที่เทียบเคียงได้ ไม่ใช่ข้อความทั่วไป
          </p>
          {catalogMeta ? (
            <div className="mt-2 rounded-lg border border-emerald-500/25 bg-emerald-950/20 px-2 py-1.5 text-[11px] leading-snug text-emerald-100/95">
              <div className="font-medium text-emerald-50">ตรวจโครงสร้างแคตตาล็อก (refs / seeAlso / ICD)</div>
              <p className="mt-0.5 text-emerald-100/90">
                รีวิวล่าสุด: {catalogMeta.lastReviewed} · หัวข้อรวม {catalogMeta.total} · มีประเด็น {catalogMeta.withIssues}
              </p>
              {catalogMeta.issues.length > 0 ? (
                <ul className="mt-1 max-h-28 list-disc space-y-0.5 overflow-y-auto pl-4 text-emerald-100/85">
                  {catalogMeta.issues.map((row) => (
                    <li key={row.slug}>
                      <span className="font-mono text-[10px] text-emerald-200">{row.slug}</span>: {row.issues.join(" · ")}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-0.5 text-emerald-100/85">ไม่พบ seeAlso ชี้ slug ผิด / ref ไม่รู้จัก / ขาด ICD ในรายการที่โหลด</p>
              )}
            </div>
          ) : null}
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="เช่น sepsis, diarrhea, AKI, J18"
            className="mt-3 w-full rounded-xl border border-slate-700 bg-slate-900/80 px-3 py-2 text-sm outline-none focus:border-cyan-500"
          />
          <div className="mt-3 max-h-[70vh] space-y-1 overflow-y-auto">
            {filtered.map((d) => (
              <button
                key={d.slug}
                onClick={() => setSelected(d.slug)}
                className={`w-full rounded-lg px-3 py-2 text-left text-sm ${
                  active?.slug === d.slug ? "bg-cyan-500/20 text-cyan-100" : "text-slate-300 hover:bg-white/5"
                }`}
              >
                <div className="font-medium">{d.name}</div>
                <div className="mt-0.5 text-xs text-slate-500">
                  {[...d.icd10, ...(d.icd9 || [])].slice(0, 3).join(" · ")}
                </div>
              </button>
            ))}
            {filtered.length === 0 ? <div className="px-2 py-3 text-sm text-slate-500">ไม่พบหัวข้อที่ค้นหา</div> : null}
          </div>
        </aside>

        <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          {active ? (
            <div className="space-y-4">
              <div>
                <h2 className="text-xl font-semibold">{active.name}</h2>
                <p className="mt-1 text-xs text-slate-400">Aliases: {active.aliases.join(", ")}</p>
              </div>
              <div className="rounded-xl border border-amber-500/35 bg-amber-950/20 p-3 text-xs text-amber-100">
                เกณฑ์ตัวเลข (เช่น cutoff ของ lab/vital signs) จะแสดงเฉพาะที่มีใน reference set เท่านั้น; หากหัวข้อใดยังไม่ระบุตัวเลข
                ให้ยึด guideline ต้นทางของหน่วยงานและอย่าเดาเกณฑ์เพิ่มเอง
              </div>
              <div className="rounded-xl border border-slate-600/40 bg-slate-900/40 p-3 text-xs text-slate-300">
                คู่มือตรวจทานรหัสภายในทีม (audit list): <code className="text-cyan-300">docs/KNOWLEDGE_ICD_AUDIT_LIST.md</code>
              </div>

              <Block title="วินิจฉัยที่ควรเขียน" items={active.diagnosisToWrite} />
              <Block title="คิดถึงโรคนี้เมื่อ" items={active.thinkWhen} />
              <Block title="สิ่งที่ควรนึกถึงเพิ่ม" items={active.considerMore} />
              <Block title="ยังไม่ควรลงวินิจฉัยว่า" items={active.notYetDiagnosis} />
              <Block title="Investigations ที่ควรพิจารณา" items={active.investigations} />
              <Block title="คำที่ควรพิมพ์ในสรุปชาร์จ + ICD ที่เกี่ยวข้อง" items={icdDisplayItems} />
              {codingReviewNotes.length > 0 ? (
                <div className="rounded-xl border border-amber-500/35 bg-amber-950/20 p-3">
                  <div className="text-sm font-semibold text-amber-100">จุดที่ควร review รหัสก่อนใช้งานจริง</div>
                  <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-amber-50">
                    {codingReviewNotes.map((note, idx) => (
                      <li key={`review-${idx}`}>{note}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {checklist ? <ChecklistBlock checklist={checklist} /> : null}
              <Block title="ดูหัวข้อถัดไป" items={active.seeAlso} />

              <div className="rounded-xl border border-indigo-500/30 bg-indigo-950/20 p-3">
                <div className="text-xs font-semibold uppercase tracking-wide text-indigo-200">References</div>
                <p className="mt-1 text-[11px] text-slate-400">
                  [R7] แสดงทุกหัวข้อเป็นประตูอ้างอิงหลัก สปสช.; รายการอื่นตามที่ระบุในแคตตาล็อก
                </p>
                <ul className="mt-2 space-y-1 text-sm text-slate-200">
                  {refIdsOrdered
                    .map((id) => references.find((r) => r.id === id))
                    .filter((r): r is KnowledgeReference => Boolean(r))
                    .map((r) => (
                      <li key={r.id}>
                        {r.url ? (
                          <a
                            href={r.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-cyan-300 underline-offset-2 hover:underline"
                          >
                            [{r.id}] {r.title}
                            {r.year ? ` (${r.year})` : ""}
                          </a>
                        ) : (
                          <>
                            [{r.id}] {r.title}
                            {r.year ? ` (${r.year})` : ""}
                          </>
                        )}
                      </li>
                    ))}
                </ul>
              </div>
            </div>
          ) : (
            <div className="text-sm text-slate-400">เลือกหัวข้อจากด้านซ้าย</div>
          )}
        </section>
      </div>
    </main>
  );
}

function Block({ title, items }: { title: string; items: string[] }) {
  const style = BLOCK_STYLES[title] ?? "border-slate-700/70 bg-slate-950/50";
  return (
    <div className={`rounded-xl border p-3 ${style}`}>
      <div className="text-sm font-semibold text-white">{title}</div>
      <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-200">
        {items.map((x, i) => (
          <li key={`${title}-${i}`}>{x}</li>
        ))}
      </ul>
    </div>
  );
}

function formatIcdDisplay(disease: DiseaseSummary): string[] {
  const codeToRawDisplay = new Map<string, string>();
  for (const rawItem of disease.icd10) {
    const normalized = normalizeIcdCode(rawItem);
    if (!normalized) continue;
    if (!codeToRawDisplay.has(normalized)) {
      codeToRawDisplay.set(normalized, rawItem);
    }
  }

  const usedCodes = new Set<string>();
  const formatted: string[] = [];

  for (const entry of disease.diagnosisToWrite) {
    const withTag = entry.match(/^(.*?)\s*\((?:ICD-10:\s*)?([^)]+)\)/i);
    const legacy = entry.match(/^(.*?)\s*\(([^)]+)\)/);
    const matched = withTag ?? legacy;
    if (!matched) continue;

    const diagnosisName = matched[1].trim();
    const normalizedCodes = matched[2]
      .split(/[;,]/)
      .map((c) => normalizeIcdCode(c))
      .filter(Boolean);

    const availableCodes = normalizedCodes.filter((code) => codeToRawDisplay.has(code));
    if (availableCodes.length === 0) {
      formatted.push(`${diagnosisName} (ICD-10: ยังไม่มีข้อมูลอ้างอิง)`);
      continue;
    }

    for (const code of availableCodes) {
      usedCodes.add(code);
    }

    const codeDisplay = availableCodes.map((code) => codeToRawDisplay.get(code) ?? code);
    formatted.push(`${diagnosisName} (ICD-10: ${codeDisplay.join(", ")})`);
  }

  for (const rawItem of disease.icd10) {
    const code = normalizeIcdCode(rawItem);
    if (!code || usedCodes.has(code)) continue;
    formatted.push(`รหัสที่เกี่ยวข้อง (ICD-10: ${rawItem})`);
  }
  for (const rawItem of disease.icd9 || []) {
    const code = normalizeIcdCode(rawItem);
    if (!code || usedCodes.has(code)) continue;
    formatted.push(`รหัสหัตถการที่เกี่ยวข้อง (ICD-9-CM: ${rawItem})`);
  }

  return formatted;
}

function normalizeIcdCode(raw: string): string {
  const cleaned = raw.trim().toUpperCase();
  if (!cleaned) return "";
  const firstToken = cleaned.split(/\s+/)[0] ?? "";
  return firstToken.replace(/[()]/g, "");
}

function isBroadIcdCode(raw: string): boolean {
  const upper = raw.trim().toUpperCase();
  if (!upper) return false;
  return upper.includes(".-") || upper.includes("V01-Y98");
}

type ChecklistView = {
  mustHave: string[];
  supporting: string[];
  avoidIf: string[];
};

function buildChecklist(disease: DiseaseSummary): ChecklistView {
  if (disease.chartChecklist) {
    return {
      mustHave: disease.chartChecklist.mustHave,
      supporting: disease.chartChecklist.supporting ?? [],
      avoidIf: disease.chartChecklist.avoidIf,
    };
  }

  return {
    mustHave: disease.thinkWhen,
    supporting: disease.considerMore,
    avoidIf: disease.notYetDiagnosis,
  };
}

function ChecklistBlock({ checklist }: { checklist: ChecklistView }) {
  return (
    <div className={`rounded-xl border p-3 ${BLOCK_STYLES["Checklist การลงวินิจฉัย"]}`}>
      <div className="text-sm font-semibold text-white">Checklist การลงวินิจฉัย</div>
      <div className="mt-2 space-y-3 text-sm text-slate-100">
        <ChecklistSection title="ต้องมี" items={checklist.mustHave} />
        <ChecklistSection title="ข้อมูลสนับสนุนเพิ่ม" items={checklist.supporting} />
        <ChecklistSection title="ยังไม่ควรลงเมื่อ" items={checklist.avoidIf} />
      </div>
    </div>
  );
}

function ChecklistSection({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <div className="text-xs font-semibold uppercase tracking-wide text-fuchsia-200">{title}</div>
      {items.length > 0 ? (
        <ul className="mt-1 list-disc space-y-1 pl-5 text-slate-100">
          {items.map((item, idx) => (
            <li key={`${title}-${idx}`}>
              <span
                className={`mr-2 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                  classifyEvidenceLevel(item) === "strong"
                    ? "bg-emerald-500/20 text-emerald-200"
                    : "bg-amber-500/20 text-amber-200"
                }`}
              >
                {classifyEvidenceLevel(item) === "strong" ? "strong evidence" : "context-based"}
              </span>
              {item}
            </li>
          ))}
        </ul>
      ) : (
        <div className="mt-1 text-xs text-slate-300">ยังไม่มีข้อมูลในหัวข้อนี้</div>
      )}
    </div>
  );
}

function classifyEvidenceLevel(item: string): "strong" | "context" {
  const text = item.toLowerCase();
  const strongSignals = [
    "<",
    ">",
    ">=",
    "<=",
    "เกณฑ์",
    "ต้องมี",
    "เข้าเกณฑ์",
    "lab",
    "abg",
    "cxr",
    "ct",
    "mri",
    "culture",
    "ns1",
    "serology",
    "mmhg",
    "mg/dl",
    "ml",
    "wbc",
    "platelet",
    "hct",
    "spo2",
    "pao2",
    "fev1/fvc",
  ];

  return strongSignals.some((signal) => text.includes(signal)) ? "strong" : "context";
}

