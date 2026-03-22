import Link from "next/link";
import { REFERENCE_SET_NAME, LAST_REVIEWED_DATE } from "@/lib/reference-info";

export function SiteFooter() {
  return (
    <footer className="border-t border-white/10 bg-[#060d18] text-slate-400">
      <div className="mx-auto max-w-6xl px-4 py-10">
        <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-3 text-sm leading-relaxed">
            <div className="text-base font-semibold text-white">DischargeX</div>
            <p lang="th">
              DischargeX เป็นเครื่องมือช่วยสรุปและทบทวน coding
              <br />
              อ้างอิงหลักการจากเอกสารที่เผยแพร่สาธารณะ
              <br />
              ไม่ใช่ระบบจัดกลุ่มอย่างเป็นทางการ และไม่รับประกันผลการเบิกจ่าย
            </p>
          </div>
          <div className="space-y-3 text-sm leading-relaxed">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">English</div>
            <p lang="en">
              DischargeX supports discharge summary drafting and coding review.
              <br />
              Based on publicly available coding principles and reference materials.
              <br />
              Not a statutory grouper; reimbursement outcomes depend on institutional rules and documentation.
            </p>
          </div>
          <div className="space-y-2 text-sm">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">ลิงก์</div>
            <ul className="space-y-2">
              <li>
                <Link href="/about" className="text-cyan-400/90 hover:text-cyan-300 hover:underline">
                  About
                </Link>
              </li>
              <li>
                <Link href="/legal" className="text-cyan-400/90 hover:text-cyan-300 hover:underline">
                  Reference &amp; Legal Notice
                </Link>
              </li>
              <li>
                <Link href="/guidelines" className="text-cyan-400/90 hover:text-cyan-300 hover:underline">
                  แนวทางใช้งาน
                </Link>
              </li>
              <li>
                <Link href="/pricing" className="text-cyan-400/90 hover:text-cyan-300 hover:underline">
                  แพ็กเกจ
                </Link>
              </li>
            </ul>
          </div>
          <div className="space-y-2 text-xs leading-relaxed text-slate-500">
            <div className="font-semibold uppercase tracking-wide text-slate-600">Reference</div>
            <p className="break-words">{REFERENCE_SET_NAME}</p>
            <p>Last reviewed: {LAST_REVIEWED_DATE}</p>
          </div>
        </div>
        <p className="mt-8 border-t border-white/5 pt-6 text-center text-xs text-slate-600">
          © {new Date().getFullYear()} DischargeX
        </p>
      </div>
    </footer>
  );
}
