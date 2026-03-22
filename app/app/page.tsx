"use client";

import React, { useEffect, useRef, useState, forwardRef } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  buildTutorialMockApiResponse,
  readWorkspaceTutorialDone,
  WORKSPACE_TUTORIAL_DONE_KEY,
} from "@/lib/tutorial-mock";
import { useFeedbackContext } from "@/app/context/FeedbackContext";
import { ResultDisclaimer } from "@/app/components/ResultDisclaimer";
import {
  TutorialCompleteModal,
  TutorialIntroModal,
} from "@/app/components/WorkspaceTutorialModals";
import { WorkspaceTutorialOverlay } from "@/app/components/WorkspaceTutorialOverlay";
import { type WorkspaceCoachPhase } from "@/app/components/WorkspaceTutorialFloating";
import type { DiagnosisEngineItem, DischargeEnginePayload } from "@/lib/discharge-engine/types";

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
    engine?: DischargeEnginePayload | null;
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

type WorkspacePanelKey =
  | "quickStart"
  | "clinicalSignal"
  | "preprocessSummary"
  | "warnings";

/** flow แบบเกม: intro → mock หน้าต่าง → workspace → สร้างสรุป → จบ */
type TutorialPhase =
  | "off"
  | "intro_modal"
  | "mock_window"
  | "workspace_click"
  | "workspace_paste"
  | "generate_prompt"
  | "finished_modal";

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
  "Thai coding-first: เลือก principal จากหลักฐานใน chart + เหตุผลทางคลินิก ไม่เลือกเพื่อ RW",
  "ทุก diagnosis/procedure ที่ลงต้องมี evidence อย่างน้อย 1 จุด (แพทย์บันทึก / lab / imaging / procedure / ยา / discharge plan)",
  "Principal diagnosis ต้องเป็นโรคเดียว — เหตุหลักของการ admit และการใช้ทรัพยากร",
  "Comorbidity = โรคร่วมที่มีผลต่อการดูแลใน admit นี้",
  "Complication = ภาวะใหม่ระหว่าง admit ที่มีการรักษา/ติดตามจริง",
  "Other diagnosis = ภาวะเดิมที่ไม่มี active management ใน admit นี้ (ไม่ dump โรคเฉียบพลัน)",
  "Diagnosis ใช้ full English term, no abbreviation, no parentheses",
  "Investigations / Treatment / Home medication one line; ใช้คำย่อทางการแพทย์ได้",
  "Outcome ขึ้นต้น improved, refer, dead, against advice เท่านั้น",
  "ICD-9-CM เฉพาะหัตถการใน admission นี้",
].join("\n");

const WORKSPACE_PANEL_DEFAULTS: Record<WorkspacePanelKey, boolean> = {
  quickStart: true,
  clinicalSignal: true,
  preprocessSummary: true,
  warnings: true,
};

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
  const pathname = usePathname();
  const router = useRouter();
  const isGuestWorkspace = pathname === "/app/guest";
  const searchParams = useSearchParams();
  const { setWorkspaceSnapshot, openFeedbackTo } = useFeedbackContext();
  const [orderSheet, setOrderSheet] = useState("");
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
  const [engine, setEngine] = useState<DischargeEnginePayload | null>(null);
  const [showDiseaseGraph, setShowDiseaseGraph] = useState(false);
  const [showWeakSupported, setShowWeakSupported] = useState(false);

  const [diagnosisItems, setDiagnosisItems] = useState<DiagnosisItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [recalcLoading, setRecalcLoading] = useState(false);
  const [copiedKey, setCopiedKey] = useState("");
  const [error, setError] = useState("");

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
  const [collapsedPanels, setCollapsedPanels] =
    useState<Record<WorkspacePanelKey, boolean>>(WORKSPACE_PANEL_DEFAULTS);

  const [tutorialPhase, setTutorialPhase] = useState<TutorialPhase>("off");
  const [tutorialInit, setTutorialInit] = useState(false);
  /** จำไว้ว่าเคยจบ/ข้าม tutorial แล้ว — ใช้ซ่อนการ์ดตัวอย่างใหญ่เพื่อให้ workspace รู้สึกเหมือนโหมดใช้งานจริง */
  const [tutorialDonePersisted, setTutorialDonePersisted] = useState(false);
  const [mockPopupBlocked, setMockPopupBlocked] = useState(false);
  const orderSheetInputRef = useRef<HTMLTextAreaElement | null>(null);
  const mockOrderSheetPopupRef = useRef<Window | null>(null);
  const replayTutorialConsumedRef = useRef(false);
  const tutorialAnchorPopupRef = useRef<HTMLDivElement | null>(null);
  const tutorialAnchorClinicalRef = useRef<HTMLDivElement | null>(null);
  const tutorialAnchorGenerateRef = useRef<HTMLDivElement | null>(null);

  const recalcTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const bypassWorkspaceApi =
    isGuestWorkspace ||
    (tutorialPhase !== "off" &&
      tutorialPhase !== "intro_modal" &&
      tutorialPhase !== "finished_modal");
  const showWorkspaceCoach =
    tutorialInit &&
    (tutorialPhase === "workspace_click" ||
      tutorialPhase === "workspace_paste" ||
      tutorialPhase === "generate_prompt");
  const coachPhase: WorkspaceCoachPhase | null =
    tutorialPhase === "workspace_click"
      ? "workspace_click"
      : tutorialPhase === "workspace_paste"
        ? "workspace_paste"
        : tutorialPhase === "generate_prompt"
          ? "generate_prompt"
          : null;
  /** แสดงการ์ดเปิดหน้าต่างตัวอย่างขนาดใหญ่ระหว่าง flow tutorial หรือเมื่อยังไม่เคยจบ tutorial */
  const showMockLauncherCard =
    tutorialPhase === "intro_modal" ||
    tutorialPhase === "finished_modal" ||
    tutorialPhase === "mock_window" ||
    tutorialPhase === "workspace_click" ||
    tutorialPhase === "workspace_paste" ||
    tutorialPhase === "generate_prompt" ||
    (tutorialPhase === "off" && tutorialInit && !tutorialDonePersisted);

  useEffect(() => {
    return () => {
      if (recalcTimerRef.current) clearTimeout(recalcTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem("dischargex_workspace_panels");
      if (!raw) return;
      const parsed = JSON.parse(raw) as Partial<Record<WorkspacePanelKey, boolean>>;
      setCollapsedPanels({
        quickStart:
          typeof parsed.quickStart === "boolean"
            ? parsed.quickStart
            : WORKSPACE_PANEL_DEFAULTS.quickStart,
        clinicalSignal:
          typeof parsed.clinicalSignal === "boolean"
            ? parsed.clinicalSignal
            : WORKSPACE_PANEL_DEFAULTS.clinicalSignal,
        preprocessSummary:
          typeof parsed.preprocessSummary === "boolean"
            ? parsed.preprocessSummary
            : WORKSPACE_PANEL_DEFAULTS.preprocessSummary,
        warnings:
          typeof parsed.warnings === "boolean" ? parsed.warnings : WORKSPACE_PANEL_DEFAULTS.warnings,
      });
    } catch {
      // ignore corrupted localStorage
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem("dischargex_workspace_panels", JSON.stringify(collapsedPanels));
  }, [collapsedPanels]);

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

  useEffect(() => {
    try {
      const params =
        typeof window !== "undefined"
          ? new URLSearchParams(window.location.search)
          : null;
      /** จากหน้าแรก: /app/guest?tutorial=1 — บังคับเปิด flow tutorial แม้เคยจบแล้วในเครื่อง */
      const forceGuestTutorial =
        isGuestWorkspace && params?.get("tutorial") === "1";
      const done = readWorkspaceTutorialDone();
      setTutorialPhase(
        forceGuestTutorial ? "intro_modal" : done ? "off" : "intro_modal"
      );
      if (forceGuestTutorial) {
        router.replace(pathname, { scroll: false });
      }
    } catch {
      setTutorialPhase("intro_modal");
    }
    setTutorialInit(true);
  }, [isGuestWorkspace, pathname, router]);

  useEffect(() => {
    if (!tutorialInit) return;
    setTutorialDonePersisted(readWorkspaceTutorialDone());
  }, [tutorialInit]);

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      const d = event.data as { type?: string; kind?: string } | null;
      if (!d || d.type !== "dischargex-tutorial") return;
      if (d.kind === "mock_complete") {
        /** ไม่ปิดป๊อปอัปจากฝั่งนี้ — ให้ผู้ใช้ปิดหน้าต่าง mock เองหลังคัดลอก */
        setTutorialPhase("workspace_click");
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  useEffect(() => {
    if (
      tutorialPhase !== "workspace_click" &&
      tutorialPhase !== "workspace_paste" &&
      tutorialPhase !== "generate_prompt"
    ) {
      return;
    }
    const map: Record<string, HTMLElement | null> = {
      workspace_click: tutorialAnchorClinicalRef.current,
      workspace_paste: tutorialAnchorClinicalRef.current,
      generate_prompt: tutorialAnchorGenerateRef.current,
    };
    const el = map[tutorialPhase];
    const t = window.setTimeout(() => {
      el?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 120);
    return () => window.clearTimeout(t);
  }, [tutorialPhase]);

  function openMockOrderSheetPopup(opts?: { tutorialMode?: boolean }) {
    const w = Math.min(1040, window.screen.availWidth - 40);
    const h = Math.min(740, window.screen.availHeight - 80);
    const left = Math.max(0, window.screenX + (window.outerWidth - w) / 2);
    const top = Math.max(0, window.screenY + 48);
    const features = [
      `popup=yes`,
      `width=${Math.floor(w)}`,
      `height=${Math.floor(h)}`,
      `left=${Math.floor(left)}`,
      `top=${Math.floor(top)}`,
      "resizable=yes",
      "scrollbars=yes",
    ].join(",");
    const qs = opts?.tutorialMode ? "?tutorial=1" : "";
    const win = window.open(
      `/mock-hosxp-ipd-paperless.html${qs}`,
      "dischargex_hosxp_order_mock",
      features
    );
    if (!win) {
      setMockPopupBlocked(true);
      return;
    }
    mockOrderSheetPopupRef.current = win;
    setMockPopupBlocked(false);
    try {
      win.focus();
    } catch {
      // ignore
    }
  }

  function handleTutorialIntroStart() {
    setTutorialPhase("mock_window");
    openMockOrderSheetPopup({ tutorialMode: true });
  }

  function handleTutorialIntroSkip() {
    setTutorialPhase("off");
    try {
      window.localStorage.setItem(WORKSPACE_TUTORIAL_DONE_KEY, "1");
    } catch {
      // ignore
    }
    setTutorialDonePersisted(true);
  }

  function handleTutorialCompleteClose() {
    setTutorialPhase("off");
    try {
      window.localStorage.setItem(WORKSPACE_TUTORIAL_DONE_KEY, "1");
    } catch {
      // ignore
    }
    setTutorialDonePersisted(true);
  }

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
      engine,
    });
    return () => setWorkspaceSnapshot(null);
  }, [orderSheet, meta, preprocess, blocks, warnings, engine, setWorkspaceSnapshot]);

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
      const base = msg || "Request failed";
      const isTxnLock =
        /transaction|Unable to start a transaction|maxWait/i.test(base);
      throw new Error(
        isTxnLock
          ? `${base} ลองกดสร้างใหม่อีกครั้งในไม่กี่วินาที (เซิร์ฟเวอร์ยุ่งชั่วคราว)`
          : base
      );
    }

    return data as ApiResponse;
  }

  async function recalcFromBlocks(nextBlocks: NormalizedBlock[], silent = false) {
    if (bypassWorkspaceApi) {
      return;
    }

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
      setEngine(parsed.result.engine ?? null);
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
      if (bypassWorkspaceApi) {
        await new Promise((r) => setTimeout(r, 900));
        const parsed = buildTutorialMockApiResponse() as ApiResponse;
        const nextBlocks = normalizeBlocks(parsed.result.blocks);

        setBlocks(nextBlocks);
        setWarnings(parsed.result.warnings || []);
        setMeta(parsed.result.meta);
        setPreprocess(parsed.result.preprocess || emptyPreprocess());
        setEngine(parsed.result.engine ?? null);
        setDiagnosisItems(buildDiagnosisItemsFromBlocks(nextBlocks));
        setCaseCount((c) => c + 1);
        setTutorialPhase("finished_modal");
        return;
      }

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
      setEngine(parsed.result.engine ?? null);
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
    setEngine(null);
    setShowDiseaseGraph(false);
    setShowWeakSupported(false);
    setDiagnosisItems([]);
    setError("");
    setWorkspaceSnapshot(null);
  }

  function handleRetryWorkspaceTutorial() {
    try {
      mockOrderSheetPopupRef.current?.close();
    } catch {
      // ignore
    }
    mockOrderSheetPopupRef.current = null;
    setMockPopupBlocked(false);
    try {
      window.localStorage.removeItem(WORKSPACE_TUTORIAL_DONE_KEY);
    } catch {
      // ignore
    }
    setTutorialDonePersisted(false);
    setTutorialPhase("intro_modal");
    setOrderSheet("");
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
    setEngine(null);
    setShowDiseaseGraph(false);
    setShowWeakSupported(false);
    setDiagnosisItems([]);
    setError("");
  }

  function handleDismissWorkspaceTutorial() {
    try {
      window.localStorage.setItem(WORKSPACE_TUTORIAL_DONE_KEY, "1");
    } catch {
      // ignore
    }
    setTutorialDonePersisted(true);
    setTutorialPhase("off");
  }

  useEffect(() => {
    if (searchParams.get("replayTutorial") !== "1") {
      replayTutorialConsumedRef.current = false;
      return;
    }
    if (!tutorialInit) return;
    if (replayTutorialConsumedRef.current) return;
    replayTutorialConsumedRef.current = true;
    handleRetryWorkspaceTutorial();
    router.replace(pathname, { scroll: false });
    // handleRetryWorkspaceTutorial ถูกเรียกครั้งเดียวจาก query — ไม่ใส่ใน deps เพื่อไม่ให้รันซ้ำ
    // eslint-disable-next-line react-hooks/exhaustive-deps -- one-shot จาก ?replayTutorial=1
  }, [tutorialInit, searchParams, pathname, router]);

  function togglePanel(key: WorkspacePanelKey) {
    setCollapsedPanels((prev) => ({ ...prev, [key]: !prev[key] }));
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

  const userPlanId = (session?.user as { plan?: string })?.plan ?? "trial";
  const showChartCaptureHints =
    (userPlanId === "trial" || userPlanId.startsWith("pro")) &&
    !!engine?.chart_capture_hints?.length;

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
    <main className={`min-h-screen bg-[#081120] text-slate-100 ${loading ? "cursor-wait" : ""}`}>
      {loading ? (
        <div
          className="fixed inset-0 z-[100] flex cursor-wait items-center justify-center bg-[#081120]/85 backdrop-blur-md"
          role="status"
          aria-live="polite"
          aria-busy="true"
        >
          <div className="mx-4 flex max-w-md flex-col items-center gap-6 rounded-3xl border border-cyan-500/30 bg-gradient-to-b from-slate-900/98 to-slate-950/98 px-8 py-10 text-center shadow-2xl shadow-cyan-950/40">
            <div
              className="relative flex h-20 w-20 items-center justify-center"
              aria-hidden
            >
              <div className="absolute h-16 w-16 animate-spin rounded-full border-4 border-cyan-500/15 border-t-cyan-400" />
              <div className="absolute h-11 w-11 animate-spin rounded-full border-4 border-indigo-500/15 border-b-indigo-400 [animation-direction:reverse] [animation-duration:0.9s]" />
              <div className="h-2 w-2 animate-pulse rounded-full bg-cyan-300 shadow-[0_0_12px_rgba(34,211,238,0.8)]" />
            </div>
            <div>
              <p className="text-base font-semibold text-white">กำลังสร้างสรุปและจัดโครง coding…</p>
              <p className="mt-2 text-sm leading-relaxed text-slate-400">
                ระบบกำลังอ่านข้อความทางคลินิก — โดยปกติใช้เวลาประมาณ 1 นาที
              </p>
              <p className="mt-1 text-xs text-slate-500">โปรดอย่าปิดหรือรีเฟรชหน้าจนน์จนกว่าจะเสร็จ</p>
            </div>
          </div>
        </div>
      ) : null}

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
        {isGuestWorkspace ? (
          <div className="rounded-2xl border border-amber-500/35 bg-amber-950/25 px-4 py-3 text-sm leading-relaxed text-amber-100">
            <span className="font-semibold text-amber-50">โหมดทดลอง (ไม่ต้องลงทะเบียน)</span>
            — ผลลัพธ์จากปุ่ม &quot;สร้างสรุป&quot;เป็นข้อมูลจำลองสำหรับสาธิตเท่านั้น{" "}
            <Link href="/signup" className="font-medium text-cyan-300 underline hover:text-cyan-200">
              สมัครใช้งาน
            </Link>
            {" · "}
            <Link href="/login" className="font-medium text-cyan-300 underline hover:text-cyan-200">
              เข้าสู่ระบบ
            </Link>
            {" "}
            เพื่อประมวลผลด้วย AI จริงและนับเครดิตตามแพ็กเกจ
          </div>
        ) : null}

        <section className="overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-slate-950 via-[#0c1728] to-[#111c32] shadow-2xl shadow-black/30">
          <div className="grid gap-6 px-6 py-7 lg:grid-cols-[1.2fr_0.8fr] lg:px-8">
            <div className="space-y-4">
              <div className="inline-flex items-center gap-2 rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-xs font-medium uppercase tracking-[0.18em] text-cyan-300">
                Discharge summary · coding review
              </div>

              <div>
                <h1 className="text-3xl font-semibold tracking-tight text-white md:text-5xl">
                  Discharge<span className="text-cyan-400">X</span>
                </h1>
                <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300 md:text-base">
                  ช่วยสรุป discharge summary, จัดกลุ่มวินิจฉัย, และช่วยประเมินผลต่อการทบทวน coding และ AdjRW แบบประมาณการ
                  — ลดงานคัดลอกและจัดโครงข้อมูลใน workflow ของทีมแพทย์และผู้ตรวจรหัส
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <FeaturePill text="Diagnosis fields" />
                <FeaturePill text="Live ICD-10 Recalc" />
                <FeaturePill text="AdjRW (estimate)" />
                <FeaturePill text="Preprocess Summary" />
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur">
              <div className="text-sm font-semibold text-white">ข้อควรทราบ</div>
              <div className="mt-3 space-y-2 text-sm leading-6 text-slate-300">
                <p>
                  DischargeX เป็นเครื่องมือช่วยสรุปและ<span className="font-semibold text-cyan-300">ทบทวนการจัดโครง coding</span>{" "}
                  ไม่ใช่ระบบจัดกลุ่มอย่างเป็นทางการ และไม่รับประกันผลการเบิกจ่าย
                </p>
                <p>
                  ผลลัพธ์ควรได้รับการ{" "}
                  <span className="font-semibold text-amber-300">ทบทวนร่วมกับเวชระเบียน</span>{" "}
                  โดยแพทย์หรือผู้ตรวจรหัสก่อนนำไปใช้งานจริง
                </p>
                <p>
                  Principal diagnosis, Comorbidity, Complication, ICD-9, Outcome และ Follow-up
                  ต้องสอดคล้องกับข้อมูลในเวชระเบียนต้นฉบับ
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
          <div className={`space-y-4 ${showWorkspaceCoach ? "pb-40 max-sm:pb-52" : ""}`}>
            <CollapsibleCard
              title="เริ่มต้นใช้งาน (สำหรับผู้ใช้ใหม่)"
              subtitle="ทำตาม 3 ขั้นตอนนี้เพื่อเริ่มใช้งานได้ทันที"
              collapsed={collapsedPanels.quickStart}
              onToggle={() => togglePanel("quickStart")}
            >
              <ol className="space-y-2 text-sm text-slate-200">
                <li>
                  1) Copy ข้อมูลทั้งหน้าจากระบบ order sheet (รวมบรรทัด lab / รังสีที่อยู่ในหน้านั้น) แล้ววางในช่อง Clinical
                  Input Workspace
                </li>
                <li>2) กดปุ่ม &quot;สร้างสรุป&quot; แล้วรอผลลัพธ์</li>
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
                  onClick={handleNewPatient}
                  className="rounded-xl border border-slate-700 bg-slate-900/80 px-3 py-2 text-xs font-medium text-slate-200 hover:bg-slate-800"
                >
                  ล้างข้อมูลทั้งหมด
                </button>
                <button
                  type="button"
                  onClick={handleRetryWorkspaceTutorial}
                  className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-xs font-medium text-emerald-200 hover:bg-emerald-500/20"
                >
                  ลอง tutorial อีกครั้ง
                </button>
                {!isGuestWorkspace ? (
                  <button
                    type="button"
                    onClick={handleDismissWorkspaceTutorial}
                    className="rounded-xl border border-slate-600 bg-slate-900/80 px-3 py-2 text-xs font-medium text-slate-400 hover:bg-slate-800 hover:text-slate-200"
                  >
                    ปิดการแนะนำ
                  </button>
                ) : null}
              </div>
              {tutorialDonePersisted && tutorialPhase === "off" ? (
                <p className="mt-3 text-xs leading-relaxed text-slate-500">
                  ต้องการฝึก copy จากหน้าจอจำลอง?{" "}
                  <button
                    type="button"
                    onClick={() => openMockOrderSheetPopup()}
                    className="font-medium text-cyan-400 underline decoration-cyan-500/40 underline-offset-2 hover:text-cyan-300"
                  >
                    เปิดหน้าต่างตัวอย่าง Order Sheet
                  </button>
                </p>
              ) : null}
            </CollapsibleCard>

            {showMockLauncherCard ? (
              <div ref={tutorialAnchorPopupRef}>
                <Card
                  title="ตัวอย่างระบบ IPD (HOSxP style)"
                  subtitle="เปิดหน้าต่างตัวอย่างแยกจาก DischargeX — ใช้เมื่อต้องการลองเองหลังจบ tutorial"
                >
                  <div className="flex flex-col gap-3">
                    <div className="rounded-2xl border border-slate-600/80 bg-slate-950/60 px-4 py-3 text-xs leading-relaxed text-slate-300">
                      <p>
                        กดปุ่มด้านล่างเพื่อเปิด <span className="font-medium text-cyan-200">หน้าต่างป๊อปอัป</span>{" "}
                        แสดง Doctor&apos;s Order Sheet (ไฟล์{" "}
                        <code className="rounded bg-slate-800 px-1 py-0.5 text-[11px] text-slate-200">
                          mock-hosxp-ipd-paperless.html
                        </code>
                        )
                      </p>
                    </div>
                    {mockPopupBlocked ? (
                      <div className="rounded-xl border border-amber-600/50 bg-amber-950/40 px-3 py-2 text-xs text-amber-100">
                        เบราว์เซอร์บล็อกป๊อปอัป — อนุญาตป๊อปอัปสำหรับไซต์นี้ แล้วลองกดอีกครั้ง
                      </div>
                    ) : null}
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => openMockOrderSheetPopup()}
                        className="inline-flex items-center justify-center gap-2 rounded-2xl border border-cyan-500/50 bg-gradient-to-r from-cyan-600/30 to-blue-700/30 px-5 py-3 text-sm font-semibold text-cyan-50 shadow-lg shadow-cyan-950/30 transition hover:brightness-110"
                      >
                        <span className="text-lg leading-none" aria-hidden>
                          ⧉
                        </span>
                        เปิดหน้าต่างตัวอย่าง Order Sheet
                      </button>
                      <button
                        type="button"
                        onClick={() => openMockOrderSheetPopup()}
                        className="rounded-2xl border border-slate-600 bg-slate-900/90 px-4 py-3 text-xs font-medium text-slate-300 hover:bg-slate-800"
                      >
                        เปิดอีกครั้ง
                      </button>
                    </div>
                  </div>
                </Card>
              </div>
            ) : null}

            {showWorkspaceCoach ? (
              <div className="rounded-2xl border border-emerald-500/20 bg-emerald-950/10 px-3 py-2.5">
                <div className="text-[11px] font-semibold uppercase tracking-wide text-emerald-200/90">
                  ความคืบหน้า (หลังปิดหน้าต่างตัวอย่าง)
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  {(
                    [
                      { id: "workspace_click", label: "คลิกช่อง" },
                      { id: "workspace_paste", label: "วาง" },
                      { id: "generate_prompt", label: "สร้างสรุป" },
                    ] as const
                  ).map((row, idx) => {
                    const order = ["workspace_click", "workspace_paste", "generate_prompt"] as const;
                    const cur = order.indexOf(tutorialPhase as (typeof order)[number]);
                    const my = order.indexOf(row.id);
                    const active = tutorialPhase === row.id;
                    const done = cur > my;
                    return (
                      <div
                        key={row.id}
                        className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium ${
                          active
                            ? "border-cyan-500/60 bg-cyan-950/50 text-cyan-100"
                            : done
                              ? "border-emerald-700/50 bg-emerald-950/30 text-emerald-300/90"
                              : "border-slate-700/60 bg-slate-950/40 text-slate-500"
                        }`}
                      >
                        <span
                          className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold ${
                            active
                              ? "bg-cyan-500 text-white"
                              : done
                                ? "bg-emerald-600 text-white"
                                : "bg-slate-700 text-slate-400"
                          }`}
                        >
                          {done ? "✓" : idx + 1}
                        </span>
                        {row.label}
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : null}

            <div
              ref={tutorialAnchorClinicalRef}
              className={
                showWorkspaceCoach &&
                (tutorialPhase === "workspace_click" || tutorialPhase === "workspace_paste")
                  ? "relative rounded-[1.35rem] p-[2px] shadow-[0_0_0_2px_rgba(34,211,238,0.45)]"
                  : ""
              }
            >
              {tutorialPhase === "workspace_click" || tutorialPhase === "workspace_paste" ? (
                <div
                  className="pointer-events-none absolute -top-3 left-1/2 z-10 -translate-x-1/2 text-2xl text-cyan-300 drop-shadow-[0_0_8px_rgba(34,211,238,0.8)]"
                  aria-hidden
                >
                  ↓
                </div>
              ) : null}
              <Card
                title="Clinical Input Workspace"
                subtitle="Paste หน้า order sheet — รวมผล lab / รังสีที่แสดงในหน้านั้นในช่องเดียวกัน (ระบบไม่แยกช่อง lab)"
              >
                <ScrollTextarea
                  ref={orderSheetInputRef}
                  value={orderSheet}
                  onChange={(e) => setOrderSheet(e.target.value)}
                  onMouseDown={() => {
                    if (tutorialPhase === "workspace_click") {
                      setTutorialPhase("workspace_paste");
                    }
                  }}
                  onPaste={() => {
                    if (tutorialPhase === "workspace_paste") {
                      setTutorialPhase("generate_prompt");
                    }
                  }}
                  placeholder="Paste doctor order sheet..."
                  className="h-[340px] w-full rounded-2xl border border-slate-700/80 bg-slate-950/80 px-4 py-3 text-sm text-slate-100 outline-none transition focus:border-cyan-500"
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

            <div
              ref={tutorialAnchorGenerateRef}
              className={
                showWorkspaceCoach && tutorialPhase === "generate_prompt"
                  ? "relative rounded-[1.35rem] p-[2px] shadow-[0_0_0_2px_rgba(52,211,153,0.45)]"
                  : ""
              }
            >
              {tutorialPhase === "generate_prompt" ? (
                <div
                  className="pointer-events-none absolute -top-3 left-8 z-10 text-2xl text-emerald-300 drop-shadow-[0_0_8px_rgba(52,211,153,0.8)]"
                  aria-hidden
                >
                  ↓
                </div>
              ) : null}
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={handleGenerate}
                disabled={loading || !orderSheet.trim()}
                className="inline-flex min-w-[148px] items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-cyan-500 to-blue-600 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-cyan-900/30 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? (
                  <>
                    <span
                      className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white"
                      aria-hidden
                    />
                    <span>กำลังสร้าง…</span>
                  </>
                ) : (
                  "สร้างสรุป"
                )}
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
            <CollapsibleCard
              title="Clinical Signal"
              subtitle="ภาพรวมความพร้อมของข้อมูล"
              collapsed={collapsedPanels.clinicalSignal}
              onToggle={() => togglePanel("clinicalSignal")}
            >
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
                <div className="mt-3 flex items-center gap-2 text-xs text-cyan-300">
                  <span
                    className="inline-block h-3.5 w-3.5 shrink-0 animate-spin rounded-full border-2 border-cyan-500/30 border-t-cyan-300"
                    aria-hidden
                  />
                  <span>กำลังคำนวณ ICD-10 / AdjRW ใหม่…</span>
                </div>
              ) : null}

              {meta.adjrw !== null ? (
                <div className="mt-4 rounded-2xl border border-amber-700/40 bg-amber-950/20 p-4 text-sm text-amber-100">
                  <div className="font-semibold">การจับ documentation / coding ที่อาจเพิ่ม complexity (ประมาณการ)</div>
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

              {showChartCaptureHints && engine?.chart_capture_hints ? (
                <div className="mt-4 border-t border-amber-700/30 pt-4">
                  <div className="text-xs font-semibold uppercase tracking-wide text-amber-200">
                    แนะนำเติมข้อความใน order sheet
                  </div>
                  <p className="mt-1 text-[11px] leading-relaxed text-slate-500">
                    ช่วยระบุว่าในข้อความที่วางยังขาดอะไรบ้าง หากต้องการให้การลงรหัสรองรับ diagnosis นั้นได้ชัดขึ้น
                  </p>
                  <ul className="mt-3 space-y-4">
                    {engine.chart_capture_hints.map((h, i) => (
                      <li
                        key={i}
                        className="rounded-xl border border-amber-900/40 bg-amber-950/15 p-3 text-sm text-slate-200"
                      >
                        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1 font-medium text-amber-100/95">
                          <span>{h.target_diagnosis_text}</span>
                          {h.target_icd10 ? (
                            <span className="text-xs font-normal text-slate-400">
                              ICD-10 {h.target_icd10}
                            </span>
                          ) : null}
                          {h.tier ? (
                            <span className="text-[10px] uppercase text-slate-500">{h.tier}</span>
                          ) : null}
                        </div>
                        {h.missing_in_input?.length ? (
                          <div className="mt-2 text-xs text-slate-400">
                            <span className="text-slate-500">ในข้อมูลที่วางยังไม่พอ: </span>
                            {h.missing_in_input.join(" · ")}
                          </div>
                        ) : null}
                        {h.suggested_order_sheet_wording_th ? (
                          <div className="mt-2 text-xs leading-relaxed text-cyan-100/90">
                            <span className="text-slate-500">
                              ตัวอย่างคำที่อาจเพิ่มใน chart (ถ้าเป็นจริงตามเคส):{" "}
                            </span>
                            {h.suggested_order_sheet_wording_th}
                          </div>
                        ) : null}
                        {h.suggested_lab_or_imaging?.length ? (
                          <div className="mt-1 text-xs text-slate-400">
                            Lab / imaging ที่มักช่วยสนับสนุน: {h.suggested_lab_or_imaging.join(", ")}
                          </div>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </CollapsibleCard>

            <CollapsibleCard
              title="Preprocess Summary"
              subtitle="สิ่งที่ถูก clean ก่อนส่งเข้า AI"
              collapsed={collapsedPanels.preprocessSummary}
              onToggle={() => togglePanel("preprocessSummary")}
            >
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
            </CollapsibleCard>

            <CollapsibleCard
              title="Warnings"
              subtitle="สิ่งที่ควรทวนก่อน copy ไปใช้"
              collapsed={collapsedPanels.warnings}
              onToggle={() => togglePanel("warnings")}
            >
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
            </CollapsibleCard>
          </div>
        </section>

        {engine ? (
          <section className="rounded-3xl border border-cyan-500/20 bg-[#0a1525]/80 p-5 backdrop-blur">
            <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-white">Thai coding pipeline</h2>
                <p className="text-sm text-slate-400">
                  สองโซน: สรุปสุดท้าย · Coding
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setShowDiseaseGraph((v) => !v)}
                  className="rounded-xl border border-slate-600 bg-slate-900/70 px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-slate-800"
                >
                  {showDiseaseGraph ? "ซ่อน" : "แสดง"} disease graph
                </button>
                <button
                  type="button"
                  onClick={() => setShowWeakSupported((v) => !v)}
                  className="rounded-xl border border-slate-600 bg-slate-900/70 px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-slate-800"
                >
                  {showWeakSupported ? "ซ่อน" : "แสดง"} weakly supported dx
                </button>
              </div>
            </div>

            {showDiseaseGraph && engine.case_graph ? (
              <pre className="mb-4 max-h-64 overflow-auto rounded-2xl border border-slate-700 bg-slate-950/80 p-4 text-xs text-slate-300">
                {JSON.stringify(engine.case_graph, null, 2)}
              </pre>
            ) : null}

            <div className="grid gap-4 xl:grid-cols-2">
              <div className="rounded-2xl border border-white/10 bg-slate-950/50 p-4">
                <div className="text-xs font-semibold uppercase tracking-wide text-cyan-300">1. Final summary</div>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-200">
                  {engine.summary_text?.trim() ||
                    getBlockValue("final_diag") ||
                    "—"}
                </p>
                {engine.why_this_principal_diagnosis ? (
                  <details className="mt-3 text-sm text-slate-400">
                    <summary className="cursor-pointer text-cyan-200/90">Why this principal</summary>
                    <p className="mt-2 whitespace-pre-wrap text-slate-300">
                      {engine.why_this_principal_diagnosis}
                    </p>
                  </details>
                ) : null}
              </div>

              <div className="rounded-2xl border border-white/10 bg-slate-950/50 p-4">
                <div className="text-xs font-semibold uppercase tracking-wide text-cyan-300">2. Coding panel</div>
                <div className="mt-2 space-y-2 text-sm text-slate-200">
                  <div>
                    <span className="text-slate-500">Principal · </span>
                    {(() => {
                      const fromBlock = getBlockValue("principal_dx").trim();
                      const icdFromBlock = (blocks.find((b) => b.key === "principal_dx")?.icd10 || "").trim();
                      const text = fromBlock || engine.principal_diagnosis.text || "—";
                      const icd = icdFromBlock || engine.principal_diagnosis.icd10 || "—";
                      return (
                        <>
                          {text}{" "}
                          <span className="text-slate-500">(ICD-10 {icd})</span>
                        </>
                      );
                    })()}
                  </div>
                  <div className="text-slate-400">
                    Confidence: {engine.principal_diagnosis.confidence} · Trust:{" "}
                    {engine.principal_diagnosis.trust_label || "—"}
                  </div>
                  <EngineDxList title="Comorbidity" items={engine.comorbidities} showWeak={showWeakSupported} />
                  <EngineDxList title="Complication" items={engine.complications} showWeak={showWeakSupported} />
                  <EngineDxList title="Other" items={engine.other_diagnoses} showWeak={showWeakSupported} />
                  <EngineDxList title="External cause" items={engine.external_causes} showWeak={showWeakSupported} />
                  {engine.procedures_icd9?.length ? (
                    <div className="mt-2 border-t border-slate-700/60 pt-2">
                      <div className="text-xs text-slate-500">ICD-9-CM procedures</div>
                      <ul className="mt-1 list-inside list-disc text-slate-300">
                        {engine.procedures_icd9.map((p, i) => (
                          <li key={i}>{p.text}</li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>

            {engine.coder_notes?.length ? (
              <div className="mt-4 rounded-2xl border border-slate-700 bg-slate-950/60 p-4 text-sm text-slate-300">
                <div className="text-xs font-medium text-slate-500">Coder notes</div>
                <ul className="mt-2 list-inside list-disc">
                  {engine.coder_notes.map((n, i) => (
                    <li key={i}>{n}</li>
                  ))}
                </ul>
              </div>
            ) : null}
          </section>
        ) : null}

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

        <ResultDisclaimer />
      </div>

      <TutorialIntroModal
        open={tutorialInit && tutorialPhase === "intro_modal"}
        isGuest={isGuestWorkspace}
        onStart={handleTutorialIntroStart}
        onSkip={handleTutorialIntroSkip}
      />

      <TutorialCompleteModal
        open={tutorialPhase === "finished_modal"}
        isGuest={isGuestWorkspace}
        onClose={handleTutorialCompleteClose}
      />

      {coachPhase ? (
        <WorkspaceTutorialOverlay
          active={showWorkspaceCoach}
          targetRef={
            coachPhase === "generate_prompt"
              ? tutorialAnchorGenerateRef
              : tutorialAnchorClinicalRef
          }
          phase={coachPhase}
          onSkipToPaste={() => setTutorialPhase("workspace_paste")}
          onSkipToGenerate={() => setTutorialPhase("generate_prompt")}
          stepIndex={
            coachPhase === "workspace_click"
              ? 1
              : coachPhase === "workspace_paste"
                ? 2
                : 3
          }
          stepTotal={3}
        />
      ) : null}
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

function CollapsibleCard({
  title,
  subtitle,
  collapsed,
  onToggle,
  children,
}: {
  title: string;
  subtitle?: string;
  collapsed: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-4 shadow-2xl shadow-black/20 backdrop-blur">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-slate-100">{title}</div>
          {subtitle ? <div className="text-xs text-slate-500">{subtitle}</div> : null}
        </div>
        <button
          type="button"
          onClick={onToggle}
          className="rounded-xl border border-slate-600 bg-slate-900/70 px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-slate-800"
        >
          {collapsed ? "ขยาย" : "ย่อ"}
        </button>
      </div>
      {!collapsed ? children : null}
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

const ScrollTextarea = forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(function ScrollTextarea(props, ref) {
  return (
    <textarea
      {...props}
      ref={ref}
      style={{ resize: "vertical", overflowY: "auto" }}
    />
  );
});

function EngineDxList({
  title,
  items,
  showWeak,
}: {
  title: string;
  items: DiagnosisEngineItem[];
  showWeak: boolean;
}) {
  const filtered = showWeak
    ? items
    : items.filter(
        (x) =>
          x.confidence !== "suggest_if_documented" &&
          x.trust_label !== "weak_support" &&
          x.trust_label !== "missing_documentation"
      );
  if (!filtered.length) return null;
  return (
    <div className="mt-1">
      <div className="text-xs text-slate-500">{title}</div>
      <ul className="mt-1 list-inside list-disc text-slate-300">
        {filtered.map((x, i) => (
          <li key={i}>
            {x.text}{" "}
            <span className="text-slate-600">
              ({x.icd10 || "—"}) · {x.confidence}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}