"use client";

import { useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";

type PackageId = "ebook_only" | "full_bundle";

type CheckoutResponse = {
  ok: boolean;
  error?: string;
  orderId?: string;
  package?: {
    id: PackageId;
    label: string;
    priceThb: number;
  };
  qrImageUrl?: string | null;
  qrText?: string | null;
  paymentUrl?: string | null;
};

type OrderStatus = {
  ok: boolean;
  error?: string;
  orderId?: string;
  status?: string;
  productId?: string;
  amountThb?: number;
  paidAt?: string | null;
  downloadUrl?: string | null;
};

const packages: Array<{
  id: PackageId;
  name: string;
  price: number;
  description: string;
  bullets: string[];
}> = [
  {
    id: "ebook_only",
    name: "Ebook Only",
    price: 199,
    description: "เหมาะสำหรับคนที่อยากเริ่มอ่านคู่มือหลักก่อน",
    bullets: ["AI-Sales-Kit-Ebook.pdf", "อ่านบนมือถือได้", "ใช้เริ่มต้นได้ทันที"],
  },
  {
    id: "full_bundle",
    name: "Full Bundle",
    price: 299,
    description: "คุ้มสุด ได้ Ebook + Prompt + Bonus + Excel คำนวณกำไร",
    bullets: [
      "Ebook หลัก",
      "Prompt Pack PDF",
      "Content Calendar 30 วัน",
      "FAQ + LINE OA Script",
      "Excel คำนวณกำไรพร้อมสูตร",
    ],
  },
];

export function AiSalesKitCheckout({
  initialOrderId = "",
  mode = "checkout",
}: {
  initialOrderId?: string;
  mode?: "checkout" | "status";
}) {
  const [selectedPackage, setSelectedPackage] = useState<PackageId>("full_bundle");
  const [customerName, setCustomerName] = useState("");
  const [email, setEmail] = useState("");
  const [lineId, setLineId] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<CheckoutResponse | null>(null);
  const [status, setStatus] = useState<OrderStatus | null>(null);
  const [qrFallbackImage, setQrFallbackImage] = useState("");
  const [error, setError] = useState("");

  const selected = useMemo(
    () => packages.find((item) => item.id === selectedPackage) ?? packages[1],
    [selectedPackage],
  );
  const resultAmount = result?.package?.priceThb ?? selected.price;

  async function submitCheckout() {
    setLoading(true);
    setError("");
    setResult(null);
    try {
      const res = await fetch("/api/ai-sales-kit/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId: selectedPackage,
          packageId: selectedPackage,
          name: customerName,
          email,
          lineId,
        }),
      });
      const data = (await res.json()) as CheckoutResponse;
      if (!res.ok || !data.ok) {
        throw new Error(data.error || "สร้าง QR payment ไม่สำเร็จ");
      }
      setResult(data);
      if (data.orderId) {
        await refreshStatus(data.orderId);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "เกิดข้อผิดพลาด กรุณาลองใหม่");
    } finally {
      setLoading(false);
    }
  }

  async function refreshStatus(orderId: string) {
    if (!orderId) return;
    const res = await fetch(`/api/ai-sales-kit/status/${encodeURIComponent(orderId)}`, {
      cache: "no-store",
    });
    const data = (await res.json()) as OrderStatus;
    setStatus(data);
  }

  useEffect(() => {
    if (!initialOrderId) return;
    void refreshStatus(initialOrderId);
    const timer = window.setInterval(() => {
      void refreshStatus(initialOrderId);
    }, 5000);
    return () => window.clearInterval(timer);
  }, [initialOrderId]);

  useEffect(() => {
    const rawQr = result?.qrText?.trim();
    if (!rawQr || result?.qrImageUrl) {
      setQrFallbackImage("");
      return;
    }
    let cancelled = false;
    QRCode.toDataURL(rawQr, { margin: 1, width: 320 })
      .then((dataUrl) => {
        if (!cancelled) setQrFallbackImage(dataUrl);
      })
      .catch(() => {
        if (!cancelled) setQrFallbackImage("");
      });
    return () => {
      cancelled = true;
    };
  }, [result?.qrImageUrl, result?.qrText]);

  if (mode === "status") {
    return (
      <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-5 shadow-2xl shadow-black/20 md:p-7">
        <h2 className="text-2xl font-semibold text-white">สถานะคำสั่งซื้อ</h2>
        {!initialOrderId ? (
          <p className="mt-4 rounded-xl bg-red-500/15 p-3 text-sm text-red-100">ไม่พบ order id</p>
        ) : null}
        {status ? (
          <div className="mt-5 space-y-4">
            <p className="rounded-xl bg-white/10 p-3 text-sm text-slate-100">
              Order: {status.orderId || initialOrderId} · สถานะ: {status.status || "-"} · ยอด{" "}
              {status.amountThb || "-"} บาท
            </p>
            {status.downloadUrl ? (
              <a
                href={status.downloadUrl}
                className="block rounded-2xl bg-orange-400 px-4 py-3 text-center font-bold text-slate-950"
              >
                ดาวน์โหลดไฟล์
              </a>
            ) : (
              <p className="rounded-xl border border-white/10 p-3 text-sm text-slate-300">
                ถ้าชำระเงินแล้วแต่ยังไม่ขึ้นลิงก์ ระบบกำลังรอ webhook จาก payment provider
              </p>
            )}
          </div>
        ) : (
          <p className="mt-4 text-sm text-slate-300">กำลังโหลดสถานะ...</p>
        )}
      </div>
    );
  }

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[1.1fr_0.9fr]">
      <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-5 shadow-2xl shadow-black/20 md:p-7">
        <h2 className="text-2xl font-semibold text-white">เลือกแพ็ก</h2>
        <div className="mt-5 grid gap-4">
          {packages.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setSelectedPackage(item.id)}
              className={`rounded-2xl border p-5 text-left transition ${
                selectedPackage === item.id
                  ? "border-orange-300 bg-orange-400/15"
                  : "border-white/10 bg-white/[0.03] hover:border-white/25"
              }`}
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-lg font-semibold text-white">{item.name}</p>
                  <p className="mt-1 text-sm leading-relaxed text-slate-300">{item.description}</p>
                </div>
                <p className="rounded-full bg-white px-4 py-1.5 text-sm font-bold text-slate-950">
                  {item.price} บาท
                </p>
              </div>
              <ul className="mt-4 grid gap-2 text-sm text-slate-200 sm:grid-cols-2">
                {item.bullets.map((bullet) => (
                  <li key={bullet} className="flex gap-2">
                    <span className="text-orange-300">✓</span>
                    <span>{bullet}</span>
                  </li>
                ))}
              </ul>
            </button>
          ))}
        </div>

        <div className="mt-6 grid gap-4">
          <label className="grid gap-2 text-sm font-medium text-slate-200">
            ชื่อผู้ซื้อ
            <input
              value={customerName}
              onChange={(event) => setCustomerName(event.target.value)}
              style={{ WebkitTextFillColor: "#ffffff" }}
              className="rounded-xl border border-white/10 bg-slate-950/70 px-4 py-3 text-white outline-none focus:border-orange-300"
              placeholder="เช่น คุณเอ"
            />
          </label>
          <label className="grid gap-2 text-sm font-medium text-slate-200">
            Email สำหรับรับไฟล์
            <input
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              style={{ WebkitTextFillColor: "#ffffff" }}
              className="rounded-xl border border-white/10 bg-slate-950/70 px-4 py-3 text-white outline-none focus:border-orange-300"
              placeholder="name@example.com"
              type="email"
            />
          </label>
          <label className="grid gap-2 text-sm font-medium text-slate-200">
            LINE ID (ไม่บังคับ)
            <input
              value={lineId}
              onChange={(event) => setLineId(event.target.value)}
              style={{ WebkitTextFillColor: "#ffffff" }}
              className="rounded-xl border border-white/10 bg-slate-950/70 px-4 py-3 text-white outline-none focus:border-orange-300"
              placeholder="@yourline"
            />
          </label>
        </div>

        {error ? <p className="mt-4 rounded-xl bg-red-500/15 p-3 text-sm text-red-100">{error}</p> : null}

        <button
          type="button"
          onClick={submitCheckout}
          disabled={loading}
          className="mt-6 w-full rounded-2xl bg-orange-400 px-6 py-4 text-base font-bold text-slate-950 transition hover:bg-orange-300 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? "กำลังสร้าง QR..." : `สร้าง QR ชำระเงิน ${selected.price} บาท`}
        </button>
      </div>

      <div
        className={`rounded-3xl border border-white/10 bg-slate-950/60 p-5 md:p-7 ${
          result ? "block" : "hidden lg:block"
        }`}
      >
        <h2 className="text-2xl font-semibold text-white">QR Payment</h2>
        {!result ? (
          <div className="mt-5 rounded-2xl border border-dashed border-white/20 p-6 text-sm leading-relaxed text-slate-300">
            กรอกข้อมูลแล้วกดสร้าง QR ระบบจะสร้าง order ผ่าน Opn Payments และรอ webhook เพื่อส่งไฟล์อัตโนมัติ
          </div>
        ) : (
          <div className="mt-5 space-y-4">
            <p className="rounded-xl bg-emerald-400/10 p-3 text-sm text-emerald-100">
              Order: {result.orderId} · ยอด {resultAmount} บาท
            </p>
            {result.qrImageUrl || qrFallbackImage ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={result.qrImageUrl || qrFallbackImage}
                alt="PromptPay QR"
                className="mx-auto max-h-72 rounded-2xl bg-white p-4"
              />
            ) : null}
            {result.paymentUrl ? (
              <a
                href={result.paymentUrl}
                target="_blank"
                rel="noreferrer"
                className="block rounded-2xl border border-orange-300 px-4 py-3 text-center font-semibold text-orange-100"
              >
                เปิดหน้าชำระเงิน
              </a>
            ) : null}
            {result.orderId ? (
              <a
                href={`/ai-sales-kit/success?order=${encodeURIComponent(result.orderId)}`}
                className="block rounded-2xl bg-white px-4 py-3 text-center font-semibold text-slate-950"
              >
                จ่ายแล้ว กดตรวจสถานะ/รับไฟล์
              </a>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}
