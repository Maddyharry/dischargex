import type OpenAI from "openai";
import type { ResponseCreateParamsNonStreaming } from "openai/resources/responses/responses";
import { deidentify } from "@/lib/deidentify";
import { readUsageSummary, type TokenUsageSummary } from "@/lib/token-billing";

function extractJsonObject<T>(text: string): T | null {
  const cleaned = text.replace(/```json|```/g, "").trim();
  if (!cleaned.startsWith("{") || !cleaned.endsWith("}")) return null;
  try {
    return JSON.parse(cleaned) as T;
  } catch {
    return null;
  }
}

function isJsonButNotObject(text: string) {
  const cleaned = text.replace(/```json|```/g, "").trim();
  if (!cleaned) return false;
  try {
    const value = JSON.parse(cleaned) as unknown;
    return value === null || typeof value !== "object" || Array.isArray(value);
  } catch {
    return false;
  }
}

export type SummaryModelErrorCode =
  | "MODEL_EMPTY_OUTPUT"
  | "MODEL_INVALID_JSON"
  | "MODEL_REPAIR_INVALID_JSON"
  | "PROVIDER_TIMEOUT";

export class SummaryModelError extends Error {
  readonly code: SummaryModelErrorCode;

  constructor(code: SummaryModelErrorCode) {
    super(code);
    this.name = "SummaryModelError";
    this.code = code;
  }
}

function isTimeoutError(error: unknown) {
  const value = error as { name?: unknown; code?: unknown; message?: unknown } | null;
  const text = `${String(value?.name || "")} ${String(value?.code || "")} ${String(value?.message || "")}`.toLowerCase();
  return text.includes("timeout") || text.includes("timed out") || text.includes("etimedout");
}

function isJsonModeUnsupported(error: unknown) {
  const value = error as { message?: unknown } | null;
  const text = String(value?.message || "").toLowerCase();
  return text.includes("json_object") || text.includes("response_format") || text.includes("structured output");
}

function hasCompleteUsage(response: unknown): boolean {
  if (!response || typeof response !== "object" || !("usage" in response)) return false;
  const usage = (response as { usage?: unknown }).usage;
  if (!usage || typeof usage !== "object") return false;
  const value = usage as { input_tokens?: unknown; output_tokens?: unknown };
  return typeof value.input_tokens === "number" && Number.isSafeInteger(value.input_tokens) && value.input_tokens >= 0 &&
    typeof value.output_tokens === "number" && Number.isSafeInteger(value.output_tokens) && value.output_tokens >= 0;
}

export type SummaryModelCallOptions = {
  max_output_tokens?: number;
  beforeCall?: (params: { input: string; maxOutputTokens: number; purpose: "initial" | "json_repair" }) => Promise<void>;
  onCompletedCall?: (usage: TokenUsageSummary, purpose: "initial" | "json_repair", usageAvailable: boolean) => Promise<void>;
};

/** Final serialized privacy boundary for summary model calls, including JSON repair. */
export async function callModelJSON<T>(
  openai: OpenAI,
  model: string,
  system: string,
  user: string,
  options?: SummaryModelCallOptions,
) {
  const usageTotal: TokenUsageSummary = { inputTokens: 0, outputTokens: 0, totalTokens: 0 };
  const addUsage = (next: TokenUsageSummary) => {
    usageTotal.inputTokens += next.inputTokens;
    usageTotal.outputTokens += next.outputTokens;
    usageTotal.totalTokens += next.totalTokens;
  };
  const safeSystem = deidentify(system);
  const safeUser = deidentify(user);
  const createParams: ResponseCreateParamsNonStreaming = {
    model,
    store: false,
    stream: false,
    max_output_tokens: options?.max_output_tokens ?? 4000,
    input: [
      { role: "system", content: safeSystem },
      { role: "user", content: safeUser },
    ],
    text: { format: { type: "json_object" } },
  };
  let structuredJsonSupported = true;

  const create = async (params: ResponseCreateParamsNonStreaming) => {
    try {
      return await openai.responses.create(params);
    } catch (error) {
      if (isTimeoutError(error)) throw new SummaryModelError("PROVIDER_TIMEOUT");
      throw error;
    }
  };

  const initialInput = `${safeSystem}\n\n${safeUser}`;
  const maxOutputTokens = options?.max_output_tokens ?? 4000;
  await options?.beforeCall?.({ input: initialInput, maxOutputTokens, purpose: "initial" });
  let response;
  try {
    response = await create({ ...createParams, max_output_tokens: maxOutputTokens });
  } catch (error) {
    // Older/third-party Responses-compatible providers may reject JSON mode. Retry
    // once without the option, still under the caller's budget guard.
    if (error instanceof SummaryModelError || !isJsonModeUnsupported(error)) throw error;
    structuredJsonSupported = false;
    await options?.beforeCall?.({ input: initialInput, maxOutputTokens, purpose: "initial" });
    const { text: _ignored, ...fallbackParams } = createParams;
    response = await create({ ...fallbackParams, max_output_tokens: maxOutputTokens });
  }
  const initialUsage = readUsageSummary("usage" in response ? response.usage : undefined);
  addUsage(initialUsage);
  await options?.onCompletedCall?.(initialUsage, "initial", hasCompleteUsage(response));
  const text = "output_text" in response ? response.output_text || "" : "";
  if (!text.trim()) throw new SummaryModelError("MODEL_EMPTY_OUTPUT");
  if (isJsonButNotObject(text)) throw new SummaryModelError("MODEL_INVALID_JSON");
  const parsed = extractJsonObject<T>(text);
  if (parsed) return { data: parsed, usage: usageTotal };

  const repairUser = deidentify("Rewrite your previous answer as STRICT JSON only. No markdown.\n\nPREVIOUS:\n" + text);
  await options?.beforeCall?.({ input: `${safeSystem}\n\n${repairUser}`, maxOutputTokens, purpose: "json_repair" });
  const { text: _structuredText, ...unstructuredParams } = createParams;
  const repair = await create({
    ...(structuredJsonSupported ? createParams : unstructuredParams),
    max_output_tokens: maxOutputTokens,
    input: [
      { role: "system", content: safeSystem },
      {
        role: "user",
        content: repairUser,
      },
    ],
  });
  const repairUsage = readUsageSummary("usage" in repair ? repair.usage : undefined);
  addUsage(repairUsage);
  await options?.onCompletedCall?.(repairUsage, "json_repair", hasCompleteUsage(repair));
  const repairText = "output_text" in repair ? repair.output_text || "" : "";
  const repaired = extractJsonObject<T>(repairText);
  if (!repaired) throw new SummaryModelError("MODEL_REPAIR_INVALID_JSON");
  return { data: repaired, usage: usageTotal };
}
