"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

function useEscapeKey(onEscape: () => void, enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;
    function handle(e: KeyboardEvent) {
      if (e.key === "Escape") onEscape();
    }
    window.addEventListener("keydown", handle);
    return () => window.removeEventListener("keydown", handle);
  }, [onEscape, enabled]);
}
import type { PaymentStatus } from "@/lib/payments-store";

type PaymentRow = {
  id: string;
  fullName: string;
  birthDate: string;
  hospitalName: string;
  province: string;
  phone: string;
  contactEmail: string;
  planRequested: string;
  type?: string;
  quotedAmount?: number | null;
  finalAmount?: number | null;
  slipFileName: string;
  status: PaymentStatus;
  addCredits?: number | null;
  createdAt: string;
};

function formatPlanName(planId: string): string {
  switch (planId) {
    case "basic_monthly":
      return "Basic Monthly";
    case "basic_yearly":
      return "Basic Yearly";
    case "standard_monthly":
      return "Standard Monthly";
    case "standard_yearly":
      return "Standard Yearly";
    case "pro_monthly":
      return "Pro Monthly";
    case "pro_yearly":
      return "Pro Yearly";
    default:
      return planId.toUpperCase();
  }
}

type ApiListResponse = {
  ok: boolean;
  payments?: PaymentRow[];
  error?: string;
};

function SlipCell({ paymentId }: { paymentId: string }) {
  const [imgError, setImgError] = useState(false);
  const [open, setOpen] = useState(false);
  useEscapeKey(() => setOpen(false), open);
  if (!paymentId) return <span>-</span>;
  const src = `/api/admin/slip?id=${encodeURIComponent(paymentId)}`;
  return (
    <div className="flex flex-col items-start gap-1">
      {!imgError ? (
        <>
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="block rounded-lg border border-slate-600 overflow-hidden hover:border-cyan-500/50 focus:border-cyan-500 cursor-pointer"
            title="คลิกเพื่อขยายรูป"
          >
            <img
              src={src}
              alt="สลิป"
              className="h-14 w-auto max-w-[120px] object-contain bg-slate-900 pointer-events-none"
              onError={() => setImgError(true)}
            />
          </button>
          <span className="text-[11px] text-slate-500">คลิกรูปเพื่อขยาย</span>
          <a
            href={src}
            target="_blank"
            rel="noopener noreferrer"
            className="text-cyan-400 hover:underline text-[11px]"
          >
            เปิดรูปในแท็บใหม่
          </a>
        </>
      ) : (
        <span className="text-slate-500">ไม่มีรูป</span>
      )}
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4"
          onClick={() => setOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-label="รูปสลิปขยาย"
        >
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="absolute right-4 top-4 z-10 rounded-xl border border-slate-600 bg-slate-800 px-4 py-2 text-sm font-medium text-slate-200 hover:bg-slate-700"
          >
            ปิด
          </button>
          <img
            src={src}
            alt="สลิปโอนเงิน (ขยาย)"
            className="max-h-full max-w-full object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}

export default function AdminPaymentsPage() {
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  async function loadPayments() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/payments");
      const text = await res.text();
      let data: ApiListResponse;
      try {
        data = text ? (JSON.parse(text) as ApiListResponse) : { ok: false };
      } catch {
        throw new Error(res.ok ? "ตอบกลับไม่ใช่ JSON" : `โหลดไม่สำเร็จ (${res.status})`);
      }
      if (!res.ok || !data.ok || !data.payments) {
        throw new Error(data.error || "โหลดรายการชำระเงินไม่สำเร็จ");
      }
      setPayments(data.payments);
    } catch (err) {
      setError(err instanceof Error ? err.message : "โหลดข้อมูลล้มเหลว");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadPayments();
  }, []);

  async function handleAction(id: string, action: PaymentStatus) {
    setUpdatingId(id);
    setError(null);
    try {
      const res = await fetch("/api/admin/payments", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ id, action }),
      });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) {
        throw new Error(data.error || "อัปเดตสถานะไม่สำเร็จ");
      }
      setPayments((prev) =>
        prev.map((p) => (p.id === id ? { ...p, status: action } : p))
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "อัปเดตสถานะล้มเหลว");
    } finally {
      setUpdatingId(null);
    }
  }

  return (
    <main className="min-h-screen bg-[#081120] text-slate-100">
      <div className="mx-auto max-w-6xl px-4 py-8 space-y-6">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold text-white">Admin – Payments</h1>
            <p className="mt-1 text-sm text-slate-300">
              ตรวจคำขอจ่ายเงินผ่าน PromptPay แล้วกดอนุมัติ / ปฏิเสธ
            </p>
          </div>
          <Link
            href="/admin/users"
            className="rounded-2xl border border-slate-700 bg-slate-900/80 px-4 py-2 text-sm font-medium text-slate-100 transition hover:bg-slate-800"
          >
            จัดการ Users
          </Link>
        </header>

        {error ? (
          <div className="rounded-2xl border border-red-900/60 bg-red-950/40 px-4 py-3 text-sm text-red-200">
            {error}
          </div>
        ) : null}

        {loading ? (
          <div className="text-sm text-slate-300">กำลังโหลดรายการ...</div>
        ) : payments.length === 0 ? (
          <div className="rounded-2xl border border-slate-700 bg-slate-950/60 px-4 py-6 text-sm text-slate-300">
            ยังไม่มีคำขอชำระเงิน
          </div>
        ) : (
          <div className="overflow-x-auto rounded-3xl border border-white/10 bg-white/[0.03]">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-900/80 text-left text-xs uppercase tracking-wide text-slate-400">
                <tr>
                  <th className="px-4 py-3">เวลา</th>
                  <th className="px-4 py-3">ชื่อ</th>
                  <th className="px-4 py-3">รพ. / จังหวัด</th>
                  <th className="px-4 py-3">ติดต่อ</th>
                  <th className="px-4 py-3">แพ็กเกจ</th>
                  <th className="px-4 py-3">สลิป</th>
                  <th className="px-4 py-3">สถานะ</th>
                  <th className="px-4 py-3 text-right">การจัดการ</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((p) => (
                  <tr
                    key={p.id}
                    className="border-t border-slate-800/60 bg-slate-950/40 hover:bg-slate-900/60"
                  >
                    <td className="px-4 py-3 align-top text-xs text-slate-400">
                      {new Date(p.createdAt).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 align-top">
                      <div className="font-medium text-slate-100">{p.fullName}</div>
                      <div className="text-xs text-slate-400">
                        DOB: {p.birthDate || "-"}
                      </div>
                    </td>
                    <td className="px-4 py-3 align-top text-xs text-slate-300">
                      <div>{p.hospitalName}</div>
                      <div className="text-slate-400">{p.province}</div>
                    </td>
                    <td className="px-4 py-3 align-top text-xs text-slate-300">
                      <div>{p.phone}</div>
                      <div className="text-slate-400">{p.contactEmail}</div>
                    </td>
                    <td className="px-4 py-3 align-top text-xs text-slate-300">
                      {p.addCredits != null && p.addCredits > 0 ? (
                        <span className="font-semibold text-cyan-300">ซื้อเครดิตเพิ่ม +{p.addCredits}</span>
                      ) : (
                        <div className="font-semibold">
                          {p.planRequested === "add_credits"
                            ? "ซื้อเครดิตเพิ่ม"
                            : p.planRequested === "pro_yearly"
                            ? "Pro Yearly"
                            : formatPlanName(p.planRequested)}
                        </div>
                      )}
                      {p.finalAmount != null ? (
                        <div className="mt-1 text-[11px] text-slate-500">
                          ยอดชำระ {p.finalAmount}฿
                        </div>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 align-top text-xs text-slate-300">
                      <SlipCell paymentId={p.id} />
                    </td>
                    <td className="px-4 py-3 align-top text-xs">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-medium ${
                          p.status === "approved"
                            ? "bg-emerald-500/15 text-emerald-300 border border-emerald-500/40"
                            : p.status === "rejected"
                            ? "bg-red-500/15 text-red-300 border border-red-500/40"
                            : "bg-amber-500/15 text-amber-300 border border-amber-500/40"
                        }`}
                      >
                        {p.status === "pending" || p.status === "awaiting_review" || p.status === "awaiting_slip"
                          ? "รอตรวจ"
                          : p.status === "approved"
                          ? "อนุมัติแล้ว"
                          : "ปฏิเสธ"}
                      </span>
                    </td>
                    <td className="px-4 py-3 align-top">
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          disabled={updatingId === p.id || p.status === "approved"}
                          onClick={() => handleAction(p.id, "approved")}
                          className="rounded-2xl bg-emerald-500/90 px-3 py-1.5 text-xs font-semibold text-white shadow shadow-emerald-900/40 hover:bg-emerald-400 disabled:opacity-50"
                        >
                          {updatingId === p.id ? "กำลังอัปเดต..." : "อนุมัติ"}
                        </button>
                        <button
                          type="button"
                          disabled={updatingId === p.id || p.status === "rejected"}
                          onClick={() => handleAction(p.id, "rejected")}
                          className="rounded-2xl border border-red-500/70 bg-red-950/50 px-3 py-1.5 text-xs font-semibold text-red-100 hover:bg-red-900 disabled:opacity-50"
                        >
                          ปฏิเสธ
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </main>
  );
}

