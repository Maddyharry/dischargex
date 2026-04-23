"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
  answerSource?: "internal" | "mixed" | "external";
};
type TokenUsageMeta = {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  estimatedCostThb: number;
};
type Thread = { id: string; title: string; messages: ChatMessage[] };
type ChatMode = "fast" | "precise";
type AssistantMode = "coding" | "opd_demo";
type StreamDonePayload = {
  answerSource?: "internal" | "mixed" | "external";
  usage?: TokenUsageMeta;
  variant?: string;
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
const CHAT_STORAGE_KEY = "dischargex_chat_threads_v1";
const CHAT_MODE_KEY = "dischargex_chat_mode_v1";
const ASSISTANT_MODE_KEY = "dischargex_assistant_mode_v1";
const DEFAULT_CHAT_STYLE_PROFILE: ChatStyleProfile = {
  responseLength: "balanced",
  outputFormat: "auto",
  tone: "neutral",
};

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

function isSummaryCommandText(text: string) {
  return /ช่วยสรุปเป็นเฉพาะกลุ่ม diagnosis|ช่วยสรุปเคสแบบ opd ไทย|ช่วยสรุปแบบ soap/i.test(text);
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
            return (
              <a
                key={`${chunk}-${urlIdx}`}
                href={chunk}
                target="_blank"
                rel="noreferrer"
                className="underline decoration-cyan-400/70 underline-offset-2 hover:text-cyan-200"
              >
                {chunk}
              </a>
            );
          }
          return <span key={`${chunk}-${urlIdx}`}>{chunk}</span>;
        })}
      </span>
    );
  });
}

function ChatMessageBody({ content }: { content: string }) {
  const codeSplit = content.split("```");
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
  const [storageReady, setStorageReady] = useState(false);
  const [composerHint, setComposerHint] = useState("");
  const [canRetryStream, setCanRetryStream] = useState(false);
  const [isStopping, setIsStopping] = useState(false);
  const [showPromptSuggestions, setShowPromptSuggestions] = useState(false);
  const [showMobileTools, setShowMobileTools] = useState(false);
  const [isMicSupported, setIsMicSupported] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [pendingImages, setPendingImages] = useState<UploadedImage[]>([]);
  const [showMobileThreads, setShowMobileThreads] = useState(false);
  const [cloudSyncReady, setCloudSyncReady] = useState(false);
  const [chatStyle, setChatStyle] = useState<ChatStyleProfile>(DEFAULT_CHAT_STYLE_PROFILE);
  const [chatStyleReady, setChatStyleReady] = useState(false);
  const messagesRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const pendingStreamRef = useRef<PendingStreamRequest | null>(null);
  const speechRef = useRef<InstanceType<SpeechRecognitionCtor> | null>(null);
  const threadsRef = useRef<Thread[]>(threads);
  const activeIdRef = useRef<string>(activeId);
  const cloudInitRef = useRef(false);

  const active = useMemo(
    () => threads.find((t) => t.id === activeId) ?? threads[0],
    [threads, activeId]
  );

  useEffect(() => {
    const el = messagesRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [active?.messages, loading, activeId]);

  useEffect(() => {
    threadsRef.current = threads;
    activeIdRef.current = activeId;
  }, [threads, activeId]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(CHAT_STORAGE_KEY);
      const savedMode = localStorage.getItem(CHAT_MODE_KEY);
      const savedAssistantMode = localStorage.getItem(ASSISTANT_MODE_KEY);
      if (savedMode === "fast" || savedMode === "precise") setMode(savedMode);
      if (savedAssistantMode === "coding" || savedAssistantMode === "opd_demo") {
        setAssistantMode(savedAssistantMode);
      } else if (savedAssistantMode === "opd_rdu") {
        setAssistantMode("opd_demo");
      }
      if (!raw) return;
      const parsed = JSON.parse(raw) as { threads?: Thread[]; activeId?: string };
      if (Array.isArray(parsed.threads) && parsed.threads.length > 0) {
        setThreads(parsed.threads);
        const nextActive = parsed.activeId && parsed.threads.some((t) => t.id === parsed.activeId)
          ? parsed.activeId
          : parsed.threads[0].id;
        setActiveId(nextActive);
      }
    } catch {
      // ignore corrupt local storage
    } finally {
      setStorageReady(true);
    }
  }, []);

  useEffect(() => {
    if (!storageReady) return;
    localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify({ threads, activeId }));
  }, [threads, activeId, storageReady]);

  useEffect(() => {
    if (!storageReady) return;
    localStorage.setItem(CHAT_MODE_KEY, mode);
  }, [mode, storageReady]);

  useEffect(() => {
    if (!storageReady) return;
    localStorage.setItem(ASSISTANT_MODE_KEY, assistantMode);
  }, [assistantMode, storageReady]);

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
    rec.onend = () => setIsListening(false);
    rec.onerror = (event) => {
      setIsListening(false);
      const errorKey = event?.error || "unknown";
      if (errorKey === "not-allowed") {
        setComposerHint("ไมค์ถูกปฏิเสธสิทธิ์ กรุณาอนุญาตไมโครโฟนในเบราว์เซอร์");
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
      speechRef.current?.stop();
      speechRef.current = null;
    };
  }, []);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    const nextHeight = Math.min(el.scrollHeight, 180);
    el.style.height = `${Math.max(56, nextHeight)}px`;
  }, [input]);

  useEffect(() => {
    if (!storageReady) return;
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
  }, [storageReady]);

  useEffect(() => {
    if (!cloudSyncReady) return;
    const timer = setTimeout(() => {
      void fetch("/api/chat-threads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ threads, activeId }),
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
      };
      const reply = data.ok && data.reply ? data.reply : data.error || "ขออภัยครับ ตอบกลับไม่สำเร็จ";
      setAssistantError(threadId, reply);
      finalizeAssistantMessage(threadId, { answerSource: data.answerSource });
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
        const payload = JSON.parse(payloadRaw) as {
          type?: "delta" | "done" | "error";
          delta?: string;
          message?: string;
          answerSource?: "internal" | "mixed" | "external";
          usage?: TokenUsageMeta;
          variant?: string;
        };
        if (payload.type === "delta") {
          appendAssistantChunk(threadId, payload.delta || "");
        } else if (payload.type === "done") {
          finalizeAssistantMessage(threadId, payload);
          status = "done";
          streamDone = true;
        } else if (payload.type === "error") {
          setAssistantError(threadId, payload.message || "เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง");
          status = "error";
          streamDone = true;
        }
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
        setComposerHint("สตรีมหลุดหรือตอบไม่ครบ กด Retry stream เพื่อต่อคำตอบ");
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
    const text = input.trim();
    if (!text) return;
    const attachments = [...pendingImages];
    setInput("");
    setPendingImages([]);
    if (composerHint.startsWith("แนบรูปแล้ว")) {
      setComposerHint("");
    }
    await sendPreparedMessage(text, attachments);
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
    historyOverride?: ChatHistoryPayload[]
  ) {
    if (!text || !active || loading) return;

    const attachmentLine = attachments?.length ? `\n[แนบรูป ${attachments.length} ภาพ]` : "";
    const userMsg: ChatMessage = { role: "user", content: `${text}${attachmentLine}` };
    setThreads((prev) =>
      prev.map((t) =>
        t.id === active.id
          ? {
              ...t,
              title: t.messages.length === 0 ? text.slice(0, 40) : t.title,
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
    const basePrompt = buildSummaryPrompt(kind);
    const threadMessages = active?.messages || [];
    const caseContextLines = threadMessages
      .filter((m) => !isSummaryCommandText(m.content))
      .map((m) => `${m.role === "user" ? "ผู้ใช้" : "ผู้ช่วย"}: ${m.content}`)
      .slice(-120);
    const fullThreadContext = caseContextLines.join("\n").slice(-14000);
    const prompt = fullThreadContext
      ? `${basePrompt}\n\nข้อมูลเคสจากบทสนทนาทั้งหมดในแชทนี้ (ใช้เป็นบริบทหลัก):\n${fullThreadContext}`
      : basePrompt;
    const summaryHistory = threadMessages.slice(-200).map((m) => ({ role: m.role, content: m.content }));
    setComposerHint(
      kind === "diagnosis"
        ? "กำลังสรุป diagnosis..."
        : kind === "opd_case"
        ? "กำลังสรุปเคส OPD..."
        : "กำลังสรุป SOAP..."
    );
    await sendPreparedMessage(prompt, undefined, summaryHistory);
  }

  async function regenerateLastAnswer() {
    if (!active || loading) return;
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
    if (!isMicSupported) {
      setComposerHint("เบราว์เซอร์นี้ยังไม่รองรับ SpeechRecognition");
      return;
    }
    const rec = speechRef.current;
    if (!rec) return;
    if (isListening) {
      rec.stop();
      setComposerHint("หยุดฟังเสียงแล้ว");
    } else {
      try {
        if (typeof navigator !== "undefined" && navigator.mediaDevices?.getUserMedia) {
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          stream.getTracks().forEach((track) => track.stop());
        }
      } catch {
        setComposerHint("ไม่ได้รับสิทธิ์ไมโครโฟน กรุณาอนุญาตไมค์ใน Chrome แล้วลองใหม่");
        return;
      }
      try {
        rec.start();
      } catch {
        setComposerHint("เปิดไมค์ไม่สำเร็จ กรุณาลองใหม่อีกครั้ง");
      }
    }
  }

  function editAndResendFrom(index: number) {
    if (!active) return;
    const message = active.messages[index];
    if (!message || message.role !== "user") return;
    setInput(message.content);
    setComposerHint("แก้ข้อความแล้วกดส่งเพื่อถามใหม่");
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

  return (
    <main className="min-h-[calc(100dvh-3.5rem)] overflow-y-auto bg-[#081120] text-slate-100 md:h-[calc(100dvh-3.5rem)] md:overflow-hidden">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-3 px-2 py-3 md:h-full md:grid md:grid-cols-[170px_minmax(0,1fr)] md:px-4">
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

        <section className="flex min-h-0 flex-1 flex-col rounded-2xl border border-white/10 bg-white/[0.03] p-3 md:h-full">
          <div className="shrink-0">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-cyan-500/20 text-cyan-200">AI</div>
              <div>
                <h1 className="text-xl font-semibold">
                  {assistantMode === "opd_demo" ? "OPD Assistant Demo" : "แชทปรึกษาสรุปชาร์จ"}
                </h1>
                <p className="text-[11px] text-cyan-300">
                  {assistantMode === "opd_demo"
                    ? "ซักประวัติ · ตรวจร่างกาย · DDx · RDU/ICD-10"
                    : "Medical coding assistant · evidence-first"}
                </p>
              </div>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs sm:hidden">
              <button
                type="button"
                onClick={() => setAssistantMode("coding")}
                className={`rounded-full px-3 py-1 ${assistantMode === "coding" ? "bg-cyan-500/25 text-cyan-100" : "bg-slate-800 text-slate-300"}`}
              >
                Coding
              </button>
              <button
                type="button"
                onClick={() => setAssistantMode("opd_demo")}
                className={`rounded-full px-3 py-1 ${assistantMode === "opd_demo" ? "bg-violet-500/25 text-violet-100" : "bg-slate-800 text-slate-300"}`}
              >
                OPD
              </button>
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
              <button
                type="button"
                onClick={() => setShowMobileTools((prev) => !prev)}
                className="ml-auto rounded-full border border-slate-700 bg-slate-900/70 px-3 py-1 text-slate-200"
              >
                {showMobileTools ? "ซ่อนเครื่องมือ" : "เครื่องมือ"}
              </button>
            </div>
            <div className="mt-2 hidden flex-wrap items-center gap-2 text-xs sm:flex">
              <button
                type="button"
                onClick={() => setAssistantMode("coding")}
                className={`rounded-full px-3 py-1 ${assistantMode === "coding" ? "bg-cyan-500/25 text-cyan-100" : "bg-slate-800 text-slate-300"}`}
              >
                เน้น Coding
              </button>
              <button
                type="button"
                onClick={() => setAssistantMode("opd_demo")}
                className={`rounded-full px-3 py-1 ${assistantMode === "opd_demo" ? "bg-violet-500/25 text-violet-100" : "bg-slate-800 text-slate-300"}`}
              >
                เน้น OPD
              </button>
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
              <span className="text-slate-500">{mode === "fast" ? "ตอบเร็ว กระชับ" : "ละเอียดขึ้น ใช้เวลามากขึ้น"}</span>
              {loading ? (
                <span className="inline-flex items-center gap-1 rounded-full border border-cyan-500/30 bg-cyan-500/10 px-2 py-0.5 text-[11px] text-cyan-200">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-cyan-300" />
                  Streaming...
                </span>
              ) : null}
            </div>
            <div className="mt-2 hidden flex-wrap items-center gap-2 text-[11px] text-slate-300 sm:flex">
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
            <p className="mt-1 text-xs text-slate-400 sm:text-xs">
              {assistantMode === "opd_demo"
                ? "โหมด OPD รวม: ซักประวัติ/ตรวจร่างกาย/DDx/แผนรักษา + RDU โดยต้องเช็กข้อบ่งชี้ยาฆ่าเชื้อ และชื่อโรคให้ใส่ (ICD-10: ...)"
                : "ถามโรค/แนวทางลง diagnosis และการบันทึกสรุป โดยอิงชุดความรู้ในระบบและอ้างอิงเอกสารมาตรฐานเป็น [R#] (ไม่ใช่คำแนะทางการรักษาแทนแพทย์)"}
            </p>
            <p className="mt-1 hidden text-[11px] text-slate-500 sm:block">
              ทั้งสองโหมดคุยได้ทุกเรื่องในแชทเดียวกัน ต่างกันที่โครงคำตอบเริ่มต้น
            </p>
            <div className="mt-2 hidden flex-wrap items-center gap-2 text-[11px] text-slate-300 sm:flex">
              <span className="text-slate-500">ลัดไปหน้าอื่น:</span>
              <a href="/app" className="rounded-full border border-slate-700 px-2 py-0.5 hover:border-cyan-500/50 hover:text-cyan-200">
                Discharge Summary
              </a>
              <a href="/pricing" className="rounded-full border border-slate-700 px-2 py-0.5 hover:border-cyan-500/50 hover:text-cyan-200">
                ราคา/แพ็กเกจ
              </a>
              <a href="/guidelines" className="rounded-full border border-slate-700 px-2 py-0.5 hover:border-cyan-500/50 hover:text-cyan-200">
                แนวทางใช้งาน
              </a>
            </div>
            {assistantMode === "coding" ? (
              <p className="mt-1 text-xs text-slate-500">
                [R#] คือเลขเอกสารอ้างอิง เช่น [R2] = เอกสารลำดับที่ 2 ในชุดมาตรฐานของระบบ
              </p>
            ) : null}
            {showMobileTools ? (
              <div className="mt-2 rounded-xl border border-slate-700/70 bg-slate-950/40 p-2 sm:hidden">
                <button
                  type="button"
                  onClick={() => setShowPromptSuggestions((prev) => !prev)}
                  className="w-full rounded-full border border-slate-700 bg-slate-900/70 px-3 py-1 text-xs text-slate-300"
                >
                  {showPromptSuggestions ? "ซ่อนตัวอย่าง prompt" : "แสดงตัวอย่าง prompt"}
                </button>
              </div>
            ) : null}
          </div>
          <div
            ref={messagesRef}
            className="mt-3 min-h-[320px] max-h-[54dvh] overflow-y-auto rounded-xl border border-slate-700/70 bg-slate-950/50 p-3 md:min-h-0 md:max-h-none md:flex-1"
          >
            {active?.messages.length ? (
              <div className="space-y-3">
                {active.messages.map((m, idx) => (
                  <div key={`${m.role}-${idx}`}>
                    <div className={`flex ${m.role === "user" ? "justify-end" : "justify-start"} gap-2`}>
                      {m.role === "assistant" ? (
                        <div className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-cyan-500/20 text-[11px] text-cyan-200">
                          AI
                        </div>
                      ) : null}
                      <div
                        className={`rounded-2xl px-3 py-2 text-[15px] leading-relaxed whitespace-pre-wrap shadow-sm sm:text-sm ${
                          m.role === "user"
                            ? "max-w-[94%] bg-cyan-700/70 text-white"
                            : "max-w-[94%] border border-white/10 bg-slate-800/90 text-slate-100"
                        }`}
                      >
                        <ChatMessageBody content={m.content} />
                      </div>
                      {m.role === "assistant" ? (
                        <div className="mt-1 hidden text-[10px] text-slate-500 sm:block">
                          source:{" "}
                          {m.answerSource === "mixed"
                            ? "mixed (internal+external)"
                            : m.answerSource === "external"
                            ? "external references"
                            : "internal knowledge"}
                        </div>
                      ) : null}
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
                    {m.role === "user" ? (
                      <div className="mt-1 text-right">
                        <button
                          type="button"
                          onClick={() => editAndResendFrom(idx)}
                          className="rounded border border-slate-700 px-2 py-0.5 text-[11px] text-slate-400 hover:bg-slate-800"
                        >
                          แก้ไขแล้วส่งใหม่
                        </button>
                      </div>
                    ) : null}
                  </div>
                ))}
                {loading ? (
                  <div>
                    <div className="mr-8 flex items-center gap-2 rounded-2xl border border-white/10 bg-slate-800/90 px-3 py-2 text-sm text-slate-100">
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
              <p className="text-sm text-slate-500">เริ่มพิมพ์คำถามได้เลย เช่น เคสนี้ควรลง diagnosis อะไร</p>
            )}
          </div>
          <div className="sticky bottom-0 mt-2 shrink-0 border-t border-white/10 bg-[#081120]/85 pt-2 pb-[env(safe-area-inset-bottom)] backdrop-blur">
            <div>
              {composerHint ? <div className="mb-1 text-[11px] text-cyan-300">{composerHint}</div> : null}
              {pendingImages.length ? (
                <div className="mb-2 flex flex-wrap gap-2">
                  {pendingImages.map((img) => (
                    <span
                      key={img.id}
                      className="inline-flex items-center gap-2 rounded-full border border-slate-600 bg-slate-900/80 px-2 py-1 text-[11px] text-slate-200"
                    >
                      <img
                        src={img.dataUrl}
                        alt={img.name}
                        className="h-6 w-6 rounded object-cover ring-1 ring-slate-600"
                      />
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
              <input
                ref={imageInputRef}
                type="file"
                accept="image/*"
                multiple
                onChange={(e) => onPickImages(e.target.files)}
                className="hidden"
              />
              <div className="relative">
                <textarea
                  ref={textareaRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      void sendMessage();
                    }
                  }}
                  rows={2}
                  className="w-full max-h-[180px] min-h-[56px] resize-none overflow-y-auto rounded-xl border border-slate-700 bg-slate-900/80 px-3 py-2.5 pr-28 sm:pr-32 text-sm leading-relaxed outline-none focus:border-cyan-500"
                  placeholder={
                    assistantMode === "opd_demo"
                      ? "เล่าเคส OPD แล้วให้ช่วยจัด flow รวม RDU: ซักประวัติ/ตรวจร่างกาย/DDx(ICD-10)/เกณฑ์ยาฆ่าเชื้อ/สรุปเคส"
                      : "ถามเกี่ยวกับ diagnosis, differential, ต้องตรวจอะไรเพิ่ม..."
                  }
                />
                <div className="absolute right-2 bottom-2 flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => imageInputRef.current?.click()}
                    disabled={loading}
                    className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-slate-600 bg-slate-900/80 text-slate-200 disabled:opacity-50 sm:h-8 sm:w-8"
                    title="แนบรูป"
                    aria-label="แนบรูป"
                  >
                    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                      <path d="M16 3h5v5" />
                      <path d="m21 3-9 9" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    onClick={toggleMic}
                    disabled={!isMicSupported || loading}
                    className={`inline-flex h-7 w-7 items-center justify-center rounded-lg border disabled:opacity-50 sm:h-8 sm:w-8 ${
                      isListening
                        ? "border-rose-500 bg-rose-600/20 text-rose-100"
                        : "border-slate-600 bg-slate-900/80 text-slate-200"
                    }`}
                    title={isListening ? "หยุดไมค์" : "เริ่มไมค์"}
                    aria-label={isListening ? "หยุดไมค์" : "เริ่มไมค์"}
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
                    disabled={loading || !input.trim()}
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
            </div>
            <div className="mt-1 text-[11px] text-slate-500">
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
                  disabled={loading || !active?.messages.length}
                  className="w-full rounded-full border border-sky-700 bg-sky-900/40 px-3 py-1 text-xs text-sky-200 hover:bg-sky-800/50 disabled:opacity-50 sm:w-auto"
                >
                  สรุป diagnosis
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => void sendSummary("opd_case")}
                    disabled={loading || !active?.messages.length}
                    className="w-full rounded-full border border-sky-700 bg-sky-900/40 px-3 py-1 text-xs text-sky-200 hover:bg-sky-800/50 disabled:opacity-50 sm:w-auto"
                  >
                    สรุปเคส OPD
                  </button>
                  <button
                    type="button"
                    onClick={() => void sendSummary("opd_soap")}
                    disabled={loading || !active?.messages.length}
                    className="w-full rounded-full border border-teal-700 bg-teal-900/40 px-3 py-1 text-xs text-teal-200 hover:bg-teal-800/50 disabled:opacity-50 sm:w-auto"
                  >
                    สรุป SOAP
                  </button>
                </>
              )}
              <button
                type="button"
                onClick={() => void regenerateLastAnswer()}
                disabled={loading || !active?.messages.some((m) => m.role === "user")}
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
                disabled={loading || !canRetryStream}
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
                  disabled={loading || !canRetryStream}
                  className="w-full rounded-full border border-indigo-700 bg-indigo-900/40 px-3 py-1 text-xs text-indigo-200 hover:bg-indigo-800/50 disabled:opacity-50 sm:hidden"
                >
                  Retry
                </button>
              ) : null}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

