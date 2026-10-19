"use client";

import { useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import { normalizeReferralCode, PENDING_REFERRAL_CODE_KEY } from "@/lib/pending-referral";

export function ReferralClaimOnLogin() {
  const { status } = useSession();
  const started = useRef(false);

  useEffect(() => {
    if (status !== "authenticated" || started.current) return;
    const code = normalizeReferralCode(window.sessionStorage.getItem(PENDING_REFERRAL_CODE_KEY));
    if (!code) return;
    started.current = true;

    void (async () => {
      try {
        const response = await fetch("/api/referral/claim", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ referralCode: code }),
        });
        const result = (await response.json()) as { ok?: boolean; alreadyClaimed?: boolean };
        if (response.ok && result.ok && (result.alreadyClaimed === true || result.alreadyClaimed === undefined)) {
          if (window.sessionStorage.getItem(PENDING_REFERRAL_CODE_KEY) === code) {
            window.sessionStorage.removeItem(PENDING_REFERRAL_CODE_KEY);
          }
        }
      } catch {
        // Keep the pending code so a later authenticated visit can retry.
      }
    })();
  }, [status]);

  return null;
}
