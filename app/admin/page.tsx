import Link from "next/link";
import { isChartAssistLabEnabled, isOpdAssistEnabled } from "@/lib/chartAssist/guards";

export default function AdminPage() {
  const showOpdAssist = isOpdAssistEnabled();
  const showChartAssistLab = isChartAssistLabEnabled();

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
          {!showOpdAssist ? (
            <section className="rounded-2xl border border-amber-500/25 bg-amber-500/5 p-5">
              <h2 className="font-medium text-amber-100">OPD Assist (ปิดอยู่)</h2>
              <p className="mt-2 text-sm text-amber-200/80">
                ถ้าต้องการเปิด Lab / บันทึกการทดสอบ ให้ใส่ในไฟล์{" "}
                <code className="rounded bg-black/20 px-1 text-xs">.env</code> แล้วรีสตาร์ทเซิร์ฟเวอร์:
              </p>
              <pre className="mt-3 overflow-x-auto rounded-lg border border-amber-500/20 bg-black/20 p-3 text-left text-xs text-amber-100/90">
                EXPERIMENTAL_OPD_ASSIST=true
              </pre>
              <p className="mt-2 text-xs text-amber-200/60">
                หรือ <code className="text-amber-100/90">EXPERIMENTAL_CHART_ASSIST=true</code> ก็ได้
              </p>
            </section>
          ) : null}
          {showChartAssistLab ? (
            <Link
              href="/admin/chart-assist-lab"
              className="block rounded-2xl border border-cyan-500/20 bg-cyan-500/5 p-5 text-slate-100 transition hover:bg-cyan-500/10"
            >
              <span className="font-medium">Chart Assist Lab (V1)</span>
              <p className="mt-1 text-sm text-slate-400">
                Admin experimental — case timeline + pure rule engine (no LLM)
              </p>
              <p className="mt-2 font-mono text-[11px] text-cyan-400/80">
                EXPERIMENTAL_CHART_ASSIST=true · /admin/chart-assist-lab
              </p>
            </Link>
          ) : null}
          {showOpdAssist ? (
            <>
              <Link
                href="/admin/opd-assist-lab"
                className="block rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-5 text-slate-100 transition hover:bg-emerald-500/10"
              >
                <span className="font-medium">OPD Assist Lab</span>
                <p className="mt-1 text-sm text-slate-400">
                  ทดลอง admin-only — structured rules + Thai-first references
                </p>
                <p className="mt-2 font-mono text-[11px] text-emerald-400/80">/admin/opd-assist-lab</p>
              </Link>
              <Link
                href="/admin/opd-assist-logs"
                className="block rounded-2xl border border-white/10 bg-white/[0.04] p-5 text-slate-100 transition hover:bg-white/[0.08]"
              >
                <span className="font-medium">บันทึกการทดสอบ OPD Assist</span>
                <p className="mt-1 text-sm text-slate-400">
                  ดูประวัติ Analyze / ข้อผิดพลาด เพื่อวิเคราะห์คุณภาพ
                </p>
              </Link>
            </>
          ) : null}
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
