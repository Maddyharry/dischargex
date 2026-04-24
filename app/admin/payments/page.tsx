import Link from "next/link";

export default function AdminPaymentsPage() {
  return (
    <main className="min-h-screen bg-[#081120] text-slate-100">
      <div className="mx-auto max-w-6xl px-4 py-8 space-y-6">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold text-white">Admin – Payments</h1>
            <p className="mt-1 text-sm text-slate-300">
              สถานะการชำระเงิน—ปัจจุบันดำเนินการผ่าน Stripe อัตโนมัติ
            </p>
          </div>
          <Link
            href="/admin/users"
            className="rounded-2xl border border-slate-700 bg-slate-900/80 px-4 py-2 text-sm font-medium text-slate-100 transition hover:bg-slate-800"
          >
            จัดการ Users
          </Link>
        </header>

        <div className="rounded-2xl border border-slate-700 bg-slate-950/60 px-4 py-6 text-sm text-slate-300">
          ระบบชำระเงินแบบโอนสลิปและอนุมัติเองถูกปิดใช้งานแล้ว
          <br />
          ตอนนี้ใช้ Stripe subscription + webhook อัตโนมัติทั้งหมด
        </div>
      </div>
    </main>
  );
}

