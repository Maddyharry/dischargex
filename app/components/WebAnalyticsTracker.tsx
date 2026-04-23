"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

const VISITOR_KEY = "dx_web_visitor_id_v1";
const SESSION_KEY = "dx_web_session_id_v1";
const LANDING_AB_KEY = "dx_ab_landing_cta_v1";
const LANDING_AB_SENT_KEY = "dx_ab_landing_assigned_sent_v1";

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
  sendTelemetry({
    event: "cta_click",
    path: context.path,
    ctaKey: key,
    href: href || null,
    abTest: abTest || null,
    abVariant: abVariant || null,
    visitorId: context.visitorId,
    sessionId: context.sessionId,
  });
}

export function WebAnalyticsTracker() {
  const pathname = usePathname();
  const startedAtRef = useRef<number>(0);
  const pathRef = useRef<string>("/");
  const visitorIdRef = useRef<string>("");
  const sessionIdRef = useRef<string>("");
  const landingVariantRef = useRef<string>("");

  useEffect(() => {
    try {
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
  }, []);

  useEffect(() => {
    function handleClick(event: MouseEvent) {
      const node = event.target as HTMLElement | null;
      if (!node) return;
      const clickable = node.closest<HTMLElement>("[data-telemetry-click]");
      if (!clickable) return;
      trackClickTelemetry(clickable, {
        path: pathRef.current,
        visitorId: visitorIdRef.current,
        sessionId: sessionIdRef.current,
        landingVariant: landingVariantRef.current,
      });
    }
    window.addEventListener("click", handleClick);
    return () => window.removeEventListener("click", handleClick);
  }, []);

  useEffect(() => {
    const nextPath = pathname || "/";
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
      const now = Date.now();
      sendTelemetry({
        event: "page_leave",
        path: pathRef.current,
        durationMs: Math.max(0, now - startedAtRef.current),
        visitorId: visitorIdRef.current,
        sessionId: sessionIdRef.current,
        abTest: pathRef.current === "/" ? "landing_primary_cta_v1" : null,
        abVariant: pathRef.current === "/" ? landingVariantRef.current || null : null,
      });
    }
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, []);

  return null;
}
