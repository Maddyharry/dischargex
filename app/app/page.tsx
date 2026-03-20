"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { useFeedbackContext } from "@/app/context/FeedbackContext";

type Block = {
  key: string;
  title: string;
  order: number;
};

type NormalizedBlock = {
  key: string;
  title: string;
  order: number;
  content: string;
  icd10: string;
};

type ResultMeta = {
  losDays: number | null;
  adjrw: number | null;
  diagnosis_confidence: "High" | "Medium" | "Low";
  upgrade: {
    new_principal: string;
    add_icd9: string[];
    projected_adjrw: number;
    increase: number;
    audit_risk: string;
    reason_th: string;
  } | null;
};

type PreprocessSummary = {
  originalChars: number;
  cleanedChars: number;
  removedChars: number;
  removedSummary: string[];
  cleanedPreview: string;
};

type ApiResponse = {
  result: {
    blocks: NormalizedBlock[];
    warnings: string[];
    meta: ResultMeta;
    preprocess: PreprocessSummary;
  };
};

type ToastNotification = {
  id: string;
  title: string;
  message: string;
};

type DiagnosisBucket = "principal" | "comorbidity" | "complication" | "other";

type DiagnosisItem = {
  id: string;
  text: string;
  bucket: DiagnosisBucket;
};

const DEFAULT_BLOCKS: Block[] = [
  { key: "principal_dx", title: "Principal Diagnosis", order: 1 },
  { key: "comorbidity", title: "Comorbidity", order: 2 },
  { key: "complication", title: "Complication", order: 3 },
  { key: "other_diag", title: "Other Diagnosis", order: 4 },
  { key: "external_cause", title: "External Cause", order: 5 },
  { key: "icd9", title: "ICD-9", order: 6 },
  { key: "admit_date", title: "Admit Date", order: 7 },
  { key: "discharge_date", title: "Discharge Date", order: 8 },
  { key: "final_diag", title: "Final Diagnosis", order: 9 },
  { key: "investigations", title: "Investigations", order: 10 },
  { key: "treatment", title: "Treatment", order: 11 },
  { key: "outcome", title: "Outcome", order: 12 },
  { key: "follow_up", title: "Follow-up", order: 13 },
  { key: "home_med", title: "Home Medication", order: 14 },
];

const BASIC_PLAN_LOCKED_KEYS = new Set([
  "admit_date",
  "discharge_date",
  "final_diag",
  "investigations",
  "treatment",
  "outcome",
  "follow_up",
  "home_med",
]);

const DEFAULT_TEMPLATE_RULES = [
  "Principal diagnosis ต้องเป็นโรคเดียวที่เหมาะที่สุดและ audit-safe",
  "Comorbidity ใช้โรคร่วมที่ active หรือมีผลต่อการรักษาใน admit นี้",
  "Complication ต้องเป็นภาวะที่เกิดใหม่หลัง admit / ระหว่างนอน รพ.",
  "Other diagnosis ใช้โรคที่มีมาก่อนเข้า รพ. หรือโรคประจำตัว ที่ไม่ได้มีการรักษาโดยตรงในการ admit ครั้งนี้",
  "Diagnosis ใช้ full English term, no abbreviation, no parentheses",
  "Investigations / Treatment / Home medication ให้เป็น one line และสามารถใช้คำย่อทางการแพทย์หรือ shorthand ยาได้",
  "Outcome ให้ขึ้นต้น improved, refer, dead, against advice เท่านั้น",
  "ICD-9 ให้ใส่เฉพาะ procedure",
].join("\n");

const EXAMPLE_ORDER_SHEET = `Sex: Female
Age: 78 ปี 10 เดือน
=== ORDER_SHEET ===
Date Time ORDER FOR ONE DAY CONTINUOUS ORDER
19/02/69
10:33
Other
- Retain foley's cayth No.14
19/02/69
09:45
Medication
- Diazepam inj. 10 mg/2ml. Ampule (2 ml.) [STAT]
ฉีดเข้าเส้นเลือด 1 amp ทันที
Other
- on ETT , no.7 Mark 19
- refer
- case หญิง 78 ปี U/D HT
admit รพ.บ้านไร่ 18/2/69
CC เหนื่อยมากขึ้น 3 วัน
PI 3 วัน ไข้ ไอเสมหะเยอะ อ่อนเพลีย
วันนี้เหนื่อยมากขึ้น รักษาคลินิกได้ CXR RLL infiltration จึงมารพ.
PE not pale, no jx , dyspnea, lung crepitation RLL, fair air entry,
heart regular, no murmur, abdomen soft, not tender ,
no pitting edema
CXR RLL infiltration
SpO2 84
Dx pneumonia
Rx ceftri + Rulid , berodual NB
เช้านี้ ไอ เหนื่อยมากขึ้น ร้องคราง
RR 36,accesory muscle use, lung crepitation Rt lung, poor air entry
SpO2 83 on mask c bag
on ETT No.7 Mark 19, valium10mg iv ก่อน ETT
1.Lobar pneumonia RLL with septic shock
2.AKI
3.acute respiratory failure
consult นพ.สุรเดช ให้ refer ได้
19/02/69 09:45
S : เหนื่อยมากขึ้น ร้องคราง
accesory m. use RR 36 , SpO2 83 on mask c bag
lung crepitation Rt lung , decrease BS
19/02/69
07:52
Medication
- *Berodual NB 1.25+0.5 mg/4 ml. หลอด (4 ml.)
พ่นผ่านเครื่องละอองฟอย 1 NB q 4 hr [Locked]
- NSS [1,000 ml.] 0.9 % ขวด
IV rate 80 ml/hr
Examination
- Lab : Sputum Culture : <Item>
- Lab : Sputum AFB 1 ครั้ง : <Item>
x 3 วัน
- Lab : Gram stain : <Item>
sputum
19/02/69 07:52
S : case U/D HT
CC เหนื่อยมากขึ้น 3 วัน
PI 3 วัน ไข้ ไอเสมหะเยอะ อ่อนเพลีย มีไข้
วันนี้เหนื่อยมากขึ้น รักษาคลินิกได้ CXR พบ ปอดบวม
O : not pale, no jx , dyspnea, lung crepitation RLL
no pitting edema
CXR RLL infiltration
SpO2 84
A : Lobar pneumonia RLL with septic shock
AKI
P : septic w/u , IV load, IV ATB
19/02/69
07:19
Medication
- Dexamethasone inj. 4 mg/ml. Ampule (1 ml.) [STAT]
ฉีดเข้าเส้นเลือดดำ 1 amp/vial [Locked]
Examination
- Radiology : Film CXR (PA)
19/02/69 07:19
Note : รายงานผู้ป่วยหายใจเหนื่อย RR 28/min retraction หายใจเป่าปาก + urine 100 ml/8hr แพทย์รับทราบ
18/02/69
19:24
Medication
- NSS [1,000 ml.] 0.9 % ขวด
500 ml iv load [Locked]
18/02/69 19:24
S : ปฏิเสธกินยาชุด ยาสมุนไพร ยาหม้อ
O : U/S IVC kissing IVC
try load NSS 500 ml
18/02/69
18:40
Medication
- *Berodual NB 1.25+0.5 mg/4 ml. หลอด (4 ml.)
พ่นผ่านเครื่องละอองฟอย 1 NB q 15 min x 2 doses [Locked]
- *Berodual NB 1.25+0.5 mg/4 ml. หลอด (4 ml.)
พ่นผ่านเครื่องละอองฟอย 1 NB q 4 hr [Locked]
- NSS [1,000 ml.] 0.9 % ขวด
1000 ml iv load [Locked]
- NSS [1,000 ml.] 0.9 % ขวด
IV rate 80 ml/hr
Operation
- E.C.G.(Electrocardiography)`;

function createEmptyBlocks(): NormalizedBlock[] {
  return DEFAULT_BLOCKS.map((b) => ({
    ...b,
    content: "",
    icd10: "",
  }));
}

function emptyPreprocess(): PreprocessSummary {
  return {
    originalChars: 0,
    cleanedChars: 0,
    removedChars: 0,
    removedSummary: [],
    cleanedPreview: "",
  };
}

export default function Page() {
  return (
    <React.Suspense fallback={<main className="min-h-screen bg-[#081120] text-slate-100" />}>
      <PageContent />
    </React.Suspense>
  );
}

function PageContent() {
  const { data: session } = useSession();
  const searchParams = useSearchParams();
  const { setWorkspaceSnapshot, openFeedbackTo } = useFeedbackContext();
  const [orderSheet, setOrderSheet] = useState("");
  const [lab, setLab] = useState("");
  const [radiology, setRadiology] = useState("");
  const [other, setOther] = useState("");

  const [blocks, setBlocks] = useState<NormalizedBlock[]>(createEmptyBlocks());
  const [warnings, setWarnings] = useState<string[]>([]);
  const [meta, setMeta] = useState<ResultMeta>({
    losDays: null,
    adjrw: null,
    diagnosis_confidence: "Low",
    upgrade: null,
  });
  const [preprocess, setPreprocess] = useState<PreprocessSummary>(emptyPreprocess());

  const [diagnosisItems, setDiagnosisItems] = useState<DiagnosisItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [recalcLoading, setRecalcLoading] = useState(false);
  const [copiedKey, setCopiedKey] = useState("");
  const [error, setError] = useState("");

  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverKey, setDragOverKey] = useState<string | null>(null);

  const [caseCount, setCaseCount] = useState(0);
  const [usageInfo, setUsageInfo] = useState<{
    plan: string;
    total: number;
    used: number;
    remaining: number;
    daysLeftInMonth?: number;
  } | null>(null);
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [toasts, setToasts] = useState<ToastNotification[]>([]);

  const recalcTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (recalcTimerRef.current) clearTimeout(recalcTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const key = "dischargex_device_id";
    let id = window.localStorage.getItem(key);
    if (!id) {
      const uuid =
        typeof crypto !== "undefined" &&
        "randomUUID" in crypto &&
        typeof crypto.randomUUID === "function"
          ? crypto.randomUUID()
          : null;
      const newId = uuid || `dev-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      window.localStorage.setItem(key, newId);
      id = newId;
    }
    setDeviceId(id);
  }, []);

  async function loadUsage() {
    try {
      const res = await fetch("/api/usage");
      if (!res.ok) return;
      const data = await res.json();
      if (!data.ok) return;
      setUsageInfo({
        plan: data.plan,
        total: data.total,
        used: data.used,
        remaining: data.remaining,
        daysLeftInMonth: typeof data.daysLeftInMonth === "number" ? data.daysLeftInMonth : undefined,
      });
    } catch {
      // เงียบ ๆ ถ้าโหลดไม่ได้
    }
  }

  useEffect(() => {
    if (session?.user?.email) {
      void loadUsage();
    }
  }, [session?.user?.email]);

  useEffect(() => {
    async function loadUnreadNotifications() {
      try {
        const res = await fetch("/api/notifications?limit=8");
        if (!res.ok) return;
        const data = (await res.json()) as {
          ok?: boolean;
          notifications?: Array<{ id: string; title: string; message: string; readAt: string | null }>;
        };
        if (!data.ok || !Array.isArray(data.notifications)) return;
        const unread = data.notifications
          .filter((n) => !n.readAt)
          .slice(0, 3)
          .map((n) => ({ id: n.id, title: n.title, message: n.message }));
        setToasts(unread);
      } catch {
        // เงียบไว้ ถ้าโหลด noti ไม่ได้
      }
    }

    if (session?.user?.email) {
      void loadUnreadNotifications();
    }
  }, [session?.user?.email]);

  async function dismissToast(id: string) {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    try {
      await fetch("/api/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: [id] }),
      });
    } catch {
      // dismiss ในหน้าได้ แม้ mark read ไม่สำเร็จ
    }
  }

  useEffect(() => {
    const t = searchParams.get("feedback");
    if (t === "report" || t === "chat") {
      openFeedbackTo(t);
    }
  }, [searchParams, openFeedbackTo]);

  // ส่ง snapshot ปัจจุบันให้ Feedback widget สำหรับการแจ้งข้อผิดพลาด
  useEffect(() => {
    setWorkspaceSnapshot({
      orderSheet,
      meta,
      preprocess,
      blocks,
      warnings,
    });
    return () => setWorkspaceSnapshot(null);
  }, [orderSheet, meta, preprocess, blocks, warnings, setWorkspaceSnapshot]);

  const principalItems = useMemo(
    () => diagnosisItems.filter((x) => x.bucket === "principal"),
    [diagnosisItems]
  );
  const comorbidityItems = useMemo(
    () => diagnosisItems.filter((x) => x.bucket === "comorbidity"),
    [diagnosisItems]
  );
  const complicationItems = useMemo(
    () => diagnosisItems.filter((x) => x.bucket === "complication"),
    [diagnosisItems]
  );
  const otherItems = useMemo(
    () => diagnosisItems.filter((x) => x.bucket === "other"),
    [diagnosisItems]
  );

  function normalizeBlocks(input: NormalizedBlock[]) {
    const map = new Map(input.map((b) => [b.key, b]));
    return DEFAULT_BLOCKS.map((def) => ({
      key: def.key,
      title: def.title,
      order: def.order,
      content: map.get(def.key)?.content ?? "",
      icd10: map.get(def.key)?.icd10 ?? "",
    }));
  }

  function getBlockValue(key: string, sourceBlocks = blocks) {
    return sourceBlocks.find((b) => b.key === key)?.content || "";
  }

  function splitComma(text: string) {
    return (text || "")
      .split(",")
      .map((x) => x.trim())
      .filter(Boolean);
  }

  function normalizeDiagnosisItems(items: DiagnosisItem[]) {
    const principal = items.filter((x) => x.bucket === "principal");
    if (principal.length <= 1) return items;

    const keepId = principal[0].id;
    return items.map((item) => {
      if (item.bucket === "principal" && item.id !== keepId) {
        return { ...item, bucket: "comorbidity" as const };
      }
      return item;
    });
  }

  function buildDiagnosisItemsFromBlocks(sourceBlocks: NormalizedBlock[]) {
    const items: DiagnosisItem[] = [];

    const principalList = splitComma(getBlockValue("principal_dx", sourceBlocks));
    const comorbidityList = splitComma(getBlockValue("comorbidity", sourceBlocks));
    const complicationList = splitComma(getBlockValue("complication", sourceBlocks));
    const otherList = splitComma(getBlockValue("other_diag", sourceBlocks));

    if (principalList.length > 0) {
      items.push({
        id: `principal-1-${crypto.randomUUID?.() || Date.now()}`,
        text: principalList[0],
        bucket: "principal",
      });

      principalList.slice(1).forEach((text, index) => {
        items.push({
          id: `principal-overflow-${index + 1}-${crypto.randomUUID?.() || Date.now()}`,
          text,
          bucket: "comorbidity",
        });
      });
    }

    comorbidityList.forEach((text, index) => {
      items.push({
        id: `comorbidity-${index + 1}-${crypto.randomUUID?.() || Date.now()}`,
        text,
        bucket: "comorbidity",
      });
    });

    complicationList.forEach((text, index) => {
      items.push({
        id: `complication-${index + 1}-${crypto.randomUUID?.() || Date.now()}`,
        text,
        bucket: "complication",
      });
    });

    otherList.forEach((text, index) => {
      items.push({
        id: `other-${index + 1}-${crypto.randomUUID?.() || Date.now()}`,
        text,
        bucket: "other",
      });
    });

    return normalizeDiagnosisItems(items);
  }

  function recomputeFinalDiag(sourceBlocks: NormalizedBlock[]) {
    const principal = getBlockValue("principal_dx", sourceBlocks);
    const comorbidity = getBlockValue("comorbidity", sourceBlocks);
    const complication = getBlockValue("complication", sourceBlocks);
    const otherDiag = getBlockValue("other_diag", sourceBlocks);
    const externalCause = getBlockValue("external_cause", sourceBlocks);

    const finalDiag = [principal, comorbidity, complication, otherDiag, externalCause]
      .filter(Boolean)
      .join(", ")
      .replace(/\s*,\s*/g, ", ")
      .replace(/,\s*,/g, ", ")
      .trim()
      .replace(/^,\s*/, "")
      .replace(/,\s*$/, "");

    return sourceBlocks.map((b) =>
      b.key === "final_diag" ? { ...b, content: finalDiag } : b
    );
  }

  function recomputeBlocksFromDiagnosis(
    sourceBlocks: NormalizedBlock[],
    nextItems: DiagnosisItem[]
  ) {
    const principal = nextItems
      .filter((x) => x.bucket === "principal")
      .map((x) => x.text.trim())
      .filter(Boolean)
      .join(", ");

    const comorbidity = nextItems
      .filter((x) => x.bucket === "comorbidity")
      .map((x) => x.text.trim())
      .filter(Boolean)
      .join(", ");

    const complication = nextItems
      .filter((x) => x.bucket === "complication")
      .map((x) => x.text.trim())
      .filter(Boolean)
      .join(", ");

    const otherDiag = nextItems
      .filter((x) => x.bucket === "other")
      .map((x) => x.text.trim())
      .filter(Boolean)
      .join(", ");

    let nextBlocks = sourceBlocks.map((b) => {
      if (b.key === "principal_dx") return { ...b, content: principal };
      if (b.key === "comorbidity") return { ...b, content: comorbidity };
      if (b.key === "complication") return { ...b, content: complication };
      if (b.key === "other_diag") return { ...b, content: otherDiag };
      return b;
    });

    nextBlocks = recomputeFinalDiag(nextBlocks);
    return nextBlocks;
  }

  async function parseApiResponse(res: Response) {
    const raw = await res.text();
    let data: unknown = null;

    try {
      data = raw ? JSON.parse(raw) : null;
    } catch {
      if (raw.startsWith("<!DOCTYPE") || raw.startsWith("<html")) {
        throw new Error(
          "API returned HTML instead of JSON. ตรวจ path ของ route ที่ /app/api/summarize/route.ts และดู server log เพิ่ม"
        );
      }
      throw new Error(raw || "Invalid response from server");
    }

    if (!res.ok) {
      const maybe = data as { error?: unknown; raw?: unknown } | null;
      const msg =
        maybe && typeof maybe === "object"
          ? (typeof maybe.error === "string"
              ? maybe.error
              : typeof maybe.raw === "string"
              ? maybe.raw
              : null)
          : null;
      throw new Error(msg || "Request failed");
    }

    return data as ApiResponse;
  }

  async function recalcFromBlocks(nextBlocks: NormalizedBlock[], silent = false) {
    try {
      setRecalcLoading(true);

      const res = await fetch("/api/summarize", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(deviceId ? { "x-dischargex-device-id": deviceId } : {}),
        },
        body: JSON.stringify({
          mode: "recalc",
          template: { blocks: DEFAULT_BLOCKS },
          currentBlocks: nextBlocks,
          inputs: {
            order_sheet: orderSheet,
            lab,
            radiology,
            other,
          },
          extraNote: "",
          templateRules: DEFAULT_TEMPLATE_RULES,
          settings: {
            model: "gpt-5.4",
          },
        }),
      });

      const parsed = await parseApiResponse(res);
      const refreshedBlocks = normalizeBlocks(parsed.result.blocks);

      setBlocks(refreshedBlocks);
      setWarnings(parsed.result.warnings || []);
      setMeta(parsed.result.meta);
      setPreprocess(parsed.result.preprocess || emptyPreprocess());
      setDiagnosisItems(buildDiagnosisItemsFromBlocks(refreshedBlocks));
    } catch (err) {
      console.error(err);
      if (!silent) {
        setError(err instanceof Error ? err.message : "Recalc failed");
      }
    } finally {
      setRecalcLoading(false);
    }
  }

  function scheduleRecalc(nextBlocks: NormalizedBlock[], delay = 500) {
    if (recalcTimerRef.current) clearTimeout(recalcTimerRef.current);
    recalcTimerRef.current = setTimeout(() => {
      void recalcFromBlocks(nextBlocks, true);
    }, delay);
  }

  async function handleGenerate() {
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/summarize", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(deviceId ? { "x-dischargex-device-id": deviceId } : {}),
        },
        body: JSON.stringify({
          mode: "generate",
          template: { blocks: DEFAULT_BLOCKS },
          inputs: {
            order_sheet: orderSheet,
            lab,
            radiology,
            other,
          },
          extraNote: "",
          templateRules: DEFAULT_TEMPLATE_RULES,
          settings: {
            model: "gpt-5.4",
          },
        }),
      });

      const parsed = await parseApiResponse(res);
      const nextBlocks = normalizeBlocks(parsed.result.blocks);

      setBlocks(nextBlocks);
      setWarnings(parsed.result.warnings || []);
      setMeta(parsed.result.meta);
      setPreprocess(parsed.result.preprocess || emptyPreprocess());
      setDiagnosisItems(buildDiagnosisItemsFromBlocks(nextBlocks));
      setCaseCount((c) => c + 1);
      void loadUsage();
      window.dispatchEvent(new Event("usage-updated"));
    } catch (err) {
      console.error(err);
      const isLimitReached =
        err instanceof Error &&
        (err.message.includes("Credit limit reached") ||
          err.message.includes("ใช้เครดิตเดือนนี้ครบแล้ว") ||
          err.message.includes("ใช้เครดิตในรอบนี้ครบแล้ว") ||
          err.message.includes("หมดรอบการใช้งานแล้ว"));
      if (isLimitReached) {
        setError(
          (err instanceof Error ? err.message : "") + " ไปที่หน้า pricing เพื่อดูแพ็กเกจที่เหมาะกับคุณ"
        );
      } else {
        setError(err instanceof Error ? err.message : "Unknown error");
      }
    } finally {
      setLoading(false);
    }
  }

  function handleNewPatient() {
    setOrderSheet("");
    setLab("");
    setRadiology("");
    setOther("");
    setBlocks(createEmptyBlocks());
    setWarnings([]);
    setMeta({
      losDays: null,
      adjrw: null,
      diagnosis_confidence: "Low",
      upgrade: null,
    });
    setPreprocess(emptyPreprocess());
    setDiagnosisItems([]);
    setError("");
    setWorkspaceSnapshot(null);
  }

  function handleFillExampleCase() {
    setOrderSheet(EXAMPLE_ORDER_SHEET);
    setLab("");
    setRadiology("");
    setOther("");
    setError("");
  }

  function handleDiagnosisTextChange(id: string, value: string) {
    const nextItems = normalizeDiagnosisItems(
      diagnosisItems.map((item) => (item.id === id ? { ...item, text: value } : item))
    );
    const nextBlocks = recomputeBlocksFromDiagnosis(blocks, nextItems);

    setDiagnosisItems(nextItems);
    setBlocks(nextBlocks);
    scheduleRecalc(nextBlocks, 700);
  }

  function addDiagnosis(bucket: DiagnosisBucket) {
    if (bucket === "principal" && diagnosisItems.some((x) => x.bucket === "principal")) {
      return;
    }

    const nextItems = normalizeDiagnosisItems([
      ...diagnosisItems,
      {
        id: `${bucket}-${crypto.randomUUID?.() || Date.now()}`,
        text: "",
        bucket,
      },
    ]);

    const nextBlocks = recomputeBlocksFromDiagnosis(blocks, nextItems);
    setDiagnosisItems(nextItems);
    setBlocks(nextBlocks);
    scheduleRecalc(nextBlocks, 400);
  }

  function removeDiagnosis(id: string) {
    const nextItems = diagnosisItems.filter((item) => item.id !== id);
    const nextBlocks = recomputeBlocksFromDiagnosis(blocks, nextItems);

    setDiagnosisItems(nextItems);
    setBlocks(nextBlocks);
    scheduleRecalc(nextBlocks, 400);
  }

  function handleDragStart(id: string) {
    setDraggingId(id);
  }

  function handleDragEnd() {
    setDraggingId(null);
    setDragOverKey(null);
  }

  function moveDiagnosisToBucket(
    dragId: string,
    targetBucket: DiagnosisBucket,
    targetIndex?: number
  ) {
    const dragged = diagnosisItems.find((x) => x.id === dragId);
    if (!dragged) return;

    const sourceBucket = dragged.bucket;

    if (targetBucket === "principal") {
      const currentPrincipal = diagnosisItems.find(
        (x) => x.bucket === "principal" && x.id !== dragId
      );

      let nextItems: DiagnosisItem[];

      if (currentPrincipal) {
        nextItems = diagnosisItems.map((item) => {
          if (item.id === dragId) {
            return { ...item, bucket: "principal" as const };
          }
          if (item.id === currentPrincipal.id) {
            return { ...item, bucket: sourceBucket };
          }
          return item;
        });
      } else {
        nextItems = diagnosisItems.map((item) =>
          item.id === dragId ? { ...item, bucket: "principal" as const } : item
        );
      }

      nextItems = normalizeDiagnosisItems(nextItems);
      const nextBlocks = recomputeBlocksFromDiagnosis(blocks, nextItems);

      setDiagnosisItems(nextItems);
      setBlocks(nextBlocks);
      scheduleRecalc(nextBlocks, 250);
      return;
    }

    const rest = diagnosisItems.filter((x) => x.id !== dragId);
    const nonTarget = rest.filter((x) => x.bucket !== targetBucket);
    const targetItems = rest.filter((x) => x.bucket === targetBucket);

    const moved = { ...dragged, bucket: targetBucket };
    const insertIndex =
      typeof targetIndex === "number"
        ? Math.max(0, Math.min(targetIndex, targetItems.length))
        : targetItems.length;

    const newTargetItems = [
      ...targetItems.slice(0, insertIndex),
      moved,
      ...targetItems.slice(insertIndex),
    ];

    const nextItems = normalizeDiagnosisItems([...nonTarget, ...newTargetItems]);
    const nextBlocks = recomputeBlocksFromDiagnosis(blocks, nextItems);

    setDiagnosisItems(nextItems);
    setBlocks(nextBlocks);
    scheduleRecalc(nextBlocks, 250);
  }

  function getBucketItems(bucket: DiagnosisBucket) {
    return diagnosisItems.filter((x) => x.bucket === bucket);
  }

  function getDropIndex(bucket: DiagnosisBucket, targetId?: string) {
    const items = getBucketItems(bucket);
    if (!targetId) return items.length;
    return items.findIndex((x) => x.id === targetId);
  }

  async function copyText(key: string, text: string) {
    await navigator.clipboard.writeText(text || "");
    setCopiedKey(key);
    window.setTimeout(() => {
      setCopiedKey((prev) => (prev === key ? "" : prev));
    }, 1200);
  }

  function parseIcd9Items(text: string) {
    const raw = (text || "").trim();
    if (!raw) return [];

    const cleanTail = (s: string) =>
      s
        .trim()
        .replace(/[,\s]+$/g, "")
        .trim();

    const unique = (arr: string[]) =>
      Array.from(new Set(arr.map(cleanTail).filter(Boolean)));

    const normalized = raw
      .replace(/\r/g, "\n")
      .replace(/•/g, "\n")
      .replace(/\s*;\s*/g, "\n")
      .trim();

    const lineBased = normalized
      .split(/\n+/)
      .map((x) => cleanTail(x))
      .filter(Boolean);

    if (lineBased.length > 1) return unique(lineBased);

    const oneLine = cleanTail(lineBased[0] || raw);
    const codeRegex = /\b\d{2,3}(?:\.\d{1,2})?\b/g;
    const matches = [...oneLine.matchAll(codeRegex)];

    if (matches.length <= 1) {
      return unique([oneLine]);
    }

    const segments: string[] = [];

    for (let i = 0; i < matches.length; i++) {
      const start = matches[i].index ?? 0;
      const end = i < matches.length - 1 ? matches[i + 1].index ?? oneLine.length : oneLine.length;
      const piece = cleanTail(
        oneLine
          .slice(start, end)
          .trim()
          .replace(/^,\s*/, "")
          .replace(/\s+,/g, ",")
      );

      if (piece) segments.push(piece);
    }

    return unique(segments);
  }

  const icd9Items = parseIcd9Items(getBlockValue("icd9"));

  const copyAllText = blocks
    .slice()
    .sort((a, b) => a.order - b.order)
    .map((b) => `${b.title}: ${b.content}`)
    .join("\n");

  const confidenceText =
    meta.diagnosis_confidence === "High"
      ? "ข้อมูลค่อนข้างครบและ field สำคัญสอดคล้องกัน แต่ยังต้องตรวจโดยแพทย์ก่อนใช้งานจริง"
      : meta.diagnosis_confidence === "Medium"
      ? "มีข้อมูลพอสมควร แต่ยังอาจมี diagnosis, ICD-9, outcome หรือ follow-up ที่ต้องทวน chart เพิ่ม"
      : "ข้อมูลยังไม่ครบหรือมีความไม่แน่นอนสูง ต้องตรวจซ้ำกับ order sheet และเวชระเบียนอย่างรอบคอบ";

  return (
    <main className="min-h-screen bg-[#081120] text-slate-100">
      <div className="fixed right-4 top-4 z-50 space-y-2">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className="w-[320px] rounded-2xl border border-cyan-500/30 bg-slate-950/95 p-3 shadow-2xl shadow-black/40 backdrop-blur"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-sm font-semibold text-cyan-300">{toast.title}</div>
                <div className="mt-1 text-xs leading-5 text-slate-200 whitespace-pre-wrap">{toast.message}</div>
              </div>
              <button
                type="button"
                onClick={() => void dismissToast(toast.id)}
                className="rounded-md border border-slate-700 px-2 py-1 text-[11px] text-slate-300 hover:bg-slate-800"
              >
                ปิด
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute left-[-120px] top-[-120px] h-80 w-80 rounded-full bg-cyan-500/10 blur-3xl" />
        <div className="absolute right-[-80px] top-[40px] h-72 w-72 rounded-full bg-indigo-500/10 blur-3xl" />
        <div className="absolute bottom-[-120px] left-[20%] h-80 w-80 rounded-full bg-emerald-500/10 blur-3xl" />
      </div>

      <div className="relative mx-auto max-w-7xl space-y-6 px-4 py-6">
        <section className="overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-slate-950 via-[#0c1728] to-[#111c32] shadow-2xl shadow-black/30">
          <div className="grid gap-6 px-6 py-7 lg:grid-cols-[1.2fr_0.8fr] lg:px-8">
            <div className="space-y-4">
              <div className="inline-flex items-center gap-2 rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-xs font-medium uppercase tracking-[0.18em] text-cyan-300">
                AI-assisted discharge workflow
              </div>

              <div>
                <h1 className="text-3xl font-semibold tracking-tight text-white md:text-5xl">
                  Discharge<span className="text-cyan-400">X</span>
                </h1>
                <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300 md:text-base">
                  ช่วยสรุปชาร์จ จัดกลุ่ม diagnosis ตรวจความสอดคล้องของ field สำคัญ
                  และลดงาน copy-paste ใน workflow ของแพทย์และ coder
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <FeaturePill text="Drag & Drop Diagnosis" />
                <FeaturePill text="Live ICD-10 Recalc" />
                <FeaturePill text="AdjRW Re-estimate" />
                <FeaturePill text="Preprocess Summary" />
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur">
              <div className="text-sm font-semibold text-white">ข้อจำกัดการใช้งาน</div>
              <div className="mt-3 space-y-2 text-sm leading-6 text-slate-300">
                <p>
                  โปรแกรมนี้เป็น <span className="font-semibold text-cyan-300">AI assistant</span>{" "}
                  เพื่อช่วยสรุปข้อมูลและจัดโครงสร้าง discharge summary เท่านั้น
                </p>
                <p>
                  ผลลัพธ์ทุกช่องต้องได้รับการ{" "}
                  <span className="font-semibold text-amber-300">ตรวจสอบซ้ำโดยแพทย์ / coder</span>{" "}
                  ก่อนนำไปใช้งานจริง
                </p>
                <p>
                  โดยเฉพาะ Principal diagnosis, Comorbidity, Complication, ICD-9,
                  Outcome และ Follow-up ต้องอ้างอิงจากเวชระเบียนจริงเสมอ
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
          <div className="space-y-4">
            <Card title="เริ่มต้นใช้งาน (สำหรับผู้ใช้ใหม่)" subtitle="ทำตาม 3 ขั้นตอนนี้เพื่อเริ่มใช้งานได้ทันที">
              <ol className="space-y-2 text-sm text-slate-200">
                <li>1) Copy ข้อมูลทั้งหน้าจากระบบ order sheet แล้ววางในช่อง Clinical Input Workspace</li>
                <li>2) กดปุ่ม "สร้างสรุป" แล้วรอผลลัพธ์</li>
                <li>3) ตรวจทานผลลัพธ์ก่อนคัดลอกไปใช้งานจริง</li>
              </ol>
              <p className="mt-3 text-xs text-slate-400">
                หมายเหตุ: เหมาะสำหรับหน่วยงานที่ใช้ระบบ IPD paperless (มีข้อมูลข้อความให้ copy ได้)
              </p>
              <p className="mt-2 text-xs text-cyan-200">
                เพื่อความปลอดภัย ระบบจะตัดข้อมูลสำคัญของผู้ป่วยออกก่อนนำไปประมวลผล
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={handleFillExampleCase}
                  className="rounded-xl border border-cyan-500/40 bg-cyan-500/10 px-3 py-2 text-xs font-medium text-cyan-200 hover:bg-cyan-500/20"
                >
                  วางตัวอย่างอัตโนมัติ
                </button>
                <button
                  type="button"
                  onClick={handleNewPatient}
                  className="rounded-xl border border-slate-700 bg-slate-900/80 px-3 py-2 text-xs font-medium text-slate-200 hover:bg-slate-800"
                >
                  ล้างข้อมูลทั้งหมด
                </button>
              </div>
            </Card>

            <Card title="Clinical Input Workspace" subtitle="Paste source data ที่ต้องการให้ AI ช่วยสรุป">
              <ScrollTextarea
                value={orderSheet}
                onChange={(e) => setOrderSheet(e.target.value)}
                placeholder="Paste doctor order sheet..."
                className="h-[340px] w-full rounded-2xl border border-slate-700/80 bg-slate-950/80 px-4 py-3 text-sm text-slate-100 outline-none transition focus:border-cyan-500"
              />
            </Card>

            <div className="grid gap-4 md:grid-cols-2">
              <Card title="Lab" subtitle="Optional">
                <AutoResizeTextarea
                  value={lab}
                  onChange={(e) => setLab(e.target.value)}
                  placeholder="Paste lab..."
                  className="w-full rounded-2xl border border-slate-700/80 bg-slate-950/80 px-4 py-3 text-sm text-slate-100 outline-none transition focus:border-cyan-500"
                />
              </Card>

              <Card title="Radiology" subtitle="Optional">
                <AutoResizeTextarea
                  value={radiology}
                  onChange={(e) => setRadiology(e.target.value)}
                  placeholder="Paste radiology..."
                  className="w-full rounded-2xl border border-slate-700/80 bg-slate-950/80 px-4 py-3 text-sm text-slate-100 outline-none transition focus:border-cyan-500"
                />
              </Card>
            </div>

            <Card title="Other / Extra Clinical Text" subtitle="Optional supporting note">
              <AutoResizeTextarea
                value={other}
                onChange={(e) => setOther(e.target.value)}
                placeholder="Paste other note..."
                className="w-full rounded-2xl border border-slate-700/80 bg-slate-950/80 px-4 py-3 text-sm text-slate-100 outline-none transition focus:border-cyan-500"
              />
            </Card>

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={handleGenerate}
                disabled={loading || !orderSheet.trim()}
                className="rounded-2xl bg-gradient-to-r from-cyan-500 to-blue-600 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-cyan-900/30 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading ? "กำลังสร้าง..." : "สร้างสรุป"}
              </button>

              <button
                type="button"
                onClick={handleNewPatient}
                className="rounded-2xl border border-slate-700 bg-slate-900/80 px-5 py-3 text-sm font-medium text-slate-100 transition hover:bg-slate-800"
              >
                ผู้ป่วยใหม่
              </button>

              <button
                type="button"
                onClick={() => copyText("copy-all", copyAllText)}
                className="rounded-2xl border border-slate-700 bg-slate-900/80 px-5 py-3 text-sm font-medium text-slate-100 transition hover:bg-slate-800"
              >
                {copiedKey === "copy-all" ? "คัดลอกแล้ว" : "คัดลอกทั้งหมด"}
              </button>

              {usageInfo ? (
                <span className="text-xs text-slate-400">
                  เครดิตในรอบนี้ ใช้ไป{" "}
                  <span className="font-semibold text-slate-100">{usageInfo.used}</span>
                  {" / "}
                  <span className="font-semibold text-emerald-300">{usageInfo.total}</span>{" "}
                  เคส (คงเหลือ{" "}
                  <span className="font-semibold text-emerald-300">{usageInfo.remaining}</span>
                  )
                  {usageInfo.daysLeftInMonth !== undefined && (
                    <> · เหลืออีก {usageInfo.daysLeftInMonth} วัน</>
                  )}
                </span>
              ) : (
                <span className="text-xs text-slate-400">
                  Used this account:{" "}
                  <span className="font-semibold text-slate-100">
                    {caseCount}
                  </span>{" "}
                  cases
                </span>
              )}
            </div>

            {error ? (
              <div className="rounded-2xl border border-red-900/60 bg-red-950/30 px-4 py-3 text-sm text-red-300">
                {error.includes("Credit limit reached") ||
                error.includes("ใช้เครดิตเดือนนี้ครบแล้ว") ||
                error.includes("ใช้เครดิตในรอบนี้ครบแล้ว") ||
                error.includes("หมดรอบการใช้งานแล้ว") ? (
                  <>
                    {error.split(" ไปที่หน้า pricing")[0]}
                    {" "}
                    <a href="/pricing" className="font-medium underline hover:text-red-200">
                      ไปที่หน้า pricing
                    </a>
                    เพื่อดูแพ็กเกจที่เหมาะกับคุณ
                  </>
                ) : (
                  error
                )}
              </div>
            ) : null}
          </div>

          <div className="space-y-4">
            <Card title="Clinical Signal" subtitle="ภาพรวมความพร้อมของข้อมูล">
              <div className="grid gap-3 md:grid-cols-3">
                <Stat label="LOS Days" value={meta.losDays ?? "-"} />
                <Stat label="Adj RW (estimate)" value={meta.adjrw ?? "-"} />
                <Stat
                  label="Confidence"
                  value={
                    <div className="flex items-center gap-2">
                      <span>{meta.diagnosis_confidence}</span>
                      <Tooltip text={confidenceText} />
                    </div>
                  }
                />
              </div>

              {recalcLoading ? (
                <div className="mt-3 text-xs text-cyan-300">
                  Recalculating ICD-10 / AdjRW...
                </div>
              ) : null}

              {meta.adjrw !== null ? (
                <div className="mt-4 rounded-2xl border border-amber-700/40 bg-amber-950/20 p-4 text-sm text-amber-100">
                  <div className="font-semibold">คำแนะนำเพิ่มโอกาส Adj RW / Coding</div>
                  {meta.upgrade ? (
                    <div className="mt-2 space-y-1 text-amber-200/90">
                      <div><b>New principal:</b> {meta.upgrade.new_principal || "-"}</div>
                      <div><b>Add ICD-9:</b> {(meta.upgrade.add_icd9 || []).join(", ") || "-"}</div>
                      <div><b>Projected Adj RW:</b> {meta.upgrade.projected_adjrw}</div>
                      <div><b>Increase:</b> {meta.upgrade.increase}</div>
                      <div><b>Audit risk:</b> {meta.upgrade.audit_risk}</div>
                      <div><b>Reason:</b> {meta.upgrade.reason_th}</div>
                    </div>
                  ) : (
                    <div className="mt-2 text-amber-200/90">
                      ยังไม่พบคำแนะนำเพิ่มเติมในเคสนี้ (ผลประเมินปัจจุบันอาจเพียงพอแล้ว)
                    </div>
                  )}
                </div>
              ) : null}
            </Card>

            <Card title="Preprocess Summary" subtitle="สิ่งที่ถูก clean ก่อนส่งเข้า AI">
              <div className="grid gap-3 md:grid-cols-3">
                <Stat label="Original chars" value={preprocess.originalChars || "-"} />
                <Stat label="Cleaned chars" value={preprocess.cleanedChars || "-"} />
                <Stat label="Removed chars" value={preprocess.removedChars || "-"} />
              </div>

              {preprocess.removedSummary.length ? (
                <div className="mt-4 space-y-2">
                  {preprocess.removedSummary.map((item, index) => (
                    <div
                      key={`${item}-${index}`}
                      className="rounded-2xl border border-slate-700/70 bg-slate-950/70 px-4 py-3 text-sm text-slate-200"
                    >
                      {item}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="mt-4 text-sm text-slate-500">No preprocess summary</div>
              )}

              {preprocess.cleanedPreview ? (
                <details className="mt-4 rounded-2xl border border-slate-700/70 bg-slate-950/70 p-4">
                  <summary className="cursor-pointer text-sm font-medium text-slate-200">
                    Cleaned text preview
                  </summary>
                  <pre className="mt-3 whitespace-pre-wrap text-xs leading-6 text-slate-400">
                    {preprocess.cleanedPreview}
                  </pre>
                </details>
              ) : null}
            </Card>

            <Card title="Warnings" subtitle="สิ่งที่ควรทวนก่อน copy ไปใช้">
              {warnings.length ? (
                <div className="space-y-2">
                  {warnings.map((w, i) => (
                    <div
                      key={`${w}-${i}`}
                      className="rounded-2xl border border-yellow-900/40 bg-yellow-950/20 px-4 py-3 text-sm text-yellow-200"
                    >
                      {w}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-sm text-slate-500">No warnings</div>
              )}
            </Card>
          </div>
        </section>

        <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-5 backdrop-blur">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-white">Diagnosis Reorder Studio</h2>
              <p className="text-sm text-slate-400">
                ลาก diagnosis ไปจัดกลุ่มให้ตรง clinical meaning ของเคส
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <ActionPill onClick={() => addDiagnosis("principal")} text="+ Principal" />
              <ActionPill onClick={() => addDiagnosis("comorbidity")} text="+ Comorbidity" />
              <ActionPill onClick={() => addDiagnosis("complication")} text="+ Complication" />
              <ActionPill onClick={() => addDiagnosis("other")} text="+ Other" />
            </div>
          </div>

          <div className="grid gap-4 xl:grid-cols-4">
            <DiagnosisColumn
              title="Principal"
              subtitle="โรคหลักของการ admit"
              bucket="principal"
              items={principalItems}
              draggingId={draggingId}
              dragOverKey={dragOverKey}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
              onDropToColumn={() => draggingId && moveDiagnosisToBucket(draggingId, "principal")}
              onDropBefore={(targetId) =>
                draggingId &&
                moveDiagnosisToBucket(draggingId, "principal", getDropIndex("principal", targetId))
              }
              onDragOverColumn={() => setDragOverKey("principal-column")}
              onDragLeaveColumn={() => setDragOverKey(null)}
              onDragOverItem={(targetId) => setDragOverKey(`principal-${targetId}`)}
              onDragLeaveItem={() => setDragOverKey(null)}
              onChangeText={handleDiagnosisTextChange}
              onRemove={removeDiagnosis}
            />

            <DiagnosisColumn
              title="Comorbidity"
              subtitle="active / monitored / treated"
              bucket="comorbidity"
              items={comorbidityItems}
              draggingId={draggingId}
              dragOverKey={dragOverKey}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
              onDropToColumn={() => draggingId && moveDiagnosisToBucket(draggingId, "comorbidity")}
              onDropBefore={(targetId) =>
                draggingId &&
                moveDiagnosisToBucket(draggingId, "comorbidity", getDropIndex("comorbidity", targetId))
              }
              onDragOverColumn={() => setDragOverKey("comorbidity-column")}
              onDragLeaveColumn={() => setDragOverKey(null)}
              onDragOverItem={(targetId) => setDragOverKey(`comorbidity-${targetId}`)}
              onDragLeaveItem={() => setDragOverKey(null)}
              onChangeText={handleDiagnosisTextChange}
              onRemove={removeDiagnosis}
            />

            <DiagnosisColumn
              title="Complication"
              subtitle="ภาวะเกิดใหม่ใน รพ."
              bucket="complication"
              items={complicationItems}
              draggingId={draggingId}
              dragOverKey={dragOverKey}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
              onDropToColumn={() => draggingId && moveDiagnosisToBucket(draggingId, "complication")}
              onDropBefore={(targetId) =>
                draggingId &&
                moveDiagnosisToBucket(draggingId, "complication", getDropIndex("complication", targetId))
              }
              onDragOverColumn={() => setDragOverKey("complication-column")}
              onDragLeaveColumn={() => setDragOverKey(null)}
              onDragOverItem={(targetId) => setDragOverKey(`complication-${targetId}`)}
              onDragLeaveItem={() => setDragOverKey(null)}
              onChangeText={handleDiagnosisTextChange}
              onRemove={removeDiagnosis}
            />

            <DiagnosisColumn
              title="Other Diagnosis"
              subtitle="เดิม / ไม่ได้รักษา"
              bucket="other"
              items={otherItems}
              draggingId={draggingId}
              dragOverKey={dragOverKey}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
              onDropToColumn={() => draggingId && moveDiagnosisToBucket(draggingId, "other")}
              onDropBefore={(targetId) =>
                draggingId &&
                moveDiagnosisToBucket(draggingId, "other", getDropIndex("other", targetId))
              }
              onDragOverColumn={() => setDragOverKey("other-column")}
              onDragLeaveColumn={() => setDragOverKey(null)}
              onDragOverItem={(targetId) => setDragOverKey(`other-${targetId}`)}
              onDragLeaveItem={() => setDragOverKey(null)}
              onChangeText={handleDiagnosisTextChange}
              onRemove={removeDiagnosis}
            />
          </div>
        </section>

        <section className="grid gap-4 xl:grid-cols-2">
          {blocks
            .slice()
            .sort((a, b) => a.order - b.order)
            .map((block) => {
              const plan = (session?.user as { plan?: string } | null | undefined)?.plan ?? "trial";
              const isLockedBasic = plan === "basic" && BASIC_PLAN_LOCKED_KEYS.has(block.key);
              return (
              <FieldCard
                key={block.key}
                label={block.title}
                value={block.content}
                icd10={block.icd10}
                copied={copiedKey === block.key}
                onCopy={() => copyText(block.key, block.content)}
                readOnly={isLockedBasic}
                onChange={(value) => {
                  const nextBlocksBase = blocks.map((b) =>
                    b.key === block.key ? { ...b, content: value } : b
                  );

                  if (
                    block.key === "principal_dx" ||
                    block.key === "comorbidity" ||
                    block.key === "complication" ||
                    block.key === "other_diag"
                  ) {
                    const nextItems = buildDiagnosisItemsFromBlocks(nextBlocksBase);
                    const finalBlocks = recomputeBlocksFromDiagnosis(nextBlocksBase, nextItems);
                    setDiagnosisItems(nextItems);
                    setBlocks(finalBlocks);
                    scheduleRecalc(finalBlocks, 700);
                    return;
                  }

                  if (block.key === "external_cause") {
                    const finalBlocks = recomputeFinalDiag(nextBlocksBase);
                    setBlocks(finalBlocks);
                    return;
                  }

                  setBlocks(nextBlocksBase);
                }}
                extraFooter={
                  block.key === "icd9" ? (
                    <div className="mt-4 space-y-2">
                      <div className="text-xs font-medium text-slate-400">
                        Separate ICD-9 copy
                      </div>

                      {icd9Items.length ? (
                        icd9Items.map((item, index) => (
                          <div
                            key={`${item}-${index}`}
                            className="flex items-start justify-between gap-3 rounded-2xl border border-slate-700/70 bg-slate-950/80 p-3"
                          >
                            <div className="text-sm leading-6 text-slate-200">{item}</div>
                            <button
                              type="button"
                              onClick={() => copyText(`icd9-item-${index}`, item)}
                              className="shrink-0 rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-xs font-medium text-slate-100 transition hover:bg-slate-800"
                            >
                              {copiedKey === `icd9-item-${index}` ? "คัดลอกแล้ว" : "คัดลอก"}
                            </button>
                          </div>
                        ))
                      ) : (
                        <div className="text-sm text-slate-500">ไม่พบรายการ ICD-9</div>
                      )}
                    </div>
                  ) : null
                }
              />
            );
            })}
        </section>
      </div>
    </main>
  );
}

function FeaturePill({ text }: { text: string }) {
  return (
    <div className="rounded-full border border-slate-700/70 bg-slate-900/70 px-3 py-1 text-xs text-slate-300">
      {text}
    </div>
  );
}

function ActionPill({ text, onClick }: { text: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-2xl border border-slate-700 bg-slate-900/80 px-3 py-2 text-sm text-slate-100 transition hover:bg-slate-800"
    >
      {text}
    </button>
  );
}

function Card({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-4 shadow-2xl shadow-black/20 backdrop-blur">
      <div className="mb-3">
        <div className="text-sm font-semibold text-slate-100">{title}</div>
        {subtitle ? <div className="text-xs text-slate-500">{subtitle}</div> : null}
      </div>
      {children}
    </div>
  );
}

function Stat({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-slate-700/70 bg-slate-950/70 p-4">
      <div className="text-xs text-slate-500">{label}</div>
      <div className="mt-2 text-base font-semibold text-slate-100">{value}</div>
    </div>
  );
}

function Tooltip({ text }: { text: string }) {
  return (
    <div className="group relative z-50 inline-flex">
      <div className="flex h-5 w-5 cursor-help items-center justify-center rounded-full border border-cyan-500/40 bg-cyan-500/10 text-[11px] font-bold text-cyan-300">
        ?
      </div>
      <div className="pointer-events-none absolute bottom-full left-1/2 z-[100] mb-2 hidden w-72 -translate-x-1/2 rounded-2xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs leading-5 text-slate-200 shadow-2xl shadow-black/40 group-hover:block">
        {text}
      </div>
    </div>
  );
}

function FieldCard({
  label,
  value,
  icd10,
  onChange,
  onCopy,
  copied,
  readOnly,
  extraFooter,
}: {
  label: string;
  value: string;
  icd10?: string;
  onChange: (value: string) => void;
  onCopy: () => void;
  copied: boolean;
  readOnly?: boolean;
  extraFooter?: React.ReactNode;
}) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-4 shadow-2xl shadow-black/20 backdrop-blur">
      <div className="mb-2 flex items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-slate-100">{label}</span>
            {readOnly ? (
              <span className="rounded-full border border-amber-600/50 bg-amber-950/30 px-2 py-0.5 text-[10px] font-medium text-amber-300">
                Basic: อัปเกรดเพื่อแก้ไข
              </span>
            ) : null}
          </div>
          {icd10 ? <div className="text-xs text-slate-500">ICD-10: {icd10}</div> : null}
        </div>

        <button
          type="button"
          onClick={onCopy}
          className="rounded-xl border border-slate-700 bg-slate-900/80 px-3 py-2 text-xs font-medium text-slate-100 transition hover:bg-slate-800"
        >
          {copied ? "คัดลอกแล้ว" : "คัดลอก"}
        </button>
      </div>

      {readOnly ? (
        <div className="min-h-[2.5rem] w-full rounded-2xl border border-slate-700/50 bg-slate-950/50 px-4 py-3 text-sm text-slate-400">
          {value || "—"}
        </div>
      ) : (
        <AutoResizeTextarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={1}
          className="w-full rounded-2xl border border-slate-700/80 bg-slate-950/80 px-4 py-3 text-sm text-slate-100 outline-none transition focus:border-cyan-500"
        />
      )}

      {extraFooter}
    </div>
  );
}

function DiagnosisColumn({
  title,
  subtitle,
  bucket,
  items,
  draggingId,
  dragOverKey,
  onDragStart,
  onDragEnd,
  onDropToColumn,
  onDropBefore,
  onDragOverColumn,
  onDragLeaveColumn,
  onDragOverItem,
  onDragLeaveItem,
  onChangeText,
  onRemove,
}: {
  title: string;
  subtitle: string;
  bucket: DiagnosisBucket;
  items: DiagnosisItem[];
  draggingId: string | null;
  dragOverKey: string | null;
  onDragStart: (id: string) => void;
  onDragEnd: () => void;
  onDropToColumn: () => void;
  onDropBefore: (targetId: string) => void;
  onDragOverColumn: () => void;
  onDragLeaveColumn: () => void;
  onDragOverItem: (targetId: string) => void;
  onDragLeaveItem: () => void;
  onChangeText: (id: string, value: string) => void;
  onRemove: (id: string) => void;
}) {
  const isActive = dragOverKey === `${bucket}-column`;

  return (
    <div
      className={`rounded-3xl border p-3 transition ${
        isActive
          ? "border-cyan-500/70 bg-cyan-950/20"
          : "border-slate-700/70 bg-slate-950/60"
      }`}
      onDragOver={(e) => {
        e.preventDefault();
        onDragOverColumn();
      }}
      onDragLeave={onDragLeaveColumn}
      onDrop={(e) => {
        e.preventDefault();
        onDropToColumn();
        onDragLeaveColumn();
      }}
    >
      <div className="mb-3">
        <div className="text-sm font-semibold text-slate-100">{title}</div>
        <div className="text-xs text-slate-500">{subtitle}</div>
      </div>

      <div className="space-y-2">
        {items.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-700 bg-slate-900/70 px-3 py-4 text-sm text-slate-500">
            Drop diagnosis here
          </div>
        ) : null}

        {items.map((item) => {
          const isDragging = draggingId === item.id;
          const isOver = dragOverKey === `${bucket}-${item.id}`;

          return (
            <div key={item.id}>
              <div
                className={`mb-2 h-2 rounded-full transition ${
                  isOver ? "bg-cyan-500/50" : "bg-transparent"
                }`}
                onDragOver={(e) => {
                  e.preventDefault();
                  onDragOverItem(item.id);
                }}
                onDragLeave={onDragLeaveItem}
                onDrop={(e) => {
                  e.preventDefault();
                  onDropBefore(item.id);
                  onDragLeaveItem();
                }}
              />

              <div
                draggable
                onDragStart={() => onDragStart(item.id)}
                onDragEnd={onDragEnd}
                className={`rounded-2xl border border-slate-700/70 bg-[#0d1627] p-3 shadow-lg shadow-black/20 transition ${
                  isDragging ? "opacity-60" : "opacity-100"
                }`}
              >
                <div className="mb-2 flex items-center justify-between gap-2">
                  <span className="cursor-grab text-xs text-slate-500">↕ ลาก</span>
                  <button
                    type="button"
                    onClick={() => onRemove(item.id)}
                    className="rounded-xl border border-slate-700 bg-slate-900/80 px-2 py-1 text-xs text-slate-100 hover:bg-slate-800"
                  >
                    ลบ
                  </button>
                </div>

                <AutoResizeTextarea
                  value={item.text}
                  onChange={(e) => onChangeText(item.id, e.target.value)}
                  rows={1}
                  placeholder="Diagnosis..."
                  className="w-full rounded-2xl border border-slate-700/80 bg-slate-950/80 px-4 py-3 text-sm text-slate-100 outline-none transition focus:border-cyan-500"
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function AutoResizeTextarea(
  props: React.TextareaHTMLAttributes<HTMLTextAreaElement>
) {
  const ref = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "0px";
    el.style.height = `${el.scrollHeight}px`;
  }, [props.value]);

  return (
    <textarea
      {...props}
      ref={ref}
      style={{ resize: "none", overflow: "hidden" }}
    />
  );
}

function ScrollTextarea(
  props: React.TextareaHTMLAttributes<HTMLTextAreaElement>
) {
  return (
    <textarea
      {...props}
      style={{ resize: "vertical", overflowY: "auto" }}
    />
  );
}