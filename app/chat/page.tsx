"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { useEffect, useMemo, useRef, useState, type RefObject } from "react";

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
  answerSource?: "internal" | "mixed" | "external";
  /** แสดงใน UI เท่านั้น — ไม่ sync ขึ้น cloud (ลดขนาด payload) */
  images?: { id: string; name: string; dataUrl: string }[];
};
type TokenUsageMeta = {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  estimatedCostThb: number;
};
type Thread = { id: string; title: string; messages: ChatMessage[] };

function stripThreadsForCloud(threads: Thread[]): Thread[] {
  return threads.map((t) => ({
    ...t,
    messages: t.messages.map((m) => {
      if (m.role === "user" && m.images?.length) {
        const { images: _omit, ...rest } = m;
        return rest;
      }
      return m;
    }),
  }));
}

function splitChatReferenceTail(content: string): { main: string; tail: string | null } {
  const patterns = [
    /[\n\r]+\s*ReferenceSource:\s*/i,
    /[\n\r]+\s*อ่านแนวทางเพิ่มเติม \(แหล่งไทย\):\s*/i,
    /^ReferenceSource:\s*/im,
    /^อ่านแนวทางเพิ่มเติม \(แหล่งไทย\):\s*/im,
  ];
  let best = -1;
  for (const re of patterns) {
    const m = content.match(re);
    if (m && typeof m.index === "number" && (best === -1 || m.index < best)) {
      best = m.index;
    }
  }
  if (best === -1) return { main: content, tail: null };
  const main = content.slice(0, best).trimEnd();
  const tail = content.slice(best).trim();
  return { main, tail: tail || null };
}
type ChatMode = "fast" | "precise";
type AssistantMode = "coding" | "opd_demo";
type StreamDonePayload = {
  answerSource?: "internal" | "mixed" | "external";
  usage?: TokenUsageMeta;
  variant?: string;
  model?: string;
};
type ChatHistoryPayload = { role: "user" | "assistant"; content: string };
type ChatStyleProfile = {
  responseLength: "short" | "balanced" | "detailed";
  outputFormat: "auto" | "bullet" | "paragraph";
  tone: "neutral" | "formal" | "friendly";
};
type PendingStreamRequest = {
  threadId: string;
  message: string;
  history: ChatHistoryPayload[];
  mode: ChatMode;
  assistantMode: AssistantMode;
  styleProfile: ChatStyleProfile;
  images?: UploadedImage[];
  appendToExistingAssistant?: boolean;
};
const CHAT_MODE_KEY = "dischargex_chat_mode_v1";
const ASSISTANT_MODE_KEY = "dischargex_assistant_mode_v1";
/** ตรงกับ `resolveSpecialistChatModel` เริ่มต้น — สำหรับแสดงก่อนมี done event; รุ่นจริงอาจเปลี่ยนเมื่อ fallback ที่ฝั่ง API */
const DEFAULT_FAST_MODEL = "gpt-5-mini";
const DEFAULT_PRECISE_MODEL = "gpt-5.5";
const DEFAULT_CHAT_STYLE_PROFILE: ChatStyleProfile = {
  responseLength: "balanced",
  outputFormat: "auto",
  tone: "neutral",
};

/** Sent to the API when the user attaches images but leaves the text box empty. */
const DEFAULT_IMAGE_ONLY_API_PROMPT =
  "แนบรูปตรวจทางการแพทย์ (เช่น EKG หรือ X-ray) — ช่วยอ่านจากภาพแล้วสรุปสิ่งที่เห็นและประเมินเบื้องต้น พร้อม differential/สิ่งที่ควรตรวจเพิ่มหรือขอ formal read เมื่อจำเป็น (เน้น: ไม่ใช่รายงานทางรังสีวิทยาหรืออ่านคลื่นไฟฟ้าหัวใจทางการ)";
/** Shown in the thread UI instead of the long API prompt. */
const IMAGE_ONLY_DISPLAY_LINE = "แนบรูป — ขอช่วยอ่านและประเมินเบื้องต้น (EKG / X-ray / อื่นๆ)";

type SpeechRecognitionCtor = new () => {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onstart: (() => void) | null;
  onend: (() => void) | null;
  onerror: ((event: { error?: string }) => void) | null;
  onresult: ((event: { resultIndex: number; results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  start: () => void;
  stop: () => void;
};
type SummaryKind = "diagnosis" | "opd_case" | "opd_soap";
type UploadedImage = {
  id: string;
  name: string;
  dataUrl: string;
};
type ChatQuotaNotice = {
  shortLabel: string;
  resetAtText: string | null;
};

function isIcdLookupOnlyQuery(text: string) {
  const q = text.toLowerCase();
  return /icd[\s\-]?10|รหัส|code|coding/.test(q) && /(วินิจฉัย|diagnosis|โรค|dx|icd)/.test(q);
}

function isSummaryCommandText(text: string) {
  return /ช่วยสรุปเป็นเฉพาะกลุ่ม diagnosis|ช่วยสรุปเคสแบบ opd ไทย|ช่วยสรุปแบบ soap/i.test(text);
}

function isSummaryLikeAssistantText(text: string) {
  return /ช่วยสรุปเคสแบบ opd ไทย|ช่วยสรุปแบบ soap|mandatory_summary_output_template|thai opd case summary|##\s*soap/i.test(
    text
  );
}

function parseChatQuotaNotice(message: string): ChatQuotaNotice | null {
  const normalized = String(message || "");
  const isQuota =
    normalized.includes("ครบโควตาโดยประมาณแล้ว") ||
    normalized.includes("โควตาการใช้งานเดือนนี้ครบแล้ว") ||
    normalized.includes("หมดรอบการใช้งานแล้ว") ||
    normalized.includes("โควตารอบนี้ไม่พอ") ||
    normalized.includes("ถูกใช้งานพร้อมกันเกินจำนวนอุปกรณ์ที่อนุญาต");
  if (!isQuota) return null;
  const resetMatch = normalized.match(/รีเซ็ตอีกครั้งประมาณ\s*(.+?)(?:\s+หรือ|$)/);
  return {
    shortLabel: "โควตาแชทเต็มชั่วคราว",
    resetAtText: resetMatch?.[1]?.trim() || null,
  };
}

function buildSummaryContextFromThread(messages: ChatMessage[]) {
  const relevant = messages.filter((m) => !isSummaryCommandText(m.content));
  const userFirst = relevant
    .filter((m) => m.role === "user")
    .slice(-80)
    .map((m) => `ผู้ใช้: ${m.content}`);
  const assistantSupport = relevant
    .filter((m) => m.role === "assistant" && !isSummaryLikeAssistantText(m.content))
    .slice(-8)
    .map((m) => `ผู้ช่วย: ${m.content.slice(0, 1200)}`);
  const fallback = relevant
    .slice(-36)
    .map((m) => `${m.role === "user" ? "ผู้ใช้" : "ผู้ช่วย"}: ${m.content}`);
  const mergedPrimary = [...userFirst, ...assistantSupport].slice(-96);
  const primaryLines = mergedPrimary.length ? mergedPrimary : fallback;
  return primaryLines.join("\n").slice(-9000);
}

function extractUrls(text: string) {
  const matches = text.match(/https?:\/\/[^\s)]+/g) || [];
  return Array.from(new Set(matches));
}

function getUrlHostLabel(rawUrl: string) {
  try {
    const url = new URL(rawUrl);
    return url.hostname.replace(/^www\./, "");
  } catch {
    return "reference";
  }
}

function renderInlineMarkdown(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, idx) => {
    if (/^\*\*[^*]+\*\*$/.test(part)) {
      return (
        <strong key={`bold-${idx}`} className="font-semibold text-slate-50">
          {part.slice(2, -2)}
        </strong>
      );
    }
    return <span key={`plain-${idx}`}>{part}</span>;
  });
}

function renderInlineCitations(line: string) {
  const parts = line.split(/(\[R\d+\])/g);
  return parts.map((part, idx) => {
    if (/^\[R\d+\]$/.test(part)) {
      return (
        <span key={`${part}-${idx}`} className="mx-0.5 rounded bg-cyan-500/20 px-1 py-0.5 text-[11px] text-cyan-200">
          {part}
        </span>
      );
    }
    const urlParts = part.split(/(https?:\/\/[^\s)]+)/g);
    return (
      <span key={`${part}-${idx}`}>
        {urlParts.map((chunk, urlIdx) => {
          if (/^https?:\/\/[^\s)]+$/.test(chunk)) {
            const host = getUrlHostLabel(chunk);
            return (
              <a
                key={`${chunk}-${urlIdx}`}
                href={chunk}
                target="_blank"
                rel="noreferrer"
                className="mx-0.5 inline-flex h-6 w-6 items-center justify-center rounded-full border border-cyan-500/35 bg-cyan-500/10 text-cyan-200 hover:bg-cyan-500/25"
                title={`${host}\n${chunk}`}
                aria-label={`อ้างอิง: ${host}`}
              >
                <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                  <path d="M14 3h7v7" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M10 14 21 3" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M21 14v7h-7" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M3 10V3h7" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="m3 3 7 7" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </a>
            );
          }
          return <span key={`${chunk}-${urlIdx}`}>{renderInlineMarkdown(chunk)}</span>;
        })}
      </span>
    );
  });
}

function ChatMessageBody({ content }: { content: string }) {
  const { main, tail } = useMemo(() => splitChatReferenceTail(content), [content]);
  const codeSplit = main.split("```");
  return (
    <div className="space-y-2 leading-relaxed">
      {codeSplit.map((block, blockIdx) => {
        if (blockIdx % 2 === 1) {
          return (
            <pre
              key={`code-${blockIdx}`}
              className="overflow-x-auto rounded-lg border border-slate-600 bg-slate-950/80 p-2 text-xs text-slate-100"
            >
              <code>{block.trim()}</code>
            </pre>
          );
        }
        const lines = block.split(/\r?\n/).filter((line) => line.trim().length > 0);
        return (
          <div key={`text-${blockIdx}`} className="space-y-1">
            {lines.map((line, idx) => {
              const clean = line.trim();
              if (/^referencesource\s*:/i.test(clean)) {
                const urls = extractUrls(clean);
                if (!urls.length) return null;
                return (
                  <div key={`${clean}-${idx}`} className="mt-1 rounded-lg border border-cyan-500/20 bg-cyan-500/5 p-2">
                    <div className="mb-1 text-[11px] font-medium text-cyan-200">แหล่งอ้างอิง</div>
                    <div className="flex flex-wrap gap-1.5">
                      {urls.map((url, refIdx) => (
                        <a
                          key={`${url}-${refIdx}`}
                          href={url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 rounded-full border border-cyan-500/30 bg-cyan-500/10 px-2 py-0.5 text-[11px] text-cyan-100 hover:bg-cyan-500/20"
                          title={url}
                        >
                          <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M14 3h7v7" strokeLinecap="round" strokeLinejoin="round" />
                            <path d="M10 14 21 3" strokeLinecap="round" strokeLinejoin="round" />
                            <path d="M5 12v7h7" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                          <span>{`Ref ${refIdx + 1}: ${getUrlHostLabel(url)}`}</span>
                        </a>
                      ))}
                    </div>
                  </div>
                );
              }
              if (/^[-*]\s+/.test(clean)) {
                return (
                  <div key={`${clean}-${idx}`} className="flex items-start gap-2">
                    <span className="mt-1 text-cyan-300">•</span>
                    <span>{renderInlineCitations(clean.replace(/^[-*]\s+/, ""))}</span>
                  </div>
                );
              }
              if (/^\d+[\.\)]\s+/.test(clean)) {
                return (
                  <div key={`${clean}-${idx}`} className="flex items-start gap-2">
                    <span className="text-slate-400">{clean.match(/^\d+[\.\)]/)?.[0]}</span>
                    <span>{renderInlineCitations(clean.replace(/^\d+[\.\)]\s+/, ""))}</span>
                  </div>
                );
              }
              return (
                <p key={`${clean}-${idx}`} className="whitespace-pre-wrap">
                  {renderInlineCitations(clean)}
                </p>
              );
            })}
          </div>
        );
      })}
      {tail ? (
        <details className="mt-1 rounded-lg border border-slate-700/50 bg-slate-950/40 px-2 py-1">
          <summary className="cursor-pointer list-none text-[10px] text-slate-400 marker:content-none [&::-webkit-details-marker]:hidden hover:text-slate-300">
            อ้างอิงภายนอก · แตะเพื่อเปิด
          </summary>
          <div className="mt-1.5 space-y-1 border-t border-slate-700/40 pt-1.5 text-[11px] text-slate-400">
            {tail.split(/\r?\n/).map((line, i) => {
              const t = line.trim();
              if (!t) return null;
              return (
                <div key={`tail-${i}`} className="leading-snug">
                  {renderInlineCitations(t)}
                </div>
              );
            })}
          </div>
        </details>
      ) : null}
    </div>
  );
}

function newThread(): Thread {
  return {
    id: `th-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    title: "แชทใหม่",
    messages: [],
  };
}

export default function ChartSummaryConsultChatPage() {
  const { status: sessionStatus } = useSession();
  const sessionAuthed = sessionStatus === "authenticated";
  const [threads, setThreads] = useState<Thread[]>([newThread()]);
  const [activeId, setActiveId] = useState<string>(threads[0].id);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [ratingBusyId, setRatingBusyId] = useState<string>("");
  const [ratedByMessage, setRatedByMessage] = useState<
    Record<string, { score: "helpful" | "not_helpful"; reason?: string }>
  >({});
  const [mode, setMode] = useState<ChatMode>("fast");
  const [assistantMode, setAssistantMode] = useState<AssistantMode>("coding");
  const [composerHint, setComposerHint] = useState("");
  const [canRetryStream, setCanRetryStream] = useState(false);
  const [isStopping, setIsStopping] = useState(false);
  const [showPromptSuggestions, setShowPromptSuggestions] = useState(false);
  const [showMobileTools, setShowMobileTools] = useState(true);
  const [isMicSupported, setIsMicSupported] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [pendingImages, setPendingImages] = useState<UploadedImage[]>([]);
  const [showMobileThreads, setShowMobileThreads] = useState(false);
  const [cloudSyncReady, setCloudSyncReady] = useState(false);
  const [chatStyle, setChatStyle] = useState<ChatStyleProfile>(DEFAULT_CHAT_STYLE_PROFILE);
  const [chatStyleReady, setChatStyleReady] = useState(false);
  const [lastModelUsed, setLastModelUsed] = useState<string>("");
  const [limitedTrialExpired, setLimitedTrialExpired] = useState(false);
  const [chatQuotaNotice, setChatQuotaNotice] = useState<ChatQuotaNotice | null>(null);
  const [trialPolicy, setTrialPolicy] = useState<{
    chatScope: "icd10_only" | "icd10_guidance";
    allowOpdDemo: boolean;
    allowSummarize: boolean;
  }>({
    chatScope: "icd10_only",
    allowOpdDemo: false,
    allowSummarize: false,
  });
  const messagesRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const pendingStreamRef = useRef<PendingStreamRequest | null>(null);
  const speechRef = useRef<InstanceType<SpeechRecognitionCtor> | null>(null);
  const shouldKeepListeningRef = useRef(false);
  const restartMicTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const threadsRef = useRef<Thread[]>(threads);
  const activeIdRef = useRef<string>(activeId);
  const cloudInitRef = useRef(false);
  const [stickToBottom, setStickToBottom] = useState(true);
  const [mobileComposerOpen, setMobileComposerOpen] = useState(false);
  const sheetTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const mobileQuickTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const composerPopupRef = useRef<HTMLDivElement | null>(null);
  const composerTriggerRef = useRef<HTMLButtonElement | null>(null);

  const active = useMemo(
    () => threads.find((t) => t.id === activeId) ?? threads[0],
    [threads, activeId]
  );
  const isChatSendLocked = Boolean(chatQuotaNotice);
  const expectedChatModel = useMemo(
    () => (mode === "fast" ? DEFAULT_FAST_MODEL : DEFAULT_PRECISE_MODEL),
    [mode]
  );

  useEffect(() => {
    setLastModelUsed("");
  }, [mode]);

  useEffect(() => {
    const lastAssistant = [...(active?.messages || [])].reverse().find((m) => m.role === "assistant")?.content || "";
    const parsed = parseChatQuotaNotice(lastAssistant);
    if (parsed) {
      setChatQuotaNotice(parsed);
    }
  }, [active?.messages]);

  useEffect(() => {
    const el = messagesRef.current;
    if (!el) return;
    if (!stickToBottom) return;
    el.scrollTop = el.scrollHeight;
  }, [active?.messages, loading, activeId, stickToBottom]);

  useEffect(() => {
    setStickToBottom(true);
    const el = messagesRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [activeId]);

  useEffect(() => {
    setMobileComposerOpen(false);
  }, [activeId]);

  useEffect(() => {
    if (!mobileComposerOpen) return;
    const id = requestAnimationFrame(() => {
      sheetTextareaRef.current?.focus();
    });
    return () => cancelAnimationFrame(id);
  }, [mobileComposerOpen]);

  useEffect(() => {
    if (!mobileComposerOpen) return;
    function handleOutsideClick(event: MouseEvent) {
      const target = event.target as Node;
      if (composerPopupRef.current?.contains(target)) return;
      if (composerTriggerRef.current?.contains(target)) return;
      setMobileComposerOpen(false);
    }
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, [mobileComposerOpen]);

  useEffect(() => {
    threadsRef.current = threads;
    activeIdRef.current = activeId;
  }, [threads, activeId]);

  useEffect(() => {
    try {
      const savedMode = localStorage.getItem(CHAT_MODE_KEY);
      const savedAssistantMode = localStorage.getItem(ASSISTANT_MODE_KEY);
      if (savedMode === "fast" || savedMode === "precise") setMode(savedMode);
      if (savedAssistantMode === "coding" || savedAssistantMode === "opd_demo") {
        setAssistantMode(savedAssistantMode);
      } else if (savedAssistantMode === "opd_rdu") {
        setAssistantMode("opd_demo");
      }
    } catch {
      // ignore storage failures
    }
  }, []);

  useEffect(() => {
    if (!sessionAuthed) {
      setLimitedTrialExpired(false);
      setChatQuotaNotice(null);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/trial-expired-policy", { cache: "no-store" });
        const data = (await res.json()) as {
          ok?: boolean;
          effective?: {
            limited: boolean;
            chatScope: "icd10_only" | "icd10_guidance";
            allowOpdDemo: boolean;
            allowSummarize: boolean;
          };
        };
        if (cancelled || !data?.ok) return;
        const limited = Boolean(data.effective?.limited);
        setLimitedTrialExpired(limited);
        if (data.effective) {
          setTrialPolicy({
            chatScope: data.effective.chatScope,
            allowOpdDemo: data.effective.allowOpdDemo,
            allowSummarize: data.effective.allowSummarize,
          });
        }
        if (limited) {
          if (!data.effective?.allowOpdDemo) setAssistantMode("coding");
          setMode("fast");
        }
      } catch {
        // ignore usage fetch error for trial-limited banner
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [sessionAuthed]);

  useEffect(() => {
    if (!sessionAuthed) return;
    let cancelled = false;
    const refreshLock = async () => {
      try {
        const res = await fetch("/api/usage", { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as {
          ok?: boolean;
          chatDailyLimitReached?: boolean;
          tokenBudgetReached?: boolean;
          nextDailyResetAt?: string;
          periodEnd?: string;
        };
        if (cancelled || !data?.ok) return;
        const locked = Boolean(data.chatDailyLimitReached || data.tokenBudgetReached);
        if (!locked) return;
        const resetAtRaw = data.chatDailyLimitReached ? data.nextDailyResetAt : data.periodEnd;
        const resetAtText = resetAtRaw
          ? new Date(resetAtRaw).toLocaleString("th-TH", { dateStyle: "short", timeStyle: "short" })
          : null;
        setChatQuotaNotice({
          shortLabel: "โควตาแชทเต็มชั่วคราว",
          resetAtText,
        });
      } catch {
        // ignore usage lock refresh failure
      }
    };
    void refreshLock();
    const onUsageUpdated = () => void refreshLock();
    window.addEventListener("usage-updated", onUsageUpdated);
    return () => {
      cancelled = true;
      window.removeEventListener("usage-updated", onUsageUpdated);
    };
  }, [sessionAuthed]);

  useEffect(() => {
    localStorage.setItem(CHAT_MODE_KEY, mode);
  }, [mode]);

  useEffect(() => {
    localStorage.setItem(ASSISTANT_MODE_KEY, assistantMode);
  }, [assistantMode]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/chat-style", { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as { ok?: boolean; profile?: ChatStyleProfile };
        if (!cancelled && data.ok && data.profile) {
          setChatStyle(data.profile);
        }
      } catch {
        // ignore style profile load failure
      } finally {
        if (!cancelled) setChatStyleReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!chatStyleReady) return;
    const timer = setTimeout(() => {
      void fetch("/api/chat-style", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profile: chatStyle }),
      }).catch(() => {
        // ignore style profile save failure
      });
    }, 450);
    return () => clearTimeout(timer);
  }, [chatStyle, chatStyleReady]);

  useEffect(() => {
    const w = window as Window & {
      SpeechRecognition?: SpeechRecognitionCtor;
      webkitSpeechRecognition?: SpeechRecognitionCtor;
    };
    const Ctor = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!Ctor) return;
    setIsMicSupported(true);
    const rec = new Ctor();
    rec.lang = "th-TH";
    rec.continuous = true;
    rec.interimResults = true;
    rec.onstart = () => {
      setIsListening(true);
      setComposerHint("กำลังฟังจากไมค์... กดอีกครั้งเพื่อหยุด");
    };
    rec.onend = () => {
      setIsListening(false);
      if (!shouldKeepListeningRef.current) return;
      if (restartMicTimerRef.current) {
        clearTimeout(restartMicTimerRef.current);
      }
      restartMicTimerRef.current = setTimeout(() => {
        if (!shouldKeepListeningRef.current) return;
        try {
          rec.start();
        } catch {
          setComposerHint("ไมค์หยุดชั่วคราว กำลังลองเชื่อมใหม่...");
        }
      }, 180);
    };
    rec.onerror = (event) => {
      setIsListening(false);
      const errorKey = event?.error || "unknown";
      if (errorKey === "not-allowed") {
        shouldKeepListeningRef.current = false;
        setComposerHint("ไมค์ถูกปฏิเสธสิทธิ์ กรุณาอนุญาตไมโครโฟนในเบราว์เซอร์");
      } else if (errorKey === "no-speech") {
        setComposerHint("ยังไม่ได้ยินเสียง กำลังฟังต่ออยู่...");
      } else {
        setComposerHint("ไมค์มีปัญหา กรุณาลองใหม่อีกครั้ง");
      }
    };
    rec.onresult = (event) => {
      let text = "";
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        text += event.results[i][0]?.transcript || "";
      }
      if (text.trim()) {
        setInput((prev) => (prev ? `${prev} ${text.trim()}` : text.trim()));
      }
    };
    speechRef.current = rec;
    return () => {
      shouldKeepListeningRef.current = false;
      if (restartMicTimerRef.current) {
        clearTimeout(restartMicTimerRef.current);
      }
      speechRef.current?.stop();
      speechRef.current = null;
    };
  }, []);

  useEffect(() => {
    for (const el of [textareaRef.current, sheetTextareaRef.current, mobileQuickTextareaRef.current]) {
      if (!el) continue;
      if (typeof el.getBoundingClientRect === "function" && el.getBoundingClientRect().height === 0) continue;
      el.style.height = "auto";
      const nextHeight = Math.min(el.scrollHeight, 180);
      el.style.height = `${Math.max(56, nextHeight)}px`;
    }
  }, [input, mobileComposerOpen]);

  useEffect(() => {
    if (cloudInitRef.current) return;
    cloudInitRef.current = true;
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/chat-threads", { cache: "no-store" });
        if (!res.ok) {
          setCloudSyncReady(true);
          return;
        }
        const data = (await res.json()) as {
          ok?: boolean;
          threads?: Thread[];
          activeId?: string | null;
        };
        if (!data.ok || cancelled) {
          setCloudSyncReady(true);
          return;
        }
        if (Array.isArray(data.threads) && data.threads.length > 0) {
          setThreads(data.threads);
          const nextActive =
            data.activeId && data.threads.some((t) => t.id === data.activeId) ? data.activeId : data.threads[0].id;
          setActiveId(nextActive);
        } else {
          await fetch("/api/chat-threads", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ threads: threadsRef.current, activeId: activeIdRef.current }),
          });
        }
      } catch {
        // ignore cloud sync init failure
      } finally {
        if (!cancelled) setCloudSyncReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!cloudSyncReady) return;
    const timer = setTimeout(() => {
      void fetch("/api/chat-threads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ threads: stripThreadsForCloud(threads), activeId }),
      }).catch(() => {
        // ignore cloud sync save failure
      });
    }, 600);
    return () => clearTimeout(timer);
  }, [threads, activeId, cloudSyncReady]);

  function onPickImages(files: FileList | null) {
    if (!files?.length) return;
    const candidates = Array.from(files).slice(0, 3);
    void Promise.all(
      candidates.map(
        (file) =>
          new Promise<UploadedImage | null>((resolve) => {
            if (!file.type.startsWith("image/")) {
              resolve(null);
              return;
            }
            const reader = new FileReader();
            reader.onload = () => {
              const dataUrl = String(reader.result || "");
              if (!/^data:image\/[a-zA-Z0-9.+-]+;base64,/.test(dataUrl)) {
                resolve(null);
                return;
              }
              resolve({
                id: `img-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
                name: file.name.slice(0, 100),
                dataUrl,
              });
            };
            reader.onerror = () => resolve(null);
            reader.readAsDataURL(file);
          })
      )
    ).then((items) => {
      const valid = items.filter((x): x is UploadedImage => Boolean(x));
      if (!valid.length) return;
      setPendingImages((prev) => {
        const next = [...prev, ...valid].slice(0, 3);
        setComposerHint(`แนบรูปแล้ว ${next.length} ภาพ`);
        return next;
      });
      if (imageInputRef.current) imageInputRef.current.value = "";
      if (cameraInputRef.current) cameraInputRef.current.value = "";
    });
  }

  function removePendingImage(id: string) {
    setPendingImages((prev) => {
      const next = prev.filter((x) => x.id !== id);
      if (next.length === 0 && composerHint.startsWith("แนบรูปแล้ว")) {
        setComposerHint("");
      } else if (next.length > 0 && composerHint.startsWith("แนบรูปแล้ว")) {
        setComposerHint(`แนบรูปแล้ว ${next.length} ภาพ`);
      }
      return next;
    });
  }

  function startAssistantPlaceholder(threadId: string, answerSource?: "internal" | "mixed" | "external") {
    setThreads((prev) =>
      prev.map((t) =>
        t.id === threadId
          ? {
              ...t,
              messages: [...t.messages, { role: "assistant", content: "", answerSource }],
            }
          : t
      )
    );
  }

  function appendAssistantChunk(threadId: string, chunk: string) {
    if (!chunk) return;
    setThreads((prev) =>
      prev.map((t) => {
        if (t.id !== threadId) return t;
        const nextMessages = [...t.messages];
        for (let i = nextMessages.length - 1; i >= 0; i -= 1) {
          if (nextMessages[i].role === "assistant") {
            nextMessages[i] = {
              ...nextMessages[i],
              content: `${nextMessages[i].content}${chunk}`,
            };
            break;
          }
        }
        return { ...t, messages: nextMessages };
      })
    );
  }

  function finalizeAssistantMessage(
    threadId: string,
    payload: StreamDonePayload
  ) {
    setThreads((prev) =>
      prev.map((t) => {
        if (t.id !== threadId) return t;
        const nextMessages = [...t.messages];
        for (let i = nextMessages.length - 1; i >= 0; i -= 1) {
          if (nextMessages[i].role === "assistant") {
            nextMessages[i] = {
              ...nextMessages[i],
              answerSource: payload.answerSource || nextMessages[i].answerSource,
            };
            break;
          }
        }
        return { ...t, messages: nextMessages };
      })
    );
  }

  function setAssistantError(threadId: string, message: string) {
    setThreads((prev) =>
      prev.map((t) => {
        if (t.id !== threadId) return t;
        const nextMessages = [...t.messages];
        for (let i = nextMessages.length - 1; i >= 0; i -= 1) {
          if (nextMessages[i].role === "assistant") {
            nextMessages[i] = { ...nextMessages[i], content: message };
            return { ...t, messages: nextMessages };
          }
        }
        nextMessages.push({ role: "assistant", content: message });
        return { ...t, messages: nextMessages };
      })
    );
  }

  function getLastAssistantContent(threadId: string) {
    const thread = threads.find((t) => t.id === threadId);
    if (!thread) return "";
    for (let i = thread.messages.length - 1; i >= 0; i -= 1) {
      if (thread.messages[i].role === "assistant") return thread.messages[i].content || "";
    }
    return "";
  }

  async function consumeStreamResponse(
    res: Response,
    threadId: string
  ): Promise<"done" | "error"> {
    const contentType = String(res.headers.get("content-type") || "");
    if (contentType.includes("application/json")) {
      const data = (await res.json()) as {
        ok?: boolean;
        reply?: string;
        error?: string;
        answerSource?: "internal" | "mixed" | "external";
        model?: string;
      };
      const reply = data.ok && data.reply ? data.reply : data.error || "ขออภัยครับ ตอบกลับไม่สำเร็จ";
      const quota = parseChatQuotaNotice(reply);
      if (quota) {
        setChatQuotaNotice(quota);
        setComposerHint(quota.resetAtText ? `แชทถูกพักไว้ชั่วคราว · รอถึง ${quota.resetAtText}` : "แชทถูกพักไว้ชั่วคราว");
      }
      setAssistantError(threadId, quota ? quota.shortLabel : reply);
      finalizeAssistantMessage(threadId, { answerSource: data.answerSource });
      if (data.model) setLastModelUsed(data.model);
      return data.ok ? "done" : "error";
    }
    if (!res.body) {
      setAssistantError(threadId, "ขออภัยครับ ตอบกลับไม่สำเร็จ");
      return "error";
    }
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let streamDone = false;
    let status: "done" | "error" = "error";
    let gotAnyEvent = false;
    while (!streamDone) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const events = buffer.split("\n\n");
      buffer = events.pop() || "";
      for (const eventBlock of events) {
        const dataLine = eventBlock
          .split("\n")
          .find((line) => line.startsWith("data: "));
        if (!dataLine) continue;
        const payloadRaw = dataLine.slice(6).trim();
        if (!payloadRaw) continue;
        let payload: {
          type?: "delta" | "done" | "error";
          delta?: string;
          message?: string;
          answerSource?: "internal" | "mixed" | "external";
          usage?: TokenUsageMeta;
          variant?: string;
          model?: string;
        };
        try {
          payload = JSON.parse(payloadRaw) as {
            type?: "delta" | "done" | "error";
            delta?: string;
            message?: string;
            answerSource?: "internal" | "mixed" | "external";
            usage?: TokenUsageMeta;
            variant?: string;
            model?: string;
          };
        } catch {
          continue;
        }
        gotAnyEvent = true;
        if (payload.type === "delta") {
          appendAssistantChunk(threadId, payload.delta || "");
        } else if (payload.type === "done") {
          finalizeAssistantMessage(threadId, payload);
          if (payload.model) setLastModelUsed(payload.model);
          status = "done";
          streamDone = true;
        } else if (payload.type === "error") {
          const message = payload.message || "เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง";
          const quota = parseChatQuotaNotice(message);
          if (quota) {
            setChatQuotaNotice(quota);
            setComposerHint(quota.resetAtText ? `แชทถูกพักไว้ชั่วคราว · รอถึง ${quota.resetAtText}` : "แชทถูกพักไว้ชั่วคราว");
          }
          setAssistantError(threadId, quota ? quota.shortLabel : message);
          status = "error";
          streamDone = true;
        }
      }
    }
    const tail = buffer.trim();
    if (!streamDone && tail.startsWith("data:")) {
      const payloadRaw = tail.replace(/^data:\s*/, "").trim();
      if (payloadRaw) {
        try {
          const payload = JSON.parse(payloadRaw) as {
            type?: "delta" | "done" | "error";
            delta?: string;
            message?: string;
            answerSource?: "internal" | "mixed" | "external";
            usage?: TokenUsageMeta;
            variant?: string;
            model?: string;
          };
          gotAnyEvent = true;
          if (payload.type === "delta") {
            appendAssistantChunk(threadId, payload.delta || "");
          } else if (payload.type === "done") {
            finalizeAssistantMessage(threadId, payload);
            if (payload.model) setLastModelUsed(payload.model);
            status = "done";
            streamDone = true;
          } else if (payload.type === "error") {
            const message = payload.message || "เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง";
            const quota = parseChatQuotaNotice(message);
            if (quota) {
              setChatQuotaNotice(quota);
              setComposerHint(quota.resetAtText ? `แชทถูกพักไว้ชั่วคราว · รอถึง ${quota.resetAtText}` : "แชทถูกพักไว้ชั่วคราว");
            }
            setAssistantError(threadId, quota ? quota.shortLabel : message);
            status = "error";
            streamDone = true;
          }
        } catch {
          // ignore malformed tail payload
        }
      }
    }
    if (status === "error" && !streamDone) {
      const current = getLastAssistantContent(threadId).trim();
      if (!current) {
        setAssistantError(threadId, gotAnyEvent ? "สตรีมขาดช่วง กรุณากด Retry stream" : "ขออภัยครับ ตอบกลับไม่สำเร็จ");
      }
    }
    return status;
  }

  async function runStreamRequest(params: PendingStreamRequest) {
    pendingStreamRef.current = params;
    setCanRetryStream(false);
    setLoading(true);
    setIsStopping(false);
    if (!params.appendToExistingAssistant) {
      startAssistantPlaceholder(params.threadId);
    }
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const res = await fetch("/api/specialist-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: params.message,
          history: params.history,
          mode: params.mode,
          assistantMode: params.assistantMode,
          styleProfile: params.styleProfile,
          images: params.images?.map((img) => ({ name: img.name, dataUrl: img.dataUrl })) || [],
          stream: true,
        }),
        signal: controller.signal,
      });
      const status = await consumeStreamResponse(res, params.threadId);
      if (status === "error") {
        setCanRetryStream(true);
        setComposerHint(
          res.status === 401
            ? "เซสชันหมดอายุหรือยังไม่ได้เข้าสู่ระบบ — กรุณาเข้าสู่ระบบแล้วลองใหม่"
            : "สตรีมหลุดหรือตอบไม่ครบ กด Retry stream เพื่อต่อคำตอบ"
        );
      } else {
        setCanRetryStream(false);
        pendingStreamRef.current = null;
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        setCanRetryStream(true);
        setComposerHint("หยุดการตอบแล้ว กด Retry stream เพื่อต่อจากข้อความล่าสุด");
      } else {
        setAssistantError(params.threadId, "เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง");
        setCanRetryStream(true);
        setComposerHint("สตรีมหลุดหรือตอบไม่ครบ กด Retry stream เพื่อต่อคำตอบ");
      }
    } finally {
      abortRef.current = null;
      setLoading(false);
      setIsStopping(false);
    }
  }

  function stopStreaming() {
    if (!loading) return;
    setIsStopping(true);
    abortRef.current?.abort();
  }

  async function retryStreamFromLastChunk() {
    if (loading) return;
    if (!sessionAuthed) {
      setComposerHint(
        sessionStatus === "unauthenticated"
          ? "กรุณาเข้าสู่ระบบก่อนใช้แชทผู้เชี่ยวชาญ"
          : "กำลังตรวจสอบการเข้าสู่ระบบ รอสักครู่แล้วลองอีกครั้ง"
      );
      return;
    }
    const pending = pendingStreamRef.current;
    if (!pending) return;
    const partial = getLastAssistantContent(pending.threadId).trim();
    const continuationHistory: ChatHistoryPayload[] = partial
      ? [
          ...pending.history,
          { role: "user", content: pending.message },
          { role: "assistant", content: partial },
        ]
      : pending.history;
    const continuationMessage = partial
      ? "ตอบต่อจากข้อความ assistant ล่าสุดให้จบ โดยไม่ทวนเนื้อหาที่ตอบแล้ว"
      : pending.message;
    setComposerHint("กำลังต่อคำตอบจากช่วงล่าสุด...");
    await runStreamRequest({
      threadId: pending.threadId,
      message: continuationMessage,
      history: continuationHistory.slice(-12),
      mode: pending.mode,
      assistantMode: pending.assistantMode,
      styleProfile: pending.styleProfile,
      appendToExistingAssistant: Boolean(partial),
    });
  }

  async function sendMessage() {
    const trimmed = input.trim();
    const attachments = [...pendingImages];
    if (!trimmed && attachments.length === 0) return;
    if (!sessionAuthed) {
      setComposerHint(
        sessionStatus === "unauthenticated"
          ? "กรุณาเข้าสู่ระบบก่อนใช้แชทผู้เชี่ยวชาญ"
          : "กำลังตรวจสอบการเข้าสู่ระบบ รอสักครู่แล้วลองอีกครั้ง"
      );
      return;
    }
    if (isChatSendLocked) {
      setComposerHint(
        chatQuotaNotice?.resetAtText
          ? `โควตาเต็มชั่วคราว รอถึง ${chatQuotaNotice.resetAtText} หรืออัปเกรดแพ็กเกจ`
          : "โควตาเต็มชั่วคราว กรุณาอัปเกรดแพ็กเกจเพื่อใช้งานต่อ"
      );
      return;
    }
    const imageOnly = !trimmed && attachments.length > 0;
    const text = imageOnly ? DEFAULT_IMAGE_ONLY_API_PROMPT : trimmed;
    setInput("");
    setPendingImages([]);
    if (composerHint.startsWith("แนบรูปแล้ว")) {
      setComposerHint("");
    }
    await sendPreparedMessage(text, attachments, undefined, {
      displayContent: imageOnly ? IMAGE_ONLY_DISPLAY_LINE : undefined,
    });
    setMobileComposerOpen(false);
  }

  function buildSummaryPrompt(kind: SummaryKind) {
    if (kind === "diagnosis") {
      return [
        "ช่วยสรุปเป็นเฉพาะกลุ่ม diagnosis เท่านั้น โดยไม่ต้องสรุป SOAP หรือส่วนอื่น",
        "1) Principal diagnosis",
        "2) Comorbidity",
        "3) Complication",
        "4) Other diagnosis",
        "5) External cause (ถ้ามี)",
        "ตอบเป็นหัวข้อสั้น กระชับ",
        "ถ้าหัวข้อไหนไม่มีข้อมูลให้ระบุว่า 'ไม่พบข้อมูล'",
        "ถ้ามั่นใจรหัสให้ใส่ ICD-10 ต่อท้ายโรคในวงเล็บ เช่น Disease name (ICD-10: ...)",
      ].join("\n");
    }
    if (kind === "opd_case") {
      return [
        "ช่วยสรุปเคสแบบ OPD ไทยให้กระชับและใช้งานได้จริง โดยเรียงหัวข้อดังนี้",
        "CC",
        "PI",
        "PE",
        "PHI/PMH และ U/D",
        "Investigation",
        "Diagnosis",
        "Differential diagnosis",
        "Treatment",
        "Plan และ follow-up",
        "ถ้าหัวข้อไหนไม่มีข้อมูลให้เขียนว่า 'ไม่พบข้อมูล'",
        "ให้ใส่ ICD-10 เฉพาะบรรทัดชื่อโรคใน Diagnosis และ Differential diagnosis เท่านั้น",
        "ห้ามใส่ ICD-10 ใน CC/PI/PE/PHI/Investigation/Treatment/Plan/Follow-up",
      ].join("\n");
    }
    return [
      "ช่วยสรุปแบบ SOAP สำหรับเคส OPD",
      "S/O/A/P ให้ครบ กระชับ ใช้งานจริงได้",
      "ใน A ถ้ามั่นใจรหัสให้ใส่ชื่อโรคพร้อม (ICD-10: ...)",
      "ห้ามใส่ ICD-10 ใน S, O และ P",
      "ถ้าไม่มีข้อมูลบางส่วนให้ระบุว่า 'ไม่พบข้อมูล'",
    ].join("\n");
  }

  async function sendPreparedMessage(
    text: string,
    attachments?: UploadedImage[],
    historyOverride?: ChatHistoryPayload[],
    opts?: { displayContent?: string }
  ) {
    if (!text || !active || loading) return;
    setComposerHint((h) => (h.includes("แก้ข้อความ") ? "" : h));
    if (!sessionAuthed) {
      setComposerHint(
        sessionStatus === "unauthenticated"
          ? "กรุณาเข้าสู่ระบบก่อนใช้แชทผู้เชี่ยวชาญ"
          : "กำลังตรวจสอบการเข้าสู่ระบบ รอสักครู่แล้วลองอีกครั้ง"
      );
      return;
    }
    if (limitedTrialExpired) {
      if (assistantMode === "opd_demo" && !trialPolicy.allowOpdDemo) {
        setComposerHint("Trial หมดอายุแล้ว: โหมด OPD ถูกปิดไว้ชั่วคราว");
        return;
      }
      const allowed =
        trialPolicy.chatScope === "icd10_only" ? isIcdLookupOnlyQuery(text) : isIcdLookupOnlyQuery(text) || /guideline|แนวทาง|หลักเกณฑ์/i.test(text);
      if (!allowed) {
        setComposerHint(
          trialPolicy.chatScope === "icd10_only"
            ? "Trial หมดอายุแล้ว: ใช้งานได้เฉพาะค้นหารหัส ICD-10"
            : "Trial หมดอายุแล้ว: ใช้งานได้เฉพาะ ICD-10 และ coding guidance"
        );
        return;
      }
    }

    const attachmentLine = attachments?.length ? `\n[แนบรูป ${attachments.length} ภาพ]` : "";
    const displayBody = opts?.displayContent ?? text;
    const userMsg: ChatMessage = {
      role: "user",
      content: `${displayBody}${attachmentLine}`,
      ...(attachments?.length
        ? { images: attachments.map(({ id, name, dataUrl }) => ({ id, name, dataUrl })) }
        : {}),
    };
    const firstTitle =
      opts?.displayContent === IMAGE_ONLY_DISPLAY_LINE
        ? "แนบรูปตรวจ"
        : (opts?.displayContent ?? text).slice(0, 40);
    setThreads((prev) =>
      prev.map((t) =>
        t.id === active.id
          ? {
              ...t,
              title: t.messages.length === 0 ? firstTitle : t.title,
              messages: [...t.messages, userMsg],
            }
          : t
      )
    );

    try {
      await runStreamRequest({
        threadId: active.id,
        message: text,
        history: historyOverride ?? active.messages.slice(-30).map((m) => ({ role: m.role, content: m.content })),
        mode,
        assistantMode,
        styleProfile: chatStyle,
        images: attachments?.length ? attachments : undefined,
      });
    } catch {
      setAssistantError(active.id, "เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง");
    }
  }

  async function sendSummary(kind: SummaryKind) {
    if (limitedTrialExpired && !trialPolicy.allowSummarize) {
      setComposerHint("Trial หมดอายุแล้ว: ปิดปุ่มสรุปชั่วคราว กรุณาอัปเกรดแพ็กเกจเพื่อใช้งานต่อ");
      return;
    }
    if (!sessionAuthed) {
      setComposerHint(
        sessionStatus === "unauthenticated"
          ? "กรุณาเข้าสู่ระบบก่อนใช้แชทผู้เชี่ยวชาญ"
          : "กำลังตรวจสอบการเข้าสู่ระบบ รอสักครู่แล้วลองอีกครั้ง"
      );
      return;
    }
    const basePrompt = buildSummaryPrompt(kind);
    const threadMessages = active?.messages || [];
    const fullThreadContext = buildSummaryContextFromThread(threadMessages);
    const prompt = fullThreadContext
      ? `${basePrompt}\n\nข้อมูลเคสจากบทสนทนาทั้งหมดในแชทนี้ (ใช้เป็นบริบทหลัก):\n${fullThreadContext}`
      : basePrompt;
    const summaryHistory = threadMessages
      .filter((m) => !isSummaryCommandText(m.content))
      .slice(-40)
      .map((m) => ({ role: m.role, content: m.content }));
    setComposerHint(
      kind === "diagnosis"
        ? "กำลังสรุป diagnosis..."
        : kind === "opd_case"
        ? "กำลังสรุปเคส OPD..."
        : "กำลังสรุป SOAP..."
    );
    await sendPreparedMessage(prompt, undefined, summaryHistory);
    setMobileComposerOpen(false);
  }

  async function regenerateLastAnswer() {
    if (!active || loading) return;
    if (!sessionAuthed) {
      setComposerHint(
        sessionStatus === "unauthenticated"
          ? "กรุณาเข้าสู่ระบบก่อนใช้แชทผู้เชี่ยวชาญ"
          : "กำลังตรวจสอบการเข้าสู่ระบบ รอสักครู่แล้วลองอีกครั้ง"
      );
      return;
    }
    const lastUserIndex = [...active.messages]
      .map((m, i) => ({ m, i }))
      .filter((x) => x.m.role === "user")
      .at(-1)?.i;
    if (lastUserIndex == null) return;
    const targetQuestion = active.messages[lastUserIndex].content;
    const history = active.messages.slice(0, lastUserIndex);
    setComposerHint("กำลัง regenerate คำตอบล่าสุด...");
    try {
      setThreads((prev) =>
        prev.map((t) => {
          if (t.id !== active.id) return t;
          const cloned = [...t.messages];
          const assistantAfter = cloned.findIndex((m, i) => i > lastUserIndex && m.role === "assistant");
          if (assistantAfter >= 0) cloned.splice(assistantAfter, 1);
          return { ...t, messages: cloned };
        })
      );
      await runStreamRequest({
        threadId: active.id,
        message: targetQuestion,
        history: history.map((m) => ({ role: m.role, content: m.content })),
        mode,
        assistantMode,
        styleProfile: chatStyle,
      });
    } catch {
      setAssistantError(active.id, "เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง");
    }
  }

  async function toggleMic() {
    const rec = speechRef.current;
    if (!rec) {
      try {
        if (typeof navigator !== "undefined" && navigator.mediaDevices?.getUserMedia) {
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          stream.getTracks().forEach((track) => track.stop());
        }
        setComposerHint("อนุญาตไมค์แล้ว แต่เบราว์เซอร์นี้ยังไม่รองรับถอดเสียงสด แนะนำใช้ปุ่มไมค์บนคีย์บอร์ดแทน");
      } catch {
        setComposerHint("ไม่ได้รับสิทธิ์ไมโครโฟน กรุณาอนุญาตไมค์ใน Chrome แล้วลองใหม่");
      }
      return;
    }
    if (isListening) {
      shouldKeepListeningRef.current = false;
      if (restartMicTimerRef.current) {
        clearTimeout(restartMicTimerRef.current);
      }
      rec.stop();
      setComposerHint("หยุดฟังเสียงแล้ว");
    } else {
      try {
        shouldKeepListeningRef.current = true;
        rec.start();
      } catch {
        try {
          if (typeof navigator !== "undefined" && navigator.mediaDevices?.getUserMedia) {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            stream.getTracks().forEach((track) => track.stop());
          }
          shouldKeepListeningRef.current = true;
          rec.start();
        } catch {
          shouldKeepListeningRef.current = false;
          setComposerHint("เปิดไมค์ไม่สำเร็จบนคอม ลองใช้ Chrome ล่าสุด และอนุญาตไมค์ใน Site settings");
        }
      }
    }
  }

  function editAndResendFrom(index: number) {
    if (!active) return;
    const message = active.messages[index];
    if (!message || message.role !== "user") return;
    setInput(message.content);
    setComposerHint("แก้ข้อความแล้วกดส่งเพื่อถามใหม่");
    if (typeof window !== "undefined" && window.matchMedia("(max-width: 639px)").matches) {
      setMobileComposerOpen(false);
      requestAnimationFrame(() => {
        mobileQuickTextareaRef.current?.focus();
      });
    }
  }

  async function rateAssistantMessage(
    threadId: string,
    messageIndex: number,
    score: "helpful" | "not_helpful",
    reason?: string
  ) {
    const busyKey = `${threadId}-${messageIndex}-${score}`;
    const messageKey = `${threadId}-${messageIndex}`;
    setRatedByMessage((prev) => ({
      ...prev,
      [messageKey]: { score, reason },
    }));
    setRatingBusyId(busyKey);
    try {
      await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "telemetry",
          message: `specialist_chat_feedback:${score}${reason ? `:${reason}` : ""}`,
          payload: JSON.stringify({
            threadId,
            messageIndex,
            score,
            reason: reason || null,
            assistantMode,
          }),
        }),
      });
    } finally {
      setRatingBusyId("");
    }
  }

  function removeThread(threadId: string) {
    if (typeof window !== "undefined") {
      const ok = window.confirm("ยืนยันลบแชตนี้ใช่ไหม? ข้อความในห้องนี้จะหายไป");
      if (!ok) return;
    }
    setThreads((prev) => {
      const remain = prev.filter((t) => t.id !== threadId);
      if (remain.length > 0) {
        if (activeId === threadId) {
          setActiveId(remain[0].id);
        }
        setShowMobileThreads(false);
        return remain;
      }
      const t = newThread();
      setActiveId(t.id);
      setShowMobileThreads(false);
      return [t];
    });
  }

  const quickPrompts =
    assistantMode === "opd_demo"
      ? [
          "ช่วยถามประวัติเคสนี้ให้ครบสำหรับ OPD แบบไทย (เรียงเป็นหัวข้อสั้นๆ)",
          "จากข้อมูลนี้ควรตรวจร่างกายอะไรเพิ่มเพื่อไม่ให้พลาด red flags",
          "ช่วยทำ DDx 3 อันดับ พร้อมตรวจเพิ่ม และระบุชื่อโรคในรูปแบบ (ICD-10: ...)",
          "เคสนี้ถ้าจะให้ยาฆ่าเชื้อ ต้องมีหลักฐานจากประวัติและตรวจร่างกายอะไรบ้าง",
          "ช่วยวางแผนรักษาแบบ RDU: ถ้ายังไม่เข้าเกณฑ์ยาฆ่าเชื้อ ให้ทางเลือก symptomatic + นัดติดตาม",
          "ช่วยสรุปเคสตาม pattern OPD ไทย และต่อท้ายแบบ SOAP",
        ]
      : [
          "ช่วยสรุปชาร์จเป็น pattern: Principal, Comorbidity, Complication, Other diagnosis, External cause",
          "เคสนี้ควรประเมินอะไรเพิ่มเพื่อรองรับ diagnosis ใน order sheet",
          "ถ้าสงสัย pneumonia ต้องมีหลักฐานขั้นต่ำอะไรถึงจะพิจารณาลงได้",
          "ช่วยแยก differential และบอกเกณฑ์ที่ต้องมีก่อนลงวินิจฉัย",
        ];
  const assistantModeLabel = assistantMode === "opd_demo" ? "OPD" : "Coding";
  const assistantModeHint =
    assistantMode === "opd_demo"
      ? "ซักประวัติ · ตรวจร่างกาย · DDx · RDU/ICD-10"
      : "ICD-10 / coding guidance · สรุปชาร์จ";

  const renderComposerInner = (textRef: RefObject<HTMLTextAreaElement | null>) => (
    <>
      {composerHint ? <div className="mb-1 text-[11px] text-cyan-300">{composerHint}</div> : null}
      {chatQuotaNotice ? (
        <div className="mb-2 rounded-lg border border-amber-600/50 bg-amber-950/30 px-2.5 py-1.5 text-[11px] text-amber-100">
          <span>{chatQuotaNotice.shortLabel}</span>
          {chatQuotaNotice.resetAtText ? <span>{` · รอถึง ${chatQuotaNotice.resetAtText}`}</span> : null}
          <span>{` · `}</span>
          <Link href="/pricing" className="font-medium text-cyan-300 underline underline-offset-2 hover:text-cyan-200">
            อัปเกรดแพ็กเกจ
          </Link>
        </div>
      ) : null}
      {pendingImages.length ? (
        <div className="mb-2 flex flex-wrap gap-2">
          {pendingImages.map((img) => (
            <span
              key={img.id}
              className="inline-flex items-center gap-2 rounded-full border border-slate-600 bg-slate-900/80 px-2 py-1 text-[11px] text-slate-200"
            >
              <img src={img.dataUrl} alt={img.name} className="h-6 w-6 rounded object-cover ring-1 ring-slate-600" />
              <span>{img.name}</span>
              <button
                type="button"
                onClick={() => removePendingImage(img.id)}
                className="text-rose-300 hover:text-rose-200"
                title="ลบรูปนี้"
              >
                ×
              </button>
            </span>
          ))}
        </div>
      ) : null}
      <div className="relative">
        <textarea
          ref={textRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          rows={2}
          className="w-full max-h-[180px] min-h-[56px] resize-none overflow-y-auto rounded-xl border border-slate-700 bg-slate-900/80 px-3 py-2.5 pr-[7.25rem] sm:pr-36 text-sm leading-relaxed outline-none focus:border-cyan-500"
          placeholder={
            assistantMode === "opd_demo"
              ? "Enter ขึ้นบรรทัดใหม่ · ส่งที่ปุ่มส่ง — เล่าเคส หรือแนบรูป EKG/X-ray…"
              : "Enter ขึ้นบรรทัดใหม่ · ส่งที่ปุ่มส่ง — ถาม diagnosis / แนบรูปตรวจ…"
          }
        />
        <div className="absolute right-1.5 bottom-2 flex items-center gap-0.5 sm:right-2 sm:gap-1">
          <button
            type="button"
            onClick={() => imageInputRef.current?.click()}
            disabled={loading}
            className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-slate-600 bg-slate-900/80 text-slate-200 disabled:opacity-50 sm:h-8 sm:w-8"
            title="เลือกรูปจากเครื่อง"
            aria-label="เลือกรูปจากเครื่อง"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <path d="M16 3h5v5" />
              <path d="m21 3-9 9" />
            </svg>
          </button>
          <button
            type="button"
            onClick={() => cameraInputRef.current?.click()}
            disabled={loading}
            className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-slate-600 bg-slate-900/80 text-slate-200 disabled:opacity-50 sm:h-8 sm:w-8"
            title="ถ่ายรูป"
            aria-label="ถ่ายรูป"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round">
              <path d="M14.5 4h-5L8 7H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-1.5-3z" />
              <circle cx="12" cy="13" r="3" />
            </svg>
          </button>
          <button
            type="button"
            onClick={toggleMic}
            disabled={loading}
            className={`inline-flex h-7 w-7 items-center justify-center rounded-lg border disabled:opacity-50 sm:h-8 sm:w-8 ${
              isListening
                ? "border-rose-500 bg-rose-600/20 text-rose-100"
                : "border-slate-600 bg-slate-900/80 text-slate-200"
            }`}
            title={isListening ? "หยุดไมค์" : isMicSupported ? "เริ่มไมค์" : "อนุญาตไมค์"}
            aria-label={isListening ? "หยุดไมค์" : isMicSupported ? "เริ่มไมค์" : "อนุญาตไมค์"}
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <rect x="9" y="3" width="6" height="11" rx="3" />
              <path d="M5 11a7 7 0 0 0 14 0" />
              <path d="M12 18v3" />
            </svg>
          </button>
          <button
            type="button"
            onClick={() => void sendMessage()}
            disabled={loading || isChatSendLocked || (!input.trim() && !pendingImages.length) || !sessionAuthed}
            className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-cyan-600 text-white hover:bg-cyan-500 disabled:opacity-50 sm:h-8 sm:w-8"
            title={loading ? "กำลังตอบ..." : "ส่ง"}
            aria-label={loading ? "กำลังตอบ..." : "ส่ง"}
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M22 2 11 13" />
              <path d="m22 2-7 20-4-9-9-4 20-7Z" />
            </svg>
          </button>
        </div>
      </div>
      <div className="mt-1 hidden text-[11px] text-slate-500 sm:block">
        ระบบปกปิดข้อมูลระบุตัวผู้ป่วยอัตโนมัติก่อนส่งไป AI (เช่น ชื่อ, เลขบัตร, HN, AN)
      </div>
      <div className="mt-2 hidden sm:block">
        <button
          type="button"
          onClick={() => setShowPromptSuggestions((prev) => !prev)}
          className="rounded-full border border-slate-700 bg-slate-900/70 px-3 py-1 text-xs text-slate-300 hover:border-cyan-500/50"
        >
          {showPromptSuggestions ? "ซ่อนตัวอย่าง prompt" : "แสดงตัวอย่าง prompt"}
        </button>
        {showPromptSuggestions ? (
          <div className="mt-2 grid max-h-32 gap-2 overflow-y-auto rounded-xl border border-slate-700/70 bg-slate-950/40 p-2 sm:grid-cols-2">
            {quickPrompts.map((quick) => (
              <button
                key={quick}
                type="button"
                onClick={() => setInput(quick)}
                className="rounded-lg border border-slate-700 bg-slate-900/70 px-3 py-2 text-left text-xs leading-relaxed text-slate-200 hover:border-cyan-500/50"
              >
                {quick}
              </button>
            ))}
          </div>
        ) : null}
      </div>
      <div className="mt-2 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center">
        {assistantMode === "coding" ? (
          <button
            type="button"
            onClick={() => void sendSummary("diagnosis")}
            disabled={loading || !active?.messages.length || !sessionAuthed || (limitedTrialExpired && !trialPolicy.allowSummarize)}
            className="w-full rounded-full border border-sky-700 bg-sky-900/40 px-3 py-1 text-xs text-sky-200 hover:bg-sky-800/50 disabled:opacity-50 sm:w-auto"
          >
            สรุป diagnosis
          </button>
        ) : (
          <>
            <button
              type="button"
              onClick={() => void sendSummary("opd_case")}
              disabled={loading || !active?.messages.length || !sessionAuthed || (limitedTrialExpired && !trialPolicy.allowSummarize)}
              className="w-full rounded-full border border-sky-700 bg-sky-900/40 px-3 py-1 text-xs text-sky-200 hover:bg-sky-800/50 disabled:opacity-50 sm:w-auto"
            >
              สรุปเคส OPD
            </button>
            <button
              type="button"
              onClick={() => void sendSummary("opd_soap")}
              disabled={loading || !active?.messages.length || !sessionAuthed || (limitedTrialExpired && !trialPolicy.allowSummarize)}
              className="w-full rounded-full border border-teal-700 bg-teal-900/40 px-3 py-1 text-xs text-teal-200 hover:bg-teal-800/50 disabled:opacity-50 sm:w-auto"
            >
              สรุป SOAP
            </button>
          </>
        )}
        <button
          type="button"
          onClick={() => void regenerateLastAnswer()}
          disabled={loading || !active?.messages.some((m) => m.role === "user") || !sessionAuthed}
          className="w-full rounded-full border border-emerald-700 bg-emerald-900/40 px-3 py-1 text-xs text-emerald-200 hover:bg-emerald-800/50 disabled:opacity-50 sm:w-auto"
        >
          Regenerate answer
        </button>
        <button
          type="button"
          onClick={stopStreaming}
          disabled={!loading}
          className="hidden w-full rounded-full border border-rose-700 bg-rose-900/40 px-3 py-1 text-xs text-rose-200 hover:bg-rose-800/50 disabled:opacity-50 sm:block sm:w-auto"
        >
          {isStopping ? "Stopping..." : "Stop generating"}
        </button>
        <button
          type="button"
          onClick={() => void retryStreamFromLastChunk()}
          disabled={loading || !canRetryStream || !sessionAuthed}
          className="hidden w-full rounded-full border border-indigo-700 bg-indigo-900/40 px-3 py-1 text-xs text-indigo-200 hover:bg-indigo-800/50 disabled:opacity-50 sm:block sm:w-auto"
        >
          Retry stream
        </button>
        {loading ? (
          <button
            type="button"
            onClick={stopStreaming}
            disabled={!loading}
            className="w-full rounded-full border border-rose-700 bg-rose-900/40 px-3 py-1 text-xs text-rose-200 hover:bg-rose-800/50 disabled:opacity-50 sm:hidden"
          >
            {isStopping ? "Stopping..." : "Stop"}
          </button>
        ) : null}
        {canRetryStream ? (
          <button
            type="button"
            onClick={() => void retryStreamFromLastChunk()}
            disabled={loading || !canRetryStream || !sessionAuthed}
            className="w-full rounded-full border border-indigo-700 bg-indigo-900/40 px-3 py-1 text-xs text-indigo-200 hover:bg-indigo-800/50 disabled:opacity-50 sm:hidden"
          >
            Retry
          </button>
        ) : null}
      </div>
    </>
  );

  const renderMobileQuickComposer = () => (
    <>
      {composerHint ? <div className="mb-1 text-[11px] text-cyan-300">{composerHint}</div> : null}
      {chatQuotaNotice ? (
        <div className="mb-2 rounded-lg border border-amber-600/50 bg-amber-950/30 px-2.5 py-1.5 text-[11px] text-amber-100">
          <span>{chatQuotaNotice.shortLabel}</span>
          {chatQuotaNotice.resetAtText ? <span>{` · รอถึง ${chatQuotaNotice.resetAtText}`}</span> : null}
          <span>{` · `}</span>
          <Link href="/pricing" className="font-medium text-cyan-300 underline underline-offset-2 hover:text-cyan-200">
            อัปเกรดแพ็กเกจ
          </Link>
        </div>
      ) : null}
      {pendingImages.length ? (
        <div className="mb-2 flex flex-wrap gap-2">
          {pendingImages.map((img) => (
            <span
              key={img.id}
              className="inline-flex items-center gap-2 rounded-full border border-slate-600 bg-slate-900/80 px-2 py-1 text-[11px] text-slate-200"
            >
              <img src={img.dataUrl} alt={img.name} className="h-6 w-6 rounded object-cover ring-1 ring-slate-600" />
              <span>{img.name}</span>
              <button
                type="button"
                onClick={() => removePendingImage(img.id)}
                className="text-rose-300 hover:text-rose-200"
                title="ลบรูปนี้"
              >
                ลบ
              </button>
            </span>
          ))}
        </div>
      ) : null}
      <div className="relative">
        <textarea
          ref={mobileQuickTextareaRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onFocus={() => {
            requestAnimationFrame(() => {
              mobileQuickTextareaRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
            });
          }}
          rows={2}
          className="w-full max-h-[180px] min-h-[56px] resize-none overflow-y-auto rounded-xl border border-slate-700 bg-slate-900/80 px-3 py-2.5 pr-[9.5rem] text-sm leading-relaxed outline-none focus:border-cyan-500"
          placeholder={
            assistantMode === "opd_demo"
              ? "Enter ขึ้นบรรทัดใหม่ · ส่งที่ปุ่ม — เล่าเคส หรือแนบรูป EKG/X-ray..."
              : "Enter ขึ้นบรรทัดใหม่ · ส่งที่ปุ่ม — ถาม diagnosis / แนบรูปตรวจ…"
          }
        />
        <div className="absolute right-1.5 bottom-2 flex items-center gap-0.5">
          <button
            type="button"
            onClick={() => setMobileComposerOpen(true)}
            disabled={loading}
            className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-slate-600 bg-slate-900/80 text-slate-200 disabled:opacity-50"
            title="เปิดเครื่องมือเพิ่มเติม"
            aria-label="เปิดเครื่องมือเพิ่มเติม"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M12 5v.01M12 12v.01M12 19v.01" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <button
            type="button"
            onClick={() => imageInputRef.current?.click()}
            disabled={loading}
            className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-slate-600 bg-slate-900/80 text-slate-200 disabled:opacity-50"
            title="เลือกรูปจากเครื่อง"
            aria-label="เลือกรูปจากเครื่อง"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <path d="M16 3h5v5" />
              <path d="m21 3-9 9" />
            </svg>
          </button>
          <button
            type="button"
            onClick={() => void sendMessage()}
            disabled={loading || isChatSendLocked || (!input.trim() && !pendingImages.length) || !sessionAuthed}
            className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-cyan-600 text-white hover:bg-cyan-500 disabled:opacity-50"
            title={loading ? "กำลังตอบ..." : "ส่ง"}
            aria-label={loading ? "กำลังตอบ..." : "ส่ง"}
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M22 2 11 13" />
              <path d="m22 2-7 20-4-9-9-4 20-7Z" />
            </svg>
          </button>
        </div>
      </div>
    </>
  );

  return (
    <main className="min-h-[100dvh] overflow-y-auto bg-[#081120] text-slate-100 md:h-[100dvh] md:min-h-0 md:overflow-hidden">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-2 px-2 py-2 md:h-full md:min-h-0 md:grid md:grid-cols-[220px_minmax(0,1fr)] md:gap-3 md:px-4 md:py-3">
        {sessionStatus === "unauthenticated" ? (
          <div className="rounded-xl border border-amber-600/50 bg-amber-950/40 px-3 py-2.5 text-sm leading-relaxed text-amber-100 md:col-span-2">
            แชทผู้เชี่ยวชาญต้องเข้าสู่ระบบก่อน — ระบบจึงจะบันทึกการใช้งาน โควตา และ feedback ต่อบัญชีได้ถูกต้อง{" "}
            <Link
              href="/login?callbackUrl=%2Fchat"
              className="font-medium text-cyan-300 underline underline-offset-2 hover:text-cyan-200"
            >
              เข้าสู่ระบบ
            </Link>
            {" · "}
            <Link
              href="/signup?callbackUrl=%2Fchat"
              className="font-medium text-cyan-300 underline underline-offset-2 hover:text-cyan-200"
            >
              สมัครสมาชิก
            </Link>
          </div>
        ) : null}
        {sessionStatus === "loading" ? (
          <div className="rounded-lg border border-slate-700/80 bg-slate-900/50 px-3 py-2 text-xs text-slate-400 md:col-span-2">
            กำลังตรวจสอบการเข้าสู่ระบบ…
          </div>
        ) : null}
        {limitedTrialExpired ? (
          <div className="rounded-xl border border-amber-600/50 bg-amber-950/40 px-3 py-2.5 text-sm leading-relaxed text-amber-100 md:col-span-2">
            Trial หมดอายุแล้ว: ใช้งานแบบจำกัดชั่วคราว ({trialPolicy.chatScope === "icd10_only" ? "ICD-10 only" : "ICD-10 + guidance"})
            {" · "}
            <Link href="/pricing" className="font-medium text-cyan-300 underline underline-offset-2 hover:text-cyan-200">
              อัปเกรดแพ็กเกจ
            </Link>
          </div>
        ) : null}
        <div className="flex items-center gap-2 md:hidden">
          <button
            type="button"
            onClick={() => {
              const t = newThread();
              setThreads((prev) => [t, ...prev]);
              setActiveId(t.id);
              setComposerHint("");
              setShowMobileThreads(false);
            }}
            className="flex-1 rounded-xl bg-cyan-600 px-3 py-2 text-sm font-medium hover:bg-cyan-500"
          >
            + แชทใหม่
          </button>
          <button
            type="button"
            onClick={() => setShowMobileThreads((prev) => !prev)}
            className="rounded-xl border border-slate-600 bg-slate-900/80 px-3 py-2 text-sm text-slate-200"
          >
            {showMobileThreads ? "ซ่อนรายการแชท" : "รายการแชท"}
          </button>
        </div>
        {showMobileThreads ? (
          <aside className="max-h-[36dvh] overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] p-3 md:hidden">
            <div className="max-h-[30dvh] space-y-1 overflow-y-auto pr-1">
              {threads.map((t) => (
                <div
                  key={t.id}
                  className={`flex items-center gap-1 rounded-lg pr-1 ${
                    t.id === activeId ? "bg-cyan-500/20" : "hover:bg-white/5"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => {
                      setActiveId(t.id);
                      setComposerHint("");
                      setShowMobileThreads(false);
                    }}
                    className={`flex-1 rounded-lg px-3 py-2 text-left text-sm ${
                      t.id === activeId ? "text-cyan-100" : "text-slate-300"
                    }`}
                  >
                    {t.title}
                  </button>
                  <button
                    type="button"
                    onClick={() => removeThread(t.id)}
                    className="rounded-md border border-slate-700 px-2 py-1 text-[11px] text-slate-400 hover:bg-slate-800 hover:text-rose-300"
                    title="ลบแชตนี้"
                  >
                    ลบ
                  </button>
                </div>
              ))}
            </div>
          </aside>
        ) : null}
        <aside className="hidden h-full overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] p-3 md:block">
          <button
            type="button"
            onClick={() => {
              const t = newThread();
              setThreads((prev) => [t, ...prev]);
              setActiveId(t.id);
              setComposerHint("");
            }}
            className="w-full rounded-xl bg-cyan-600 px-3 py-2 text-sm font-medium hover:bg-cyan-500"
          >
            + แชทใหม่
          </button>
          <div className="mt-3 max-h-[calc(100vh-140px)] space-y-1 overflow-y-auto pr-1">
            {threads.map((t) => (
              <div
                key={t.id}
                className={`flex items-center gap-1 rounded-lg pr-1 ${
                  t.id === activeId ? "bg-cyan-500/20" : "hover:bg-white/5"
                }`}
              >
                <button
                  type="button"
                  onClick={() => {
                    setActiveId(t.id);
                    setComposerHint("");
                  }}
                  className={`flex-1 rounded-lg px-3 py-2 text-left text-sm ${
                    t.id === activeId ? "text-cyan-100" : "text-slate-300"
                  }`}
                >
                  {t.title}
                </button>
                <button
                  type="button"
                  onClick={() => removeThread(t.id)}
                  className="rounded-md border border-slate-700 px-2 py-1 text-[11px] text-slate-400 hover:bg-slate-800 hover:text-rose-300"
                  title="ลบแชตนี้"
                >
                  ลบ
                </button>
              </div>
            ))}
          </div>
        </aside>

        <section className="relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-white/10 bg-white/[0.03] p-2 max-sm:overflow-visible sm:rounded-2xl sm:p-3 md:h-full md:overflow-hidden">
          <div className="shrink-0">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-cyan-500/20 text-sm text-cyan-200 sm:h-9 sm:w-9">
                AI
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <h1 className="truncate text-base font-semibold sm:text-xl">
                    {assistantMode === "opd_demo" ? "OPD Assistant Demo" : "แชทปรึกษาสรุปชาร์จ"}
                  </h1>
                  <span className="hidden rounded-full border border-slate-700 bg-slate-900/70 px-2 py-0.5 text-[10px] text-cyan-200 sm:inline-block">
                    {assistantModeLabel}
                  </span>
                </div>
                <p className="hidden text-[11px] text-cyan-300 sm:block">{assistantModeHint}</p>
                <p className="text-[11px] text-slate-500 sm:hidden">{assistantModeHint}</p>
              </div>
              <button
                type="button"
                onClick={() => setShowMobileTools((prev) => !prev)}
                className="ml-auto rounded-full border border-slate-700 bg-slate-900/70 px-3 py-1 text-xs text-slate-200"
              >
                {showMobileTools ? "ซ่อนตั้งค่า" : "ตั้งค่า"}
              </button>
            </div>
            <div className="mt-2 flex items-center gap-2">
              <div className="inline-flex overflow-hidden rounded-xl border border-slate-700 bg-slate-900/70 p-0.5 text-xs">
                <button
                  type="button"
                  onClick={() => setAssistantMode("coding")}
                  className={`rounded-lg px-3 py-1.5 transition ${
                    assistantMode === "coding" ? "bg-cyan-500/25 text-cyan-100" : "text-slate-300 hover:bg-slate-800"
                  }`}
                >
                  Coding
                </button>
                <button
                  type="button"
                  onClick={() => setAssistantMode("opd_demo")}
                  disabled={limitedTrialExpired && !trialPolicy.allowOpdDemo}
                  className={`rounded-lg px-3 py-1.5 transition disabled:cursor-not-allowed disabled:opacity-50 ${
                    assistantMode === "opd_demo"
                      ? "bg-violet-500/25 text-violet-100"
                      : "text-slate-300 hover:bg-slate-800"
                  }`}
                >
                  OPD
                </button>
              </div>
              <span className="text-[11px] text-slate-500">
                {assistantMode === "opd_demo" ? "โหมด OPD เน้นแนวทางคลินิก" : "โหมด Coding เน้นรหัสและสรุปชาร์จ"}
              </span>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
              <span className="text-slate-400">
                {assistantModeLabel} · {mode === "fast" ? "Fast" : "Precise"} · รุ่น:{" "}
                {lastModelUsed || `≈ ${expectedChatModel}`}
              </span>
              {loading ? (
                <span className="inline-flex items-center gap-1 rounded-full border border-cyan-500/30 bg-cyan-500/10 px-2 py-0.5 text-[11px] text-cyan-200">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-cyan-300" />
                  Streaming...
                </span>
              ) : null}
            </div>
            <div className={`mt-2 ${showMobileTools ? "flex" : "hidden"} flex-wrap items-center gap-2 text-xs`}>
              <button
                type="button"
                onClick={() => setMode("fast")}
                className={`rounded-full px-3 py-1 ${mode === "fast" ? "bg-cyan-500/25 text-cyan-100" : "bg-slate-800 text-slate-300"}`}
              >
                Fast
              </button>
              <button
                type="button"
                onClick={() => setMode("precise")}
                className={`rounded-full px-3 py-1 ${mode === "precise" ? "bg-cyan-500/25 text-cyan-100" : "bg-slate-800 text-slate-300"}`}
              >
                Precise
              </button>
              <span className="text-slate-500">
                {mode === "fast"
                  ? "ตอบเร็ว/คุ้มโควต้า (เหมาะใช้ต่อเนื่อง)"
                  : "ฉลาดและละเอียดขึ้น แต่ใช้โควต้ามากกว่า"}
              </span>
            </div>
            <div
              className={`mt-2 ${showMobileTools ? "flex" : "hidden"} flex-wrap items-center gap-2 text-[11px] text-slate-300`}
            >
              <span className="text-slate-500">สไตล์ตอบ:</span>
              <select
                value={chatStyle.responseLength}
                onChange={(e) =>
                  setChatStyle((prev) => ({
                    ...prev,
                    responseLength: e.target.value as ChatStyleProfile["responseLength"],
                  }))
                }
                className="rounded-md border border-slate-700 bg-slate-900/70 px-2 py-1"
              >
                <option value="short">สั้น</option>
                <option value="balanced">สมดุล</option>
                <option value="detailed">ละเอียด</option>
              </select>
              <select
                value={chatStyle.outputFormat}
                onChange={(e) =>
                  setChatStyle((prev) => ({
                    ...prev,
                    outputFormat: e.target.value as ChatStyleProfile["outputFormat"],
                  }))
                }
                className="rounded-md border border-slate-700 bg-slate-900/70 px-2 py-1"
              >
                <option value="auto">อัตโนมัติ</option>
                <option value="bullet">หัวข้อ bullet</option>
                <option value="paragraph">ย่อหน้า</option>
              </select>
              <select
                value={chatStyle.tone}
                onChange={(e) =>
                  setChatStyle((prev) => ({
                    ...prev,
                    tone: e.target.value as ChatStyleProfile["tone"],
                  }))
                }
                className="rounded-md border border-slate-700 bg-slate-900/70 px-2 py-1"
              >
                <option value="neutral">โทนกลาง</option>
                <option value="formal">ทางการ</option>
                <option value="friendly">กันเอง</option>
              </select>
              <span className="text-slate-500">ระบบจะจำรายผู้ใช้ให้อัตโนมัติ</span>
            </div>
            <p className={`${showMobileTools ? "block" : "hidden"} mt-1 text-xs text-slate-400`}>
              {assistantMode === "opd_demo"
                ? "โหมด OPD รวม: ซักประวัติ/ตรวจร่างกาย/DDx/แผนรักษา + RDU โดยต้องเช็กข้อบ่งชี้ยาฆ่าเชื้อ และชื่อโรคให้ใส่ (ICD-10: ...)"
                : "ถามโรค/แนวทางลง diagnosis และการบันทึกสรุป โดยอิงชุดความรู้ในระบบและอ้างอิงเอกสารมาตรฐานเป็น [R#] (ไม่ใช่คำแนะทางการรักษาแทนแพทย์)"}
            </p>
            <p className={`${showMobileTools ? "block" : "hidden"} mt-1 text-[11px] text-slate-500`}>
              ทั้งสองโหมดคุยได้ทุกเรื่องในแชทเดียวกัน ต่างกันที่โครงคำตอบเริ่มต้น
            </p>
            <div
              className={`mt-2 ${showMobileTools ? "flex" : "hidden"} flex-wrap items-center gap-2 text-[11px] text-slate-300`}
            >
              <span className="text-slate-500">ลัดไปหน้าอื่น:</span>
              <a href="/app" className="rounded-full border border-slate-700 px-2 py-0.5 hover:border-cyan-500/50 hover:text-cyan-200">
                สรุปชาร์จ
              </a>
              <a href="/pricing" className="rounded-full border border-slate-700 px-2 py-0.5 hover:border-cyan-500/50 hover:text-cyan-200">
                ราคา/แพ็กเกจ
              </a>
              <a href="/guidelines" className="rounded-full border border-slate-700 px-2 py-0.5 hover:border-cyan-500/50 hover:text-cyan-200">
                แนวทางใช้งาน
              </a>
            </div>
            {assistantMode === "coding" ? (
              <p className={`${showMobileTools ? "block" : "hidden"} mt-1 text-xs text-slate-500`}>
                [R#] คือเลขเอกสารอ้างอิง เช่น [R2] = เอกสารลำดับที่ 2 ในชุดมาตรฐานของระบบ
                </p>
            ) : null}
          </div>
          <div
            ref={messagesRef}
            onScroll={(e) => {
              const el = e.currentTarget;
              const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 72;
              setStickToBottom(nearBottom);
            }}
            className="mt-2 min-h-0 flex-1 overflow-y-auto rounded-lg border border-slate-700/60 bg-slate-950/40 p-2 pb-40 sm:mt-3 sm:rounded-xl sm:p-3 sm:pb-28 md:flex-1"
          >
            {active?.messages.length ? (
              <div className="space-y-3">
                {active.messages.map((m, idx) => (
                  <div key={`${m.role}-${idx}`}>
                    <div className={`flex ${m.role === "user" ? "justify-end" : "justify-start"} gap-2`}>
                      {m.role === "user" ? (
                        <div className="flex max-w-[min(92%,30rem)] flex-row-reverse items-start gap-0.5 sm:gap-1">
                          <div className="min-w-0 flex-1 rounded-2xl bg-cyan-700/35 px-3 py-2 text-[15px] leading-relaxed whitespace-pre-wrap text-cyan-100 sm:text-sm">
                            {m.images && m.images.length > 0 ? (
                              <div className="mb-2 flex flex-wrap gap-1.5">
                                {m.images.map((img) => (
                                  <img
                                    key={img.id}
                                    src={img.dataUrl}
                                    alt={img.name}
                                    className="h-14 w-14 rounded-lg object-cover ring-1 ring-cyan-900/50 sm:h-16 sm:w-16"
                                  />
                                ))}
                              </div>
                            ) : null}
                            <ChatMessageBody content={m.content} />
                          </div>
                          <button
                            type="button"
                            onClick={() => editAndResendFrom(idx)}
                            disabled={loading}
                            title="แก้ไขแล้วส่งใหม่"
                            aria-label="แก้ไขแล้วส่งใหม่"
                            className="mt-1 shrink-0 rounded-lg p-1.5 text-white/45 transition hover:bg-white/15 hover:text-white active:bg-white/20 disabled:pointer-events-none disabled:opacity-30"
                          >
                            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M12 20h9M16.5 3.5a2.12 2.12 0 0 1 3 3L8 18l-4 1 1-4 11.5-11.5"
                              />
                            </svg>
                          </button>
                        </div>
                      ) : (
                        <>
                          <div className="w-full px-1 py-0.5 text-[15px] leading-relaxed whitespace-pre-wrap text-slate-100 sm:text-sm md:max-w-[94%]">
                            <ChatMessageBody content={m.content} />
                          </div>
                          <details className="mt-0.5 w-full max-w-[94%] rounded-md border border-slate-800/60 bg-slate-950/25 px-2 py-0.5 text-[10px] text-slate-500 open:bg-slate-950/40">
                            <summary className="cursor-pointer list-none text-slate-500 marker:content-none hover:text-slate-400 [&::-webkit-details-marker]:hidden">
                              ที่มาคำตอบ
                            </summary>
                            <p className="mt-1 leading-snug text-slate-500">
                              {m.answerSource === "mixed"
                                ? "องค์ความรู้ภายใน + แหล่งอ้างอิงภายนอก (โดเมนที่อนุญาต)"
                                : m.answerSource === "external"
                                ? "อ้างอิงภายนอกเป็นหลัก"
                                : "องค์ความรู้ภายใน / reasoning"}
                            </p>
                          </details>
                        </>
                      )}
                    </div>
                    {m.role === "assistant" ? (
                      <div className="mt-1 flex items-center gap-2 text-[11px] text-slate-500">
                        <span>คำตอบนี้ช่วยไหม?</span>
                        {(() => {
                          const rated = ratedByMessage[`${active.id}-${idx}`];
                          const selectedHelpful = rated?.score === "helpful";
                          const selectedNotHelpful = rated?.score === "not_helpful" && !rated?.reason;
                          const selectedInsufficient = rated?.score === "not_helpful" && rated?.reason === "insufficient_evidence";
                          const selectedLegacy = rated?.score === "not_helpful" && rated?.reason === "legacy_term";
                          const selectedSpecific = rated?.score === "not_helpful" && rated?.reason === "not_specific";
                          return (
                            <>
                        <button
                          type="button"
                          onClick={() => void rateAssistantMessage(active.id, idx, "helpful")}
                          disabled={ratingBusyId !== ""}
                          className={`rounded border px-2 py-0.5 disabled:opacity-50 ${
                            selectedHelpful
                              ? "border-emerald-500 bg-emerald-900/40 text-emerald-200"
                              : "border-slate-700 hover:bg-slate-800"
                          }`}
                        >
                          👍 ช่วย
                        </button>
                        <button
                          type="button"
                          onClick={() => void rateAssistantMessage(active.id, idx, "not_helpful")}
                          disabled={ratingBusyId !== ""}
                          className={`rounded border px-2 py-0.5 disabled:opacity-50 ${
                            selectedNotHelpful
                              ? "border-rose-500 bg-rose-900/40 text-rose-200"
                              : "border-slate-700 hover:bg-slate-800"
                          }`}
                        >
                          👎 ไม่ตรง
                        </button>
                        <button
                          type="button"
                          onClick={() => void rateAssistantMessage(active.id, idx, "not_helpful", "insufficient_evidence")}
                          disabled={ratingBusyId !== ""}
                          className={`hidden rounded border px-2 py-0.5 disabled:opacity-50 sm:inline-block ${
                            selectedInsufficient
                              ? "border-rose-500 bg-rose-900/40 text-rose-200"
                              : "border-slate-700 hover:bg-slate-800"
                          }`}
                        >
                          หลักฐานไม่พอ
                        </button>
                        <button
                          type="button"
                          onClick={() => void rateAssistantMessage(active.id, idx, "not_helpful", "legacy_term")}
                          disabled={ratingBusyId !== ""}
                          className={`hidden rounded border px-2 py-0.5 disabled:opacity-50 sm:inline-block ${
                            selectedLegacy
                              ? "border-rose-500 bg-rose-900/40 text-rose-200"
                              : "border-slate-700 hover:bg-slate-800"
                          }`}
                        >
                          คำวินิจฉัยเก่า
                        </button>
                        <button
                          type="button"
                          onClick={() => void rateAssistantMessage(active.id, idx, "not_helpful", "not_specific")}
                          disabled={ratingBusyId !== ""}
                          className={`hidden rounded border px-2 py-0.5 disabled:opacity-50 sm:inline-block ${
                            selectedSpecific
                              ? "border-rose-500 bg-rose-900/40 text-rose-200"
                              : "border-slate-700 hover:bg-slate-800"
                          }`}
                        >
                          ไม่จำเพาะพอ
                        </button>
                        {rated ? <span className="text-emerald-300">บันทึกแล้ว ✓</span> : null}
                            </>
                          );
                        })()}
                      </div>
                    ) : null}
                  </div>
                ))}
                {loading ? (
                  <div>
                    <div className="mr-8 flex items-center gap-2 px-1 py-1 text-sm text-slate-100">
                      <span className="inline-flex gap-1">
                        <span className="h-2 w-2 animate-bounce rounded-full bg-cyan-300 [animation-delay:-0.3s]" />
                        <span className="h-2 w-2 animate-bounce rounded-full bg-cyan-300 [animation-delay:-0.15s]" />
                        <span className="h-2 w-2 animate-bounce rounded-full bg-cyan-300" />
                      </span>
                      <span>{mode === "fast" ? "AI กำลังคิดและสรุปคำตอบ..." : "AI กำลังคิด · ค้นหลักฐาน · สรุปคำตอบ..."}</span>
                    </div>
                  </div>
                ) : null}
              </div>
            ) : (
              <div className="flex min-h-[min(50dvh,320px)] flex-col items-center justify-center gap-2 px-4 py-10 text-center">
                <p className="text-base font-medium text-slate-200 sm:text-lg">มีอะไรให้ช่วยวันนี้?</p>
                <p className="max-w-md text-sm leading-relaxed text-slate-500">
                  พิมพ์เคสหรือคำถาม — หรือแนบรูป EKG / X-ray แล้วกดส่งได้เลย (ช่วยอ่านเบื้องต้น ไม่ทดแทน formal read)
                </p>
              </div>
            )}
          </div>
          {!stickToBottom ? (
            <div className="mt-2 flex justify-center">
              <button
                type="button"
                onClick={() => {
                  const el = messagesRef.current;
                  if (!el) return;
                  el.scrollTop = el.scrollHeight;
                  setStickToBottom(true);
                }}
                className="rounded-full border border-cyan-500/40 bg-cyan-500/10 px-3 py-1 text-xs text-cyan-200 hover:bg-cyan-500/20"
              >
                เลื่อนไปล่าสุด
              </button>
            </div>
          ) : null}
          <input
            ref={imageInputRef}
            type="file"
            accept="image/*"
            multiple
            onChange={(e) => onPickImages(e.target.files)}
            className="hidden"
          />
          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={(e) => onPickImages(e.target.files)}
            className="hidden"
          />
          <div className="mt-2 hidden shrink-0 border-t border-white/10 bg-[#081120]/95 pt-2 pb-3 backdrop-blur sm:block">
            {renderComposerInner(textareaRef)}
          </div>
          <div className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-[#081120]/95 px-2 pt-2 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-[0_-10px_30px_rgba(8,17,32,0.35)] backdrop-blur sm:hidden">
            {renderMobileQuickComposer()}
          </div>
          <div>
            {mobileComposerOpen ? (
              <>
                <div
                  ref={composerPopupRef}
                  className="absolute inset-x-2 bottom-2 z-[70] max-h-[78dvh] overflow-y-auto rounded-2xl border border-white/10 bg-[#0a1424] p-3 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-[0_-12px_48px_rgba(0,0,0,0.45)]"
                  role="dialog"
                  aria-labelledby="mobile-chat-composer-title"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="mb-3 text-sm font-semibold text-slate-100" id="mobile-chat-composer-title">
                    พิมพ์ข้อความ
                  </div>
                  {renderComposerInner(sheetTextareaRef)}
                </div>
              </>
            ) : (
              <button
                ref={composerTriggerRef}
                type="button"
                onClick={() => setMobileComposerOpen(true)}
                className="hidden fixed left-3 right-3 z-50 mx-auto max-w-lg items-center gap-2 rounded-2xl border border-white/15 bg-[#0c1624]/95 py-3 pl-4 pr-3 text-left shadow-xl shadow-black/40 backdrop-blur-md bottom-[max(0.75rem,env(safe-area-inset-bottom))] sm:left-1/2 sm:right-auto sm:w-[min(920px,calc(100%-2rem))] sm:max-w-none sm:-translate-x-1/2"
                aria-haspopup="dialog"
              >
                <span className="min-w-0 flex-1 truncate text-sm text-slate-300">
                  {input.trim()
                    ? input.trim().slice(0, 160) + (input.trim().length > 160 ? "…" : "")
                    : "แตะเพื่อพิมพ์ — แนบรูปหรือใช้ไมค์"}
                </span>
                {pendingImages.length > 0 ? (
                  <span className="shrink-0 rounded-full bg-cyan-500/25 px-2 py-0.5 text-xs font-medium text-cyan-100">
                    {pendingImages.length} ภาพ
                  </span>
                ) : null}
                <svg
                  className="h-5 w-5 shrink-0 text-cyan-400/90"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  aria-hidden
                >
                  <path d="m18 15-6-6-6 6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}

