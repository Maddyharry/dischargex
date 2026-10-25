"use client";

import Script from "next/script";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { ANALYTICS_CONSENT_STORAGE_KEY, parseAnalyticsConsent } from "@/lib/analytics-consent";

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
    __dxGoogleTagConsentReady?: {
      pathname: string;
      savedAt: string | null;
      analytics: boolean;
      marketing: boolean;
    };
  }
}

const GA_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID?.trim() || "";
const ADS_ID = process.env.NEXT_PUBLIC_GOOGLE_ADS_ID?.trim() || "";
const TAG_ID = GA_ID || ADS_ID;
const SENSITIVE_ROUTE_PREFIXES = [
  "/app", "/admin", "/chat", "/login", "/auth", "/register", "/signup", "/forgot-password",
  "/reset-password", "/api", "/summary-charge", "/icd10-review", "/automator", "/knowledge", "/guidelines",
];
const PUBLIC_PAGE_VIEW_PATHS = new Set([
  "/", "/about", "/pricing", "/downloads", "/learn", "/legal", "/privacy-policy", "/terms-of-service",
]);
export const GOOGLE_TAG_CONSENT_READY_EVENT = "dx:google-tag-consent-ready";

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

export function isPublicAnalyticsPageViewPath(pathname: string): boolean {
  const path = sanitizeAnalyticsPath(pathname);
  return PUBLIC_PAGE_VIEW_PATHS.has(path);
}

export function getPageViewDedupeDecision(pathname: string, savedAt: string, lastPageViewKey: string) {
  const path = sanitizeAnalyticsPath(pathname);
  if (isSensitiveAnalyticsPath(path) || !isPublicAnalyticsPageViewPath(path)) {
    return { key: "", shouldTrack: false };
  }
  const key = `${path}:${savedAt}`;
  return { key, shouldTrack: key !== lastPageViewKey };
}

const DENIED_CONSENT = {
  analytics_storage: "denied",
  ad_storage: "denied",
  ad_user_data: "denied",
  ad_personalization: "denied",
};

function googleConsent(analytics: boolean, marketing: boolean) {
  return {
    analytics_storage: analytics ? "granted" : "denied",
    ad_storage: marketing ? "granted" : "denied",
    ad_user_data: marketing ? "granted" : "denied",
    ad_personalization: marketing ? "granted" : "denied",
  };
}

function readStoredConsent() {
  try {
    return parseAnalyticsConsent(JSON.parse(window.localStorage.getItem(ANALYTICS_CONSENT_STORAGE_KEY) || "null"));
  } catch {
    return null;
  }
}

function clearGoogleTagConsentReadiness() {
  if (typeof window !== "undefined") delete window.__dxGoogleTagConsentReady;
}

export function markGoogleTagConsentReady(pathname: string, consent: ReturnType<typeof readStoredConsent>) {
  if (typeof window === "undefined" || isSensitiveAnalyticsPath(pathname)) return;
  window.__dxGoogleTagConsentReady = {
    pathname: sanitizeAnalyticsPath(pathname),
    savedAt: consent?.savedAt ?? null,
    analytics: consent?.analytics ?? false,
    marketing: consent?.marketing ?? false,
  };
  window.dispatchEvent(new Event(GOOGLE_TAG_CONSENT_READY_EVENT));
}

export function isGoogleTagConsentReady(pathname: string): boolean {
  if (typeof window === "undefined" || isSensitiveAnalyticsPath(pathname)) return false;
  const ready = window.__dxGoogleTagConsentReady;
  if (!ready || ready.pathname !== sanitizeAnalyticsPath(pathname)) return false;
  const consent = readStoredConsent();
  return ready.savedAt === (consent?.savedAt ?? null)
    && ready.analytics === (consent?.analytics ?? false)
    && ready.marketing === (consent?.marketing ?? false);
}

export function GoogleTag() {
  const pathname = usePathname() || "/";
  const [consent, setConsent] = useState<ReturnType<typeof readStoredConsent>>(null);

  useEffect(() => {
    const update = () => setConsent(readStoredConsent());
    update();
    window.addEventListener("dx:analytics-consent-changed", update);
    window.addEventListener("storage", update);
    return () => {
      window.removeEventListener("dx:analytics-consent-changed", update);
      window.removeEventListener("storage", update);
    };
  }, []);

  const applyConsent = useCallback(() => {
    clearGoogleTagConsentReadiness();
    if (typeof window === "undefined" || typeof window.gtag !== "function") return;
    const privateRoute = isSensitiveAnalyticsPath(pathname);
    const granted = !privateRoute && consent;
    window.gtag("consent", "update", granted ? googleConsent(granted.analytics, granted.marketing) : DENIED_CONSENT);
    if (privateRoute) {
      if (GA_ID) (window as unknown as Record<string, unknown>)[`ga-disable-${GA_ID}`] = true;
      return;
    }
    if (GA_ID && consent?.analytics) {
      (window as unknown as Record<string, unknown>)[`ga-disable-${GA_ID}`] = false;
      window.gtag("config", GA_ID, {
        send_page_view: false,
        allow_google_signals: false,
        allow_ad_personalization_signals: false,
        page_location: sanitizeAnalyticsLocation(pathname, window.location.origin),
        page_referrer: "",
      });
    }
    if (ADS_ID && consent?.marketing) {
      window.gtag("config", ADS_ID, {
        send_page_view: false,
        allow_google_signals: false,
        allow_ad_personalization_signals: false,
        page_location: sanitizeAnalyticsLocation(pathname, window.location.origin),
        page_referrer: "",
      });
    }
    markGoogleTagConsentReady(pathname, consent);
  }, [consent, pathname]);

  useEffect(() => {
    applyConsent();
  }, [applyConsent]);

  const publicRoute = !isSensitiveAnalyticsPath(pathname);
  const shouldLoad = publicRoute && !!TAG_ID && !!consent && ((!!GA_ID && consent.analytics) || (!!ADS_ID && consent.marketing));
  if (!shouldLoad) return null;

  return (
    <>
      <Script
        id="google-tag-init"
        strategy="afterInteractive"
        dangerouslySetInnerHTML={{
          __html: `
            window.dataLayer = window.dataLayer || [];
            window.gtag = window.gtag || function(){window.dataLayer.push(arguments);};
            window.gtag('consent', 'default', ${JSON.stringify(DENIED_CONSENT)});
            window.gtag('js', new Date());
          `,
        }}
      />
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${TAG_ID}`}
        strategy="afterInteractive"
        onReady={() => {
          applyConsent();
          window.dispatchEvent(new Event("dx:google-tag-ready"));
        }}
      />
    </>
  );
}
