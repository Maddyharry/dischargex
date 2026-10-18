type AdminAlertPayload = {
  subject: string;
  lines: string[];
};

export type AdminAlertEmailResult = {
  configured: boolean;
  accepted: boolean;
  providerStatus: number | null;
  failure: "not_configured" | "timeout" | "network_error" | "provider_rejected" | null;
};

const ADMIN_ALERT_TIMEOUT_MS = 8_000;

function buildTextBody(payload: AdminAlertPayload) {
  return `${payload.subject}\n\n${payload.lines.join("\n")}`.trim();
}

function buildHtmlBody(payload: AdminAlertPayload) {
  const escaped = payload.lines
    .map((line) => line.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"))
    .map((line) => `<div style="margin:0 0 8px 0;">${line}</div>`)
    .join("");
  return `<div style="font-family:Arial,sans-serif;color:#0f172a;">
    <h3 style="margin:0 0 12px 0;">${payload.subject}</h3>
    ${escaped}
  </div>`;
}

export async function sendAdminAlertEmail(payload: AdminAlertPayload) {
  const to = process.env.ADMIN_ALERT_EMAIL?.trim() || process.env.ADMIN_EMAIL?.trim();
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.EMAIL_FROM?.trim();
  if (!to || !apiKey || !from) {
    return {
      configured: false,
      accepted: false,
      providerStatus: null,
      failure: "not_configured",
    } satisfies AdminAlertEmailResult;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), ADMIN_ALERT_TIMEOUT_MS);
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [to],
        subject: payload.subject,
        text: buildTextBody(payload),
        html: buildHtmlBody(payload),
      }),
    });
    if (!res.ok) {
      console.error("sendAdminAlertEmail provider rejected:", res.status);
      return {
        configured: true,
        accepted: false,
        providerStatus: res.status,
        failure: "provider_rejected",
      } satisfies AdminAlertEmailResult;
    }
    return { configured: true, accepted: true, providerStatus: res.status, failure: null } satisfies AdminAlertEmailResult;
  } catch {
    const failure = controller.signal.aborted ? "timeout" : "network_error";
    console.error("sendAdminAlertEmail failed:", failure);
    return {
      configured: true,
      accepted: false,
      providerStatus: null,
      failure,
    } satisfies AdminAlertEmailResult;
  } finally {
    clearTimeout(timeout);
  }
}

