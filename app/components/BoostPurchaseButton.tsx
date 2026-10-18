"use client";

import { useState } from "react";

export default function BoostPurchaseButton({ credits = 5, compact = false }: { credits?: 5 | 15; compact?: boolean }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function beginCheckout() {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ addCredits: credits }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.ok || !data.checkoutUrl) throw new Error(data.error || "เริ่มชำระเงินไม่สำเร็จ");
      window.location.assign(data.checkoutUrl);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "เริ่มชำระเงินไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }

  return <div className="space-y-1">
    <button type="button" onClick={() => void beginCheckout()} disabled={loading}
      className={`rounded-xl bg-cyan-600 px-4 py-2 text-sm font-semibold text-white hover:bg-cyan-500 disabled:opacity-50 ${compact ? "text-xs" : ""}`}>
      {loading ? "กำลังเปิด Stripe…" : `ซื้อ Boost ${credits} สิทธิ์ · ฿${credits === 5 ? 109 : 329}`}
    </button>
    {error ? <p role="alert" className="text-xs text-rose-300">{error}</p> : null}
  </div>;
}
