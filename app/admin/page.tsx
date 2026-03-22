import Link from "next/link";

export default function AdminPage() {
  return (
    <main className="min-h-screen bg-[#081120] text-slate-100">
      <div className="mx-auto max-w-2xl px-4 py-16 space-y-8">
        <h1 className="text-2xl font-semibold text-white">Admin</h1>
        <div className="grid gap-4">
          <Link
            href="/admin/payments"
            className="block rounded-2xl border border-white/10 bg-white/[0.04] p-5 text-slate-100 transition hover:bg-white/[0.08]"
          >
            <span className="font-medium">คำขอชำระเงิน</span>
            <p className="mt-1 text-sm text-slate-400">
              ตรวจสลิป PromptPay อนุมัติ/ปฏิเสธ
            </p>
          </Link>
          <Link
            href="/admin/users"
            className="block rounded-2xl border border-white/10 bg-white/[0.04] p-5 text-slate-100 transition hover:bg-white/[0.08]"
          >
            <span className="font-medium">จัดการ Users</span>
            <p className="mt-1 text-sm text-slate-400">
              เปลี่ยนแผน / สิทธิ์ admin
            </p>
          </Link>
          <Link
            href="/admin/feedback"
            className="block rounded-2xl border border-white/10 bg-white/[0.04] p-5 text-slate-100 transition hover:bg-white/[0.08]"
          >
            <span className="font-medium">แจ้งข้อผิดพลาด & แชทลูกค้า</span>
            <p className="mt-1 text-sm text-slate-400">
              ดูรายการแชทและรายงานข้อผิดพลาดที่ลูกค้าส่งมา
            </p>
          </Link>
        </div>

        <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
          <h2 className="text-lg font-semibold text-white">Reference Update Policy</h2>
          <p className="mt-3 text-sm leading-relaxed text-slate-300">
            ระบบนี้ใช้ชุดอ้างอิงแบบกำหนดเวอร์ชัน เพื่อให้ตรวจสอบย้อนหลังได้ว่า logic ของแต่ละช่วงเวลาอ้างอิงเอกสารชุดใด
          </p>
          <p className="mt-3 text-sm font-medium text-slate-200">เมื่อมีการปรับปรุงเอกสารอ้างอิง ระบบจะอัปเดตผ่านขั้นตอนดังนี้:</p>
          <ul className="mt-3 list-inside list-disc space-y-2 text-sm text-slate-400">
            <li>ตรวจพบเอกสารหรือเวอร์ชันใหม่</li>
            <li>นำเข้าเข้าสภาพแวดล้อมทดสอบ</li>
            <li>เปรียบเทียบกฎเดิมกับกฎใหม่</li>
            <li>ทดสอบกับชุดเคสย้อนหลัง</li>
            <li>ตรวจทานผลกระทบก่อนเปิดใช้งานจริง</li>
            <li>เผยแพร่พร้อมหมายเลขเวอร์ชันใหม่ของ reference set</li>
          </ul>
        </section>
      </div>
    </main>
  );
}
