import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ getServerSession: vi.fn() }));

vi.mock("next-auth", () => ({ getServerSession: mocks.getServerSession }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));

import { sendAdminAlertEmail } from "@/lib/admin-alert";
import { POST } from "@/app/api/admin/analytics-config/route";

function configureEmail() {
  vi.stubEnv("ADMIN_ALERT_EMAIL", "admin@example.test");
  vi.stubEnv("ADMIN_EMAIL", "");
  vi.stubEnv("RESEND_API_KEY", "test-secret");
  vi.stubEnv("EMAIL_FROM", "DischargeX <noreply@example.test>");
}

describe("admin alert email delivery", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.getServerSession.mockResolvedValue({ user: { role: "admin", email: "admin@example.test" } });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("reports missing configuration without attempting delivery", async () => {
    vi.stubEnv("ADMIN_ALERT_EMAIL", "");
    vi.stubEnv("ADMIN_EMAIL", "");
    vi.stubEnv("RESEND_API_KEY", "");
    vi.stubEnv("EMAIL_FROM", "");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(sendAdminAlertEmail({ subject: "test", lines: [] })).resolves.toEqual({
      configured: false,
      accepted: false,
      providerStatus: null,
      failure: "not_configured",
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("reports provider acceptance and HTTP status", async () => {
    configureEmail();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, status: 202 }));

    await expect(sendAdminAlertEmail({ subject: "test", lines: [] })).resolves.toEqual({
      configured: true,
      accepted: true,
      providerStatus: 202,
      failure: null,
    });
  });

  it("reports provider rejection without reading or logging its response body", async () => {
    configureEmail();
    const text = vi.fn().mockResolvedValue("private provider response");
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 429, text }));

    await expect(sendAdminAlertEmail({ subject: "test", lines: [] })).resolves.toEqual({
      configured: true,
      accepted: false,
      providerStatus: 429,
      failure: "provider_rejected",
    });
    expect(text).not.toHaveBeenCalled();
    expect(log).toHaveBeenCalledWith("sendAdminAlertEmail provider rejected:", 429);
  });

  it("returns timeout status when the provider exceeds the deadline", async () => {
    configureEmail();
    vi.useFakeTimers();
    vi.stubGlobal("fetch", vi.fn((_url: string, init: RequestInit) => new Promise<Response>((_resolve, reject) => {
      init.signal?.addEventListener("abort", () => reject(new Error("aborted")));
    })));

    const pending = sendAdminAlertEmail({ subject: "test", lines: [] });
    await vi.advanceTimersByTimeAsync(8_000);
    await expect(pending).resolves.toMatchObject({
      configured: true,
      accepted: false,
      providerStatus: null,
      failure: "timeout",
    });
  });

  it("returns 503 from the admin test endpoint when mail is not configured", async () => {
    vi.stubEnv("ADMIN_ALERT_EMAIL", "");
    vi.stubEnv("ADMIN_EMAIL", "");
    vi.stubEnv("RESEND_API_KEY", "");
    vi.stubEnv("EMAIL_FROM", "");

    const response = await POST();
    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({
      ok: false,
      delivery: { configured: false, accepted: false, failure: "not_configured" },
    });
  });

  it("returns 503 from the admin test endpoint when the provider rejects", async () => {
    configureEmail();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 503 }));

    const response = await POST();
    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({
      ok: false,
      delivery: { configured: true, accepted: false, providerStatus: 503, failure: "provider_rejected" },
    });
  });

  it("returns 200 only after the provider accepts the admin test email", async () => {
    configureEmail();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, status: 200 }));

    const response = await POST();
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      ok: true,
      delivery: { configured: true, accepted: true, providerStatus: 200, failure: null },
    });
  });
});
