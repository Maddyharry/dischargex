import { describe, expect, it, vi } from "vitest";
import OpenAI from "openai";
import { callModelJSON } from "../lib/summary-model";

function fakeOpenAI(responses: Array<unknown> | Error) {
  const create = vi.fn();
  if (responses instanceof Error) create.mockRejectedValue(responses);
  else for (const response of responses) create.mockResolvedValueOnce(response);
  return { responses: { create } } as unknown as OpenAI;
}

const usage = { input_tokens: 10, output_tokens: 5, total_tokens: 15 };

describe("summary model JSON boundary", () => {
  it("requests Responses JSON mode and accepts a strict object", async () => {
    const openai = fakeOpenAI([{ output_text: '{"ok":true}', usage }]);
    const result = await callModelJSON<{ ok: boolean }>(openai, "gpt-test", "system", "user");
    expect(result.data).toEqual({ ok: true });
    expect((openai.responses.create as ReturnType<typeof vi.fn>).mock.calls[0][0].text).toEqual({ format: { type: "json_object" } });
  });

  it("distinguishes an empty provider response", async () => {
    const openai = fakeOpenAI([{ output_text: "", usage }]);
    await expect(callModelJSON(openai, "gpt-test", "system", "user")).rejects.toMatchObject({ code: "MODEL_EMPTY_OUTPUT" });
  });

  it("distinguishes an initial JSON value with the wrong top-level shape", async () => {
    const openai = fakeOpenAI([{ output_text: "[]", usage }]);
    await expect(callModelJSON(openai, "gpt-test", "system", "user")).rejects.toMatchObject({ code: "MODEL_INVALID_JSON" });
  });

  it("distinguishes invalid repair JSON", async () => {
    const openai = fakeOpenAI([{ output_text: "not json", usage }, { output_text: "still not json", usage }]);
    await expect(callModelJSON(openai, "gpt-test", "system", "user")).rejects.toMatchObject({ code: "MODEL_REPAIR_INVALID_JSON" });
  });

  it("maps provider timeouts without exposing provider text", async () => {
    const timeout = Object.assign(new Error("request timed out"), { code: "ETIMEDOUT" });
    const openai = fakeOpenAI(timeout);
    await expect(callModelJSON(openai, "gpt-test", "system", "user")).rejects.toMatchObject({ code: "PROVIDER_TIMEOUT" });
  });

  it("uses the guarded unstructured fallback only when JSON mode is rejected", async () => {
    const unsupported = new Error("response_format json_object is not supported");
    const create = vi.fn().mockRejectedValueOnce(unsupported).mockResolvedValueOnce({ output_text: '{"ok":true}', usage });
    const openai = { responses: { create } } as unknown as OpenAI;
    const beforeCall = vi.fn().mockResolvedValue(undefined);
    await callModelJSON(openai, "gpt-test", "system", "user", { beforeCall });
    expect(beforeCall).toHaveBeenCalledTimes(2);
    expect(create.mock.calls[1][0].text).toBeUndefined();
  });
});
