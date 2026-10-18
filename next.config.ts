import type { NextConfig } from "next";
import withPWAInit from "next-pwa";

const isDev = process.env.NODE_ENV !== "production";
const withPWA = withPWAInit({
  dest: "public",
  disable: true,
  cacheStartUrl: false,
  dynamicStartUrl: false,
  cleanupOutdatedCaches: true,
  publicExcludes: [
    "!noprecache/**/*",
    "!uploads/**/*",
    "!slips/**/*",
    "!**/*slip*",
    "!**/*screenshot*",
    "!**/*screen-shot*",
    "!**/*clinical*",
    "!**/*.{pdf,csv,xls,xlsx,doc,docx,jpg,jpeg,png,gif,webp,bmp,tif,tiff}",
  ],
  runtimeCaching: [
    {
      urlPattern:
        /^https?:\/\/[^/]+\/(?:api|admin|app|auth|login|register|chat|specialist-chat|uploads|slips)(?:\/|$)/i,
      handler: "NetworkOnly",
      method: "GET",
    },
    ...(["POST", "PUT", "PATCH", "DELETE"] as const).map((method) => ({
      urlPattern:
        /^https?:\/\/[^/]+\/(?:api|admin|app|auth|login|register|chat|specialist-chat|uploads|slips)(?:\/|$)/i,
      handler: "NetworkOnly" as const,
      method,
    })),
    {
      urlPattern: /\.(?:pdf|csv|xls|xlsx|doc|docx|jpe?g|png|gif|webp|bmp|tiff?)(?:$|\?)/i,
      handler: "NetworkOnly",
      method: "GET",
    },
  ],
});

const securityHeaders = [
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  {
    key: "X-Frame-Options",
    value: "DENY",
  },
  {
    key: "X-Content-Type-Options",
    value: "nosniff",
  },
  {
    key: "Referrer-Policy",
    value: "strict-origin-when-cross-origin",
  },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(self), geolocation=()",
  },
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      "base-uri 'self'",
      "frame-ancestors 'none'",
      "object-src 'none'",
      "img-src 'self' data: blob: https:",
      "font-src 'self' data:",
      "style-src 'self' 'unsafe-inline'",
      isDev
        ? "script-src 'self' 'unsafe-inline' 'unsafe-eval'"
        : "script-src 'self' 'unsafe-inline'",
      "frame-src 'self' https://www.youtube.com https://www.youtube-nocookie.com",
      "connect-src 'self' https:",
      "form-action 'self'",
      "upgrade-insecure-requests",
    ].join("; "),
  },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  turbopack: {},
  async rewrites() {
    return {
      beforeFiles: [{ source: "/sw.js", destination: "/privacy-retire-sw.js" }],
      afterFiles: [],
      fallback: [],
    };
  },
  async headers() {
    return [
      {
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "no-store, max-age=0" },
          { key: "Service-Worker-Allowed", value: "/" },
        ],
      },
      {
        source: "/privacy-reset-sw.js",
        headers: [{ key: "Cache-Control", value: "no-store, max-age=0" }],
      },
      {
        source: "/privacy-retire-sw.js",
        headers: [{ key: "Cache-Control", value: "no-store, max-age=0" }],
      },
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
};

export default withPWA(nextConfig);
