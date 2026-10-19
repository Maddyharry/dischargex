"use client";

import { useEffect } from "react";
import { useSession } from "next-auth/react";

const PENDING_REFERRAL_KEY = "dischargex_pending_referral_code";

export default function ReferralClaimOnLogin() {
  const { status } = useSession();

  useEffect(() => {
    if (status !== "authenticated") return;
    const referralCode = window.sessionStorage.getItem(PENDING_REFERRAL_KEY);
    if (!referralCode) return;

    let cancelled = false;
    void fetch("/api/referral/claim", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ referralCode }),
    }).then((response) => {
      if (!cancelled && (response.ok || response.status === 400)) {
        window.sessionStorage.removeItem(PENDING_REFERRAL_KEY);
      }
    }).catch(() => {
      // Keep the code for a later authenticated visit if the request failed in transit.
    });

    return () => { cancelled = true; };
  }, [status]);

  return null;
}
