"use client";

import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef } from "react";
import { ANALYTICS_CONSENT_STORAGE_KEY, parseAnalyticsConsent } from "@/lib/analytics-consent";
import { flushPendingSafeAnalyticsEvents, trackSafeAnalyticsEvent } from "@/lib/safe-analytics-client";
import { GOOGLE_TAG_CONSENT_READY_EVENT, buildSafePublicPageViewParameters, getPageViewDedupeDecision, isGoogleTagConsentReady, isPublicAnalyticsPageViewPath, isSensitiveAnalyticsPath } from "./GoogleTag";

const PRICING_VISIT_KEY = "dx_pricing_viewed_v1";
const GA_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID?.trim() || "";

export function WebAnalyticsTracker() {
  const pathname = usePathname() || "/";
  const lastEventRef = useRef("");
  const lastPageViewRef = useRef("");

  const trackPublicPageView = useCallback(() => {
    if (!isPublicAnalyticsPageViewPath(pathname, window.location.search, window.location.hash)) {
      lastPageViewRef.current = "";
      return;
    }
    if (!GA_ID || !isGoogleTagConsentReady(pathname) || typeof window.gtag !== "function") return;
    try {
      const consent = parseAnalyticsConsent(JSON.parse(window.localStorage.getItem(ANALYTICS_CONSENT_STORAGE_KEY) || "null"));
      if (!consent?.analytics) return;
      const dedupe = getPageViewDedupeDecision(
        pathname,
        consent.savedAt,
        lastPageViewRef.current,
        window.location.search,
        window.location.hash,
      );
      if (!dedupe.shouldTrack) return;
      const parameters = buildSafePublicPageViewParameters(pathname, window.location.origin, GA_ID);
      if (!parameters) return;
      window.gtag("event", "page_view", parameters);
      lastPageViewRef.current = dedupe.key;
    } catch {
      // Storage may be disabled; never interrupt page usage.
    }
  }, [pathname]);

  const trackPricingVisit = useCallback(() => {
    if (pathname !== "/pricing" || lastEventRef.current === pathname) return;
    try {
      const consent = parseAnalyticsConsent(JSON.parse(window.localStorage.getItem(ANALYTICS_CONSENT_STORAGE_KEY) || "null"));
      if (!consent?.analytics || window.sessionStorage.getItem(PRICING_VISIT_KEY) === "1") return;
      if (trackSafeAnalyticsEvent("pricing_viewed")) {
        window.sessionStorage.setItem(PRICING_VISIT_KEY, "1");
        lastEventRef.current = pathname;
      }
    } catch {
      // Storage may be disabled; never interrupt page usage.
    }
  }, [pathname]);

  useEffect(() => {
    trackPricingVisit();
    trackPublicPageView();
    const flush = () => flushPendingSafeAnalyticsEvents();
    const pageView = () => trackPublicPageView();
    window.addEventListener("dx:analytics-consent-changed", trackPricingVisit);
    window.addEventListener("dx:analytics-consent-changed", pageView);
    window.addEventListener("dx:analytics-consent-changed", flush);
    window.addEventListener("dx:google-tag-ready", pageView);
    window.addEventListener("dx:google-tag-ready", flush);
    window.addEventListener(GOOGLE_TAG_CONSENT_READY_EVENT, trackPricingVisit);
    window.addEventListener(GOOGLE_TAG_CONSENT_READY_EVENT, pageView);
    window.addEventListener(GOOGLE_TAG_CONSENT_READY_EVENT, flush);
    flush();
    return () => {
      window.removeEventListener("dx:analytics-consent-changed", trackPricingVisit);
      window.removeEventListener("dx:analytics-consent-changed", pageView);
      window.removeEventListener("dx:analytics-consent-changed", flush);
      window.removeEventListener("dx:google-tag-ready", pageView);
      window.removeEventListener("dx:google-tag-ready", flush);
      window.removeEventListener(GOOGLE_TAG_CONSENT_READY_EVENT, trackPricingVisit);
      window.removeEventListener(GOOGLE_TAG_CONSENT_READY_EVENT, pageView);
      window.removeEventListener(GOOGLE_TAG_CONSENT_READY_EVENT, flush);
    };
  }, [trackPricingVisit, trackPublicPageView]);

  return null;
}
