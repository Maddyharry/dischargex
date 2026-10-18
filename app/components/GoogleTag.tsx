"use client";

import Script from "next/script";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef } from "react";

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

const GA_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID?.trim() || "";
const ADS_ID = process.env.NEXT_PUBLIC_GOOGLE_ADS_ID?.trim() || "";
const TAG_ID = GA_ID || ADS_ID;
const SENSITIVE_ROUTE_PREFIXES = [
  "/app",
  "/admin",
  "/chat",
  "/login",
  "/auth",
  "/register",
  "/signup",
  "/forgot-password",
  "/reset-password",
  "/api",
  "/summary-charge",
  "/icd10-review",
  "/automator",
  "/knowledge",
  "/guidelines",
];

export function sanitizeAnalyticsPath(pathname: string): string {
  const path = pathname.split(/[?#]/, 1)[0] || "/";
  return path.startsWith("/") ? path : `/${path}`;
}

export function sanitizeAnalyticsLocation(pathname: string, origin: string): string {
  const safeOrigin = new URL(origin).origin;
  return `${safeOrigin}${sanitizeAnalyticsPath(pathname)}`;
}

export function isSensitiveAnalyticsPath(pathname: string): boolean {
  const path = sanitizeAnalyticsPath(pathname);
  return SENSITIVE_ROUTE_PREFIXES.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));
}

const DENIED_CONSENT = {
  analytics_storage: "denied",
  ad_storage: "denied",
  ad_user_data: "denied",
  ad_personalization: "denied",
};

const MARKETING_CONSENT = {
  analytics_storage: "granted",
  ad_storage: "granted",
  ad_user_data: "granted",
  ad_personalization: "granted",
};

export function GoogleTag() {
  const pathname = usePathname() || "/";
  const lastPageViewRef = useRef("");

  const handleRouteAnalytics = useCallback(() => {
    if (typeof window === "undefined" || typeof window.gtag !== "function") return;
    const currentPath = pathname;
    if (isSensitiveAnalyticsPath(currentPath)) {
      lastPageViewRef.current = "";
      if (GA_ID) (window as unknown as Record<string, unknown>)[`ga-disable-${GA_ID}`] = true;
      window.gtag("consent", "update", DENIED_CONSENT);
      return;
    }

    if (GA_ID) (window as unknown as Record<string, unknown>)[`ga-disable-${GA_ID}`] = false;
    window.gtag("consent", "update", MARKETING_CONSENT);
    if (!TAG_ID || lastPageViewRef.current === currentPath) return;
    lastPageViewRef.current = currentPath;
    const pageLocation = sanitizeAnalyticsLocation(currentPath, window.location.origin);
    window.gtag("set", { page_location: pageLocation, page_referrer: "" });
    window.gtag("event", "page_view", {
      page_path: sanitizeAnalyticsPath(currentPath),
      page_location: pageLocation,
      page_referrer: "",
      send_to: GA_ID || ADS_ID,
    });
  }, [pathname]);

  useEffect(() => {
    handleRouteAnalytics();
  }, [handleRouteAnalytics, pathname]);

  if (!TAG_ID || isSensitiveAnalyticsPath(pathname)) return null;

  return (
    <>
      <Script src={`https://www.googletagmanager.com/gtag/js?id=${TAG_ID}`} strategy="afterInteractive" />
      <Script
        id="google-tag-init"
        strategy="afterInteractive"
        dangerouslySetInnerHTML={{
          __html: `
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            window.gtag = gtag;
            gtag('consent', 'default', ${JSON.stringify(DENIED_CONSENT)});
            gtag('js', new Date());
            ${GA_ID ? `gtag('config', '${GA_ID}', { send_page_view: false });` : ""}
            ${ADS_ID ? `gtag('config', '${ADS_ID}', { send_page_view: false });` : ""}
          `,
        }}
        onReady={handleRouteAnalytics}
      />
    </>
  );
}

