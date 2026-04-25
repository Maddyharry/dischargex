"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

const LANDING_AB_KEY = "dx_ab_landing_cta_v1";

type LandingSignupCtaProps = {
  className: string;
  telemetryKey: string;
};

export function LandingSignupCta({ className, telemetryKey }: LandingSignupCtaProps) {
  const [variant] = useState<"A" | "B">(() => {
    if (typeof window === "undefined") return "A";
    try {
      const existing = window.localStorage.getItem(LANDING_AB_KEY);
      if (existing === "A" || existing === "B") return existing;
      const next = Math.random() < 0.5 ? "A" : "B";
      window.localStorage.setItem(LANDING_AB_KEY, next);
      return next;
    } catch {
      return "A";
    }
  });

  useEffect(() => {
    try {
      const existing = window.localStorage.getItem(LANDING_AB_KEY);
      if (existing !== "A" && existing !== "B") {
        window.localStorage.setItem(LANDING_AB_KEY, variant);
      }
    } catch {
      // ignore storage failures
    }
  }, [variant]);

  return (
    <Link
      href="/signup"
      data-telemetry-click={telemetryKey}
      data-google-conversion-label="SIGNUP_START"
      data-ab-test="landing_primary_cta_v1"
      data-ab-variant={variant}
      className={className}
    >
      {variant === "A" ? "เริ่มทดลองใช้งาน" : "เริ่มใช้ฟรี 14 วัน"}
    </Link>
  );
}
