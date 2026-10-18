"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { isSensitiveAnalyticsPath, sanitizeAnalyticsLocation, sanitizeAnalyticsPath } from "./GoogleTag";

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
  }
}

const VISITOR_KEY = "dx_web_visitor_id_v1";
const SESSION_KEY = "dx_web_session_id_v1";
const LANDING_AB_KEY = "dx_ab_landing_cta_v1";
const LANDING_AB_SENT_KEY = "dx_ab_landing_assigned_sent_v1";
const ADS_ID = process.env.NEXT_PUBLIC_GOOGLE_ADS_ID?.trim() || "";

function randomId(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function getOrCreateStorageId(key: string, prefix: string, storage: Storage) {
  const existing = storage.getItem(key);
  if (existing) return existing;
  const next = randomId(prefix);
  storage.setItem(key, next);
  return next;
}

function getOrCreateAbVariant() {
  const existing = window.localStorage.getItem(LANDING_AB_KEY);
  if (existing === "A" || existing === "B") return existing;
  const variant = Math.random() < 0.5 ? "A" : "B";
  window.localStorage.setItem(LANDING_AB_KEY, variant);
  return variant;
}

function sendTelemetry(payload: Record<string, unknown>) {
  const body = JSON.stringify(payload);
  if (navigator.sendBeacon) {
    const blob = new Blob([body], { type: "application/json" });
    navigator.sendBeacon("/api/telemetry/web", blob);
    return;
  }
  void fetch("/api/telemetry/web", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
    keepalive: true,
  });
}

function trackClickTelemetry(
  target: HTMLElement,
  context: { path: string; visitorId: string; sessionId: string; landingVariant: string }
) {
  const key = target.dataset.telemetryClick?.trim();
  if (!key) return;
  const abTest = target.dataset.abTest?.trim();
  const abVariant = target.dataset.abVariant?.trim() || (key.startsWith("landing_") ? context.landingVariant : "");
  const href =
    target instanceof HTMLAnchorElement
      ? target.href
      : target.closest("a") instanceof HTMLAnchorElement
      ? (target.closest("a") as HTMLAnchorElement).href
      : null;
  let sanitizedHref: string | null = null;
  if (href) {
    try {
      const url = new URL(href, window.location.origin);
      if (url.protocol === "http:" || url.protocol === "https:") {
        sanitizedHref = sanitizeAnalyticsLocation(url.pathname, url.origin);
      }
    } catch {
      sanitizedHref = null;
    }
  }
  sendTelemetry({
    event: "cta_click",
    path: sanitizeAnalyticsPath(context.path),
    ctaKey: key,
    href: sanitizedHref,
    abTest: abTest || null,
    abVariant: abVariant || null,
    visitorId: context.visitorId,
    sessionId: context.sessionId,
  });

  const conversionLabel = target.dataset.googleConversionLabel?.trim();
  if (conversionLabel && ADS_ID && typeof window !== "undefined" && typeof window.gtag === "function") {
    const pageLocation = sanitizeAnalyticsLocation(context.path, window.location.origin);
    window.gtag("event", "conversion", {
      send_to: `${ADS_ID}/${conversionLabel}`,
      value: 1,
      currency: "THB",
      page_location: pageLocation,
    });
  }
}

export function WebAnalyticsTracker() {
  const pathname = usePathname() || "/";
  const startedAtRef = useRef<number>(0);
  const pathRef = useRef<string>(sanitizeAnalyticsPath(pathname));
  const visitorIdRef = useRef<string>("");
  const sessionIdRef = useRef<string>("");
  const landingVariantRef = useRef<string>("");

  useEffect(() => {
    try {
      if (isSensitiveAnalyticsPath(pathname)) return;
      visitorIdRef.current = getOrCreateStorageId(VISITOR_KEY, "v", window.localStorage);
      sessionIdRef.current = getOrCreateStorageId(SESSION_KEY, "s", window.sessionStorage);
      landingVariantRef.current = getOrCreateAbVariant();
      if (!window.sessionStorage.getItem(LANDING_AB_SENT_KEY)) {
        sendTelemetry({
          event: "ab_variant_assigned",
          path: "/",
          abTest: "landing_primary_cta_v1",
          abVariant: landingVariantRef.current,
          visitorId: visitorIdRef.current,
          sessionId: sessionIdRef.current,
        });
        window.sessionStorage.setItem(LANDING_AB_SENT_KEY, "1");
      }
    } catch {
      visitorIdRef.current = "";
      sessionIdRef.current = "";
      landingVariantRef.current = "";
    }
  }, [pathname]);

  useEffect(() => {
    function handleClick(event: MouseEvent) {
      const node = event.target as HTMLElement | null;
      if (!node) return;
      const currentPath = sanitizeAnalyticsPath(window.location.pathname);
      if (isSensitiveAnalyticsPath(currentPath)) return;
      pathRef.current = currentPath;
      const clickable = node.closest<HTMLElement>("[data-telemetry-click]");
      if (!clickable) return;
      trackClickTelemetry(clickable, {
        path: currentPath,
        visitorId: visitorIdRef.current,
        sessionId: sessionIdRef.current,
        landingVariant: landingVariantRef.current,
      });
    }
    window.addEventListener("click", handleClick);
    return () => window.removeEventListener("click", handleClick);
  }, []);

  useEffect(() => {
    const nextPath = sanitizeAnalyticsPath(pathname);
    const now = Date.now();

    const prevPath = pathRef.current;
    const prevStartedAt = startedAtRef.current;
    const prevDuration = Math.max(0, now - prevStartedAt);
    if (prevPath && prevStartedAt > 0) {
      sendTelemetry({
        event: "page_leave",
        path: prevPath,
        durationMs: prevDuration,
        visitorId: visitorIdRef.current,
        sessionId: sessionIdRef.current,
        abTest: prevPath === "/" ? "landing_primary_cta_v1" : null,
        abVariant: prevPath === "/" ? landingVariantRef.current || null : null,
      });
    }

    pathRef.current = nextPath;
    if (isSensitiveAnalyticsPath(nextPath)) {
      startedAtRef.current = 0;
      return;
    }
    startedAtRef.current = now;
    sendTelemetry({
      event: "page_view",
      path: nextPath,
      visitorId: visitorIdRef.current,
      sessionId: sessionIdRef.current,
      abTest: nextPath === "/" ? "landing_primary_cta_v1" : null,
      abVariant: nextPath === "/" ? landingVariantRef.current || null : null,
    });
  }, [pathname]);

  useEffect(() => {
    function handleBeforeUnload() {
      const currentPath = sanitizeAnalyticsPath(window.location.pathname);
      if (isSensitiveAnalyticsPath(currentPath)) return;
      const now = Date.now();
      sendTelemetry({
        event: "page_leave",
        path: currentPath,
        durationMs: Math.max(0, now - startedAtRef.current),
        visitorId: visitorIdRef.current,
        sessionId: sessionIdRef.current,
        abTest: currentPath === "/" ? "landing_primary_cta_v1" : null,
        abVariant: currentPath === "/" ? landingVariantRef.current || null : null,
      });
    }
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, []);

  return null;
}
