import type OpenAI from "openai";
import type { ResponseCreateParamsNonStreaming } from "openai/resources/responses/responses";
import { deidentify } from "@/lib/deidentify";
import { readUsageSummary, type TokenUsageSummary } from "@/lib/token-billing";

function extractJsonObject<T>(text: string): T | null {
  const cleaned = text.replace(/```json|```/g, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(cleaned.slice(start, end + 1)) as T;
  } catch {
    return null;
  }
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
  };

  const initialInput = `${safeSystem}\n\n${safeUser}`;
  const maxOutputTokens = options?.max_output_tokens ?? 4000;
  await options?.beforeCall?.({ input: initialInput, maxOutputTokens, purpose: "initial" });
  const response = await openai.responses.create({ ...createParams, max_output_tokens: maxOutputTokens });
  const initialUsage = readUsageSummary("usage" in response ? response.usage : undefined);
  addUsage(initialUsage);
  await options?.onCompletedCall?.(initialUsage, "initial", hasCompleteUsage(response));
  const text = "output_text" in response ? response.output_text || "" : "";
  const parsed = extractJsonObject<T>(text);
  if (parsed) return { data: parsed, usage: usageTotal };

  const repairUser = deidentify("Rewrite your previous answer as STRICT JSON only. No markdown.\n\nPREVIOUS:\n" + text);
  await options?.beforeCall?.({ input: `${safeSystem}\n\n${repairUser}`, maxOutputTokens, purpose: "json_repair" });
  const repair = await openai.responses.create({
    ...createParams,
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
  if (!repaired) throw new Error("Model returned non-JSON");
  return { data: repaired, usage: usageTotal };
}
