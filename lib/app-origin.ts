const DEV_FALLBACK_ORIGIN = "http://localhost:3000";

export function getTrustedAppOrigin() {
  const configured = process.env.NEXTAUTH_URL?.trim();
  if (configured) return configured.replace(/\/+$/, "");
  return process.env.NODE_ENV === "development" ? DEV_FALLBACK_ORIGIN : "";
}

