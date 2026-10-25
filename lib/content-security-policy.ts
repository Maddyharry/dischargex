const GA4_SCRIPT_ORIGIN = "https://www.googletagmanager.com";
const GA4_MEASUREMENT_ORIGINS = [
  "https://*.google-analytics.com",
  "https://*.google.com",
] as const;

/** Build the site's CSP while permitting consent-gated Google Analytics 4 only. */
export function buildContentSecurityPolicy(isDev: boolean): string {
  const scriptSources = ["'self'", "'unsafe-inline'", GA4_SCRIPT_ORIGIN];
  if (isDev) scriptSources.push("'unsafe-eval'");

  return [
    "default-src 'self'",
    "base-uri 'self'",
    "frame-ancestors 'none'",
    "object-src 'none'",
    `img-src 'self' data: blob: ${GA4_SCRIPT_ORIGIN} https://*.google-analytics.com`,
    "font-src 'self' data:",
    "style-src 'self' 'unsafe-inline'",
    `script-src ${scriptSources.join(" ")}`,
    "frame-src 'self' https://www.youtube.com https://www.youtube-nocookie.com",
    `connect-src 'self' ${GA4_SCRIPT_ORIGIN} ${GA4_MEASUREMENT_ORIGINS.join(" ")}`,
    "form-action 'self'",
    "upgrade-insecure-requests",
  ].join("; ");
}
