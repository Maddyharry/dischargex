const DEV_FALLBACK_ORIGIN = "http://localhost:3000";

function toOriginFromRequest(req: Request) {
  const xfHost = req.headers.get("x-forwarded-host")?.trim();
  const xfProto = req.headers.get("x-forwarded-proto")?.trim();
  if (xfHost) {
    const proto = xfProto || "https";
    return `${proto}://${xfHost}`.replace(/\/+$/, "");
  }
  const origin = req.headers.get("origin")?.trim();
  if (origin) return origin.replace(/\/+$/, "");
  try {
    const url = new URL(req.url);
    return `${url.protocol}//${url.host}`.replace(/\/+$/, "");
  } catch {
    return "";
  }
}

export function getTrustedAppOrigin(req?: Request) {
  const appOrigin = process.env.APP_ORIGIN?.trim();
  if (appOrigin) return appOrigin.replace(/\/+$/, "");
  if (req) {
    const fromRequest = toOriginFromRequest(req);
    if (fromRequest) return fromRequest;
  }
  const configured = process.env.NEXTAUTH_URL?.trim();
  if (configured) return configured.replace(/\/+$/, "");
  const vercel = process.env.VERCEL_URL?.trim();
  if (vercel) return `https://${vercel}`.replace(/\/+$/, "");
  return process.env.NODE_ENV === "development" ? DEV_FALLBACK_ORIGIN : "";
}

