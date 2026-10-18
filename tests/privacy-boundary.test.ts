import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { NextRequest } from "next/server";
import type OpenAI from "openai";

const mocks = vi.hoisted(() => ({
  openaiConstruct: vi.fn(),
  openaiCreate: vi.fn(),
  feedbackCreate: vi.fn(),
  feedbackFindMany: vi.fn(),
  adminAlert: vi.fn(),
  getSession: vi.fn(),
  userFindUnique: vi.fn(), usageAggregate: vi.fn(), usageCount: vi.fn(),
  appSettingCreate: vi.fn(), appSettingFindUnique: vi.fn(), appSettingDeleteMany: vi.fn(),
  ledgerFindMany: vi.fn(), deviceDeleteMany: vi.fn(),
}));

vi.mock("openai", () => ({
  default: vi.fn(function OpenAIMock() {
    mocks.openaiConstruct();
    return { responses: { create: mocks.openaiCreate } };
  }),
}));
vi.mock("next-auth", () => ({ getServerSession: mocks.getSession }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("@/lib/api-token", () => ({ resolveEmailFromBearerToken: vi.fn().mockResolvedValue(null) }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: { findUnique: mocks.userFindUnique },
    usageLog: { aggregate: mocks.usageAggregate, count: mocks.usageCount },
    appSetting: { create: mocks.appSettingCreate, findUnique: mocks.appSettingFindUnique, deleteMany: mocks.appSettingDeleteMany },
    tokenUsageLedger: { findMany: mocks.ledgerFindMany, create: vi.fn() },
    deviceSession: { deleteMany: mocks.deviceDeleteMany, findMany: vi.fn(), upsert: vi.fn() },
    feedback: { create: mocks.feedbackCreate, findMany: mocks.feedbackFindMany },
  },
}));
vi.mock("@/lib/admin-alert", () => ({ sendAdminAlertEmail: mocks.adminAlert }));

import { POST as summarizePost } from "../app/api/summarize/route";
import { POST as specialistPost } from "../app/api/specialist-chat/route";
import { POST as feedbackPost } from "../app/api/feedback/route";
import { callModelJSON } from "../lib/summary-model";

const image = { name: "scan.png", dataUrl: "data:image/png;base64,AAAA" };

function request(url: string, body: unknown) {
  return new Request(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
}

function nextRequest(url: string, body: unknown) {
  return new NextRequest(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
}

function configureSummaryUser(overrides: Record<string, unknown> = {}) {
  mocks.getSession.mockResolvedValue({ user: { email: "user@example.test" } });
  mocks.userFindUnique.mockResolvedValue({
    id: "user-1", role: "user", plan: "pro_monthly", extraCredits: 0,
    createdAt: new Date("2026-10-01T00:00:00.000Z"), periodStartedAt: new Date("2026-10-01T00:00:00.000Z"),
    subscriptionStatus: "active", subscriptionExpiresAt: new Date("2026-11-01T00:00:00.000Z"), usages: [],
    ...overrides,
  });
  mocks.usageAggregate.mockResolvedValue({ _sum: { baseCreditsUsed: 0 } });
  mocks.usageCount.mockResolvedValue(0);
  mocks.appSettingCreate.mockResolvedValue({ key: "lease" });
  mocks.appSettingDeleteMany.mockResolvedValue({ count: 1 });
  mocks.ledgerFindMany.mockResolvedValue([]);
  mocks.deviceDeleteMany.mockResolvedValue({ count: 0 });
}

beforeEach(() => {
  vi.resetAllMocks();
  mocks.openaiCreate.mockResolvedValue({ output_text: "Diagnosis: pneumonia" });
  mocks.feedbackCreate.mockResolvedValue({ id: "feedback-test-id" });
  mocks.feedbackFindMany.mockResolvedValue([]);
  mocks.adminAlert.mockResolvedValue(undefined);
  mocks.getSession.mockResolvedValue(null);
});

describe("AI privacy request boundaries", () => {
  it("does not auto-activate a stored pass at the daily cap, but returns the explicit offer", async () => {
    process.env.OPENAI_API_KEY = "test-key";
    configureSummaryUser({ extraCredits: 1 });
    mocks.usageCount.mockResolvedValue(40);
    const response = await summarizePost(request("https://app.test/api/summarize", {
      mode: "generate", inputs: { order_sheet: "short synthetic case" },
    }));
    expect(response.status).toBe(402);
    expect(await response.json()).toMatchObject({ errorCode: "SUMMARY_DAILY_LIMIT_REACHED", boostAvailable: true, canPurchaseBoost: true, requiredBoostPasses: 1 });
    expect(mocks.openaiCreate).not.toHaveBeenCalled();
  });

  it("only passes the daily gate after an explicit useBoost request", async () => {
    process.env.OPENAI_API_KEY = "test-key";
    configureSummaryUser({ extraCredits: 1 });
    mocks.usageCount.mockResolvedValue(40);
    await summarizePost(request("https://app.test/api/summarize", {
      mode: "generate", useBoost: true, inputs: { order_sheet: "short synthetic case" }, settings: { fast: true, model: "gpt-5-mini" },
    }));
    expect(mocks.openaiCreate).toHaveBeenCalled();
  });

  it("rejects legacy base-credit exhaustion before OCR or any provider call", async () => {
    process.env.OPENAI_API_KEY = "test-key";
    process.env.ENFORCE_CREDIT_LIMIT = "true";
    configureSummaryUser({ extraCredits: 1 });
    mocks.usageAggregate.mockResolvedValue({ _sum: { baseCreditsUsed: 1260 } });
    try {
      const response = await summarizePost(request("https://app.test/api/summarize", {
        mode: "generate", inputs: { order_sheet: "short synthetic case" }, imageInputs: [image], imagesRedactedConfirmed: true,
        settings: { fast: true, model: "gpt-5-mini" },
      }));
      expect(response.status).toBe(402);
      expect(await response.json()).toMatchObject({ errorCode: "LEGACY_CREDIT_LIMIT_REACHED", boostAvailable: false, canPurchaseBoost: true, requiredBoostPasses: 2 });
      expect(mocks.openaiCreate).not.toHaveBeenCalled();
    } finally {
      delete process.env.ENFORCE_CREDIT_LIMIT;
    }
  });

  it("rejects unconfirmed summary images before constructing OpenAI", async () => {
    const response = await summarizePost(request("https://app.test/api/summarize", { imageInputs: [image] }));
    expect(response.status).toBe(422);
    expect(await response.json()).toMatchObject({ errorCode: "PRIVACY_IMAGE_CONFIRMATION_REQUIRED" });
    expect(mocks.openaiConstruct).not.toHaveBeenCalled();
    expect(mocks.openaiCreate).not.toHaveBeenCalled();
  });

  it("rejects specialist images before any model call unless confirmed", async () => {
    process.env.NEXT_PUBLIC_FEATURE_CHAT = "true";
    process.env.OPENAI_API_KEY = "test-key";
    const response = await specialistPost(nextRequest("https://app.test/api/specialist-chat", { message: "review this", images: [image] }));
    expect(response.status).toBe(422);
    expect(await response.json()).toMatchObject({ errorCode: "PRIVACY_IMAGE_CONFIRMATION_REQUIRED" });
    expect(mocks.openaiCreate).not.toHaveBeenCalled();
  });

  it("keeps specialist chat disabled by default with zero model calls", async () => {
    delete process.env.NEXT_PUBLIC_FEATURE_CHAT;
    process.env.OPENAI_API_KEY = "test-key";
    const response = await specialistPost(nextRequest("https://app.test/api/specialist-chat", { message: "hello" }));
    expect(response.status).toBe(503);
    expect(mocks.openaiCreate).not.toHaveBeenCalled();
  });

  it("redacts real initial and repair outbound prompts, including user-supplied prompt sections", async () => {
    mocks.openaiCreate
      .mockResolvedValueOnce({ output_text: "HN: 98765 Patient Name: Jane Doe" })
      .mockResolvedValueOnce({ output_text: '{"ok":true}' });
    const openai = { responses: { create: mocks.openaiCreate } } as unknown as OpenAI;
    await expect(callModelJSON(openai, "gpt-5.4", "Patient Name: John Doe", "CURRENT BLOCKS: HN: 12345 Patient Name: Jane Doe\nTEMPLATE RULES: AN/56789\nEXTRA NOTE: Name: Jane Doe", { max_output_tokens: 20 })).resolves.toMatchObject({ data: { ok: true } });
    expect(mocks.openaiCreate).toHaveBeenCalledTimes(2);
    for (const [params] of mocks.openaiCreate.mock.calls) {
      const outbound = JSON.stringify(params.input);
      expect(outbound).not.toContain("12345");
      expect(outbound).not.toContain("56789");
      expect(outbound).not.toContain("98765");
      expect(outbound).not.toContain("Jane Doe");
      expect(outbound).not.toContain("John Doe");
      expect(params.store).toBe(false);
      expect(params.stream).toBe(false);
    }
  });

  it("runs a budget guard before each bounded provider call and records each completed response before repair", async () => {
    mocks.openaiCreate
      .mockResolvedValueOnce({ output_text: "not json", usage: { input_tokens: 90, output_tokens: 20, total_tokens: 110 } })
      .mockResolvedValueOnce({ output_text: '{"ok":true}', usage: { input_tokens: 100, output_tokens: 15, total_tokens: 115 } });
    const order: string[] = [];
    const openai = { responses: { create: mocks.openaiCreate } } as unknown as OpenAI;
    await callModelJSON(openai, "gpt-5.4", "system", "user", {
      max_output_tokens: 321,
      beforeCall: async ({ maxOutputTokens }) => { expect(maxOutputTokens).toBe(321); order.push("guard"); },
      onCompletedCall: async (_usage, purpose, usageAvailable) => { expect(usageAvailable).toBe(true); order.push(`logged:${purpose}`); },
    });
    expect(order).toEqual(["guard", "logged:initial", "guard", "logged:json_repair"]);
    for (const [params] of mocks.openaiCreate.mock.calls) expect(params.max_output_tokens).toBe(321);
  });

  it("applies the default 4000-token output cap to initial and repair requests", async () => {
    mocks.openaiCreate
      .mockResolvedValueOnce({ output_text: "invalid" })
      .mockResolvedValueOnce({ output_text: '{"ok":true}' });
    const openai = { responses: { create: mocks.openaiCreate } } as unknown as OpenAI;
    await callModelJSON(openai, "gpt-5.4", "system", "user");
    expect(mocks.openaiCreate).toHaveBeenCalledTimes(2);
    for (const [params] of mocks.openaiCreate.mock.calls) expect(params.max_output_tokens).toBe(4000);
  });

  it("does not send confirmed-image recalc requests when a subscription is expired", async () => {
    configureSummaryUser({ subscriptionStatus: "past_due" });
    process.env.OPENAI_API_KEY = "test-key";
    const response = await summarizePost(request("https://app.test/api/summarize", { mode: "recalc", imageInputs: [image], imagesRedactedConfirmed: true }));
    expect(response.status).toBe(402);
    expect(mocks.openaiConstruct).not.toHaveBeenCalled();
    expect(mocks.openaiCreate).not.toHaveBeenCalled();
  });

  it("blocks an exhausted new revenue-5x period before confirmed-image OCR", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-20T12:00:00.000Z"));
    try {
      configureSummaryUser({
        periodStartedAt: new Date("2026-10-20T00:00:00.000Z"),
        subscriptionExpiresAt: new Date("2026-11-20T00:00:00.000Z"),
      });
      mocks.ledgerFindMany.mockResolvedValue([{
        createdAt: new Date("2026-10-20T01:00:00.000Z"), source: "summary_provider_call", referenceId: "old-job",
        model: "gpt-5-mini", inputTokens: 50_000_000, outputTokens: 0, totalTokens: 50_000_000, estimatedCostThb: 0,
      }]);
      process.env.OPENAI_API_KEY = "test-key";
      const response = await summarizePost(request("https://app.test/api/summarize", { mode: "recalc", imageInputs: [image], imagesRedactedConfirmed: true }));
      expect(response.status).toBe(402);
      expect(await response.json()).toMatchObject({ errorCode: "API_COST_TARGET_REACHED" });
      expect(mocks.openaiConstruct).not.toHaveBeenCalled();
      expect(mocks.openaiCreate).not.toHaveBeenCalled();
    } finally { vi.useRealTimers(); }
  });

  it("blocks exhausted grandfathered legacy monthly budget for recalc before OCR", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-18T12:00:00.000Z"));
    try {
      configureSummaryUser({
        periodStartedAt: new Date("2026-10-01T00:00:00.000Z"),
        subscriptionExpiresAt: new Date("2026-11-01T00:00:00.000Z"),
      });
      mocks.ledgerFindMany.mockResolvedValue([{
        createdAt: new Date("2026-10-10T01:00:00.000Z"), source: "specialist_chat", referenceId: "chat-1",
        model: "gpt-5-mini", inputTokens: 1, outputTokens: 1, totalTokens: 2, estimatedCostThb: 10_000,
      }]);
      const response = await summarizePost(request("https://app.test/api/summarize", { mode: "recalc", imageInputs: [image], imagesRedactedConfirmed: true }));
      const result = await response.json();
      expect(mocks.ledgerFindMany).toHaveBeenCalledTimes(1);
      expect(result).toMatchObject({ errorCode: "USAGE_POLICY_LIMIT_REACHED" });
      expect(response.status).toBe(402);
      expect(mocks.openaiConstruct).not.toHaveBeenCalled();
      expect(mocks.openaiCreate).not.toHaveBeenCalled();
    } finally { vi.useRealTimers(); }
  });

  it("propagates a per-call OCR quota denial instead of falling back to typed text", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-18T12:00:00.000Z"));
    try {
      configureSummaryUser({
        periodStartedAt: new Date("2026-10-01T00:00:00.000Z"),
        subscriptionExpiresAt: new Date("2026-11-01T00:00:00.000Z"),
      });
      mocks.ledgerFindMany
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{
          createdAt: new Date("2026-10-10T01:00:00.000Z"), source: "specialist_chat", referenceId: "chat-1",
          model: "gpt-5-mini", inputTokens: 1, outputTokens: 1, totalTokens: 2, estimatedCostThb: 1_000_000_000,
        }]);
      const response = await summarizePost(request("https://app.test/api/summarize", {
        mode: "recalc", imageInputs: [image], imagesRedactedConfirmed: true, inputs: { order_sheet: "manual text" },
      }));
      const result = await response.json();
      expect(mocks.ledgerFindMany).toHaveBeenCalledTimes(2);
      expect(result).toMatchObject({ errorCode: "USAGE_POLICY_LIMIT_REACHED" });
      expect(response.status).toBe(402);
      expect(mocks.openaiCreate).not.toHaveBeenCalled();
    } finally { vi.useRealTimers(); }
  });

  it("fails closed on an active cross-instance usage lease before loading spend or calling providers", async () => {
    configureSummaryUser();
    mocks.appSettingCreate.mockRejectedValue(new Error("key already exists"));
    mocks.appSettingFindUnique.mockResolvedValue({ value: JSON.stringify({ token: "another-request", expiresAt: Date.now() + 60_000 }) });
    const response = await summarizePost(request("https://app.test/api/summarize", { mode: "recalc", imageInputs: [image], imagesRedactedConfirmed: true }));
    expect(response.status).toBe(429);
    expect(await response.json()).toMatchObject({ errorCode: "SUMMARY_USAGE_BUSY" });
    expect(mocks.usageAggregate).not.toHaveBeenCalled();
    expect(mocks.ledgerFindMany).not.toHaveBeenCalled();
    expect(mocks.openaiConstruct).not.toHaveBeenCalled();
    expect(mocks.openaiCreate).not.toHaveBeenCalled();
  });

  it("rejects an unpriced public model before any OpenAI call", async () => {
    configureSummaryUser();
    const response = await summarizePost(request("https://app.test/api/summarize", {
      mode: "recalc", settings: { model: "gpt-5.4-pro" }, currentBlocks: [],
    }));
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ errorCode: "SUMMARY_MODEL_NOT_ALLOWED" });
    expect(mocks.openaiConstruct).not.toHaveBeenCalled();
    expect(mocks.openaiCreate).not.toHaveBeenCalled();
  });

  it("logs the first completed call and blocks a repair before it reaches OpenAI", async () => {
    mocks.openaiCreate.mockResolvedValueOnce({ output_text: "not json", usage: { input_tokens: 90, output_tokens: 20, total_tokens: 110 } });
    const openai = { responses: { create: mocks.openaiCreate } } as unknown as OpenAI;
    const events: string[] = [];
    await expect(callModelJSON(openai, "gpt-5.4", "system", "user", {
      max_output_tokens: 100,
      beforeCall: async ({ purpose }) => {
        events.push(`guard:${purpose}`);
        if (purpose === "json_repair") throw new Error("API_COST_TARGET_REACHED");
      },
      onCompletedCall: async (_usage, purpose) => { events.push(`logged:${purpose}`); },
    })).rejects.toThrow("API_COST_TARGET_REACHED");
    expect(events).toEqual(["guard:initial", "logged:initial", "guard:json_repair"]);
    expect(mocks.openaiCreate).toHaveBeenCalledTimes(1);
  });

  it("keeps confirmed OCR enabled and provider storage disabled", () => {
    const source = readFileSync("app/api/summarize/route.ts", "utf8");
    expect(source).toContain("safeImageInputs.length > 0 && body.imagesRedactedConfirmed !== true");
    expect(source).toContain("extractClinicalTextFromImages(openai, safeImageInputs)");
    expect(source).toContain('store: false');
    expect(source).toContain("imageRedactionConfirmed: safeImageInputs.length > 0 ? body.imagesRedactedConfirmed === true : null");
    expect(source).toContain("imageContentVerified: false");
  });

  it("runs monthly, daily, and eligible paid-period cost checks before OCR and logs OCR separately", () => {
    const source = readFileSync("app/api/summarize/route.ts", "utf8");
    const preflight = source.indexOf("const monthStart = new Date(now.getFullYear()");
    const ocrCall = source.indexOf("extractClinicalTextFromImages(openai, safeImageInputs)");
    expect(preflight).toBeGreaterThanOrEqual(0);
    expect(source.indexOf("todaySummaryCount >= summaryApproxLimit", preflight)).toBeLessThan(ocrCall);
    expect(source.indexOf("getUsagePolicySnapshot(", preflight)).toBeLessThan(ocrCall);
    expect(source.indexOf("await guardProviderCall(100_000 * safeImageInputs.length", preflight)).toBeLessThan(ocrCall);
    expect(source).toContain("source: \"summary_provider_call\"");
    expect(source).toContain("maxRetries: 0, timeout: 90_000");
    expect(source.indexOf('source: "summary_image_ocr"', ocrCall)).toBeGreaterThan(ocrCall);
    expect(source.indexOf("aggregateUsage: TokenUsageSummary", ocrCall)).toBeGreaterThan(ocrCall);
  });
});

describe("feedback admin alerts", () => {
  it("sends metadata and an admin path without submitted chat or clinical text", async () => {
    const sensitive = "Patient Name: Jane Doe HN: 12345 pneumonia ceftriaxone 1 g IV";
    for (const type of ["chat", "error_report"]) {
      const response = await feedbackPost(nextRequest("https://app.test/api/feedback", { type, message: sensitive }));
      expect(response.status).toBe(200);
    }
    const messages = mocks.adminAlert.mock.calls.map(([args]) => JSON.stringify(args));
    expect(messages).toHaveLength(2);
    for (const message of messages) {
      expect(message).toContain("/admin/feedback");
      expect(message).not.toContain("Jane Doe");
      expect(message).not.toContain("12345");
      expect(message).not.toContain("ceftriaxone");
      expect(message).not.toContain("pneumonia");
    }
  });
});
