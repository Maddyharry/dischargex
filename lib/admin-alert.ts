type AdminAlertPayload = {
  subject: string;
  lines: string[];
};

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
  const to = process.env.ADMIN_ALERT_EMAIL?.trim();
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.EMAIL_FROM?.trim();
  if (!to || !apiKey || !from) return;

  try {
    await fetch("https://api.resend.com/emails", {
      method: "POST",
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
  } catch (err) {
    console.error("sendAdminAlertEmail failed:", err);
  }
}

