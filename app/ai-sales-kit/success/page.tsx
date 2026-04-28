import Link from "next/link";

import { AiSalesKitCheckout } from "../AiSalesKitCheckout";

export const metadata = {
  title: "AI Sales Kit | Payment Status",
  description: "ตรวจสถานะการชำระเงินและดาวน์โหลด AI Sales Kit",
};

export default async function AiSalesKitSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ order?: string }>;
}) {
  const params = await searchParams;
  const orderId = params.order?.trim() || "";

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-10 text-slate-100">
      <div className="mx-auto max-w-3xl">
        <Link href="/ai-sales-kit" className="text-sm font-semibold text-orange-200 hover:text-orange-100">
          ← กลับหน้าสินค้า
        </Link>
        <section className="mt-6 rounded-[2rem] border border-white/10 bg-white/[0.06] p-6 shadow-2xl shadow-black/30 md:p-8">
          <p className="text-sm font-bold uppercase tracking-[0.2em] text-orange-200">Payment status</p>
          <h1 className="mt-3 text-3xl font-black tracking-tight text-white md:text-5xl">
            ตรวจสถานะและรับไฟล์อัตโนมัติ
          </h1>
          <p className="mt-4 text-slate-300">
            ถ้าชำระเงินสำเร็จแล้ว ระบบจะแสดงลิงก์ดาวน์โหลดให้ทันที ถ้ายังไม่ขึ้น ให้รอประมาณ 10-30 วินาที
            เพราะบางธนาคารใช้เวลาส่งผลชำระเงินกลับมาที่ระบบ
          </p>
        </section>

        <div className="mt-6">
          <AiSalesKitCheckout initialOrderId={orderId} mode="status" />
        </div>
      </div>
    </main>
  );
}
