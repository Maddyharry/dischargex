import Link from "next/link";

/** แสดงเมื่อ admin เข้า URL ได้แล้ว แต่ยังไม่เปิด env ฟีเจอร์ — แทนการ 404 แบบเงียบ */
export default function OpdAssistFeatureDisabled() {
  return (
    <main className="min-h-screen bg-[#081120] text-slate-100">
      <div className="mx-auto max-w-lg px-4 py-16 space-y-4">
        <h1 className="text-xl font-semibold text-white">OPD Assist ยังไม่เปิดในเซิร์ฟเวอร์นี้</h1>
        <p className="text-sm leading-relaxed text-slate-400">
          ฟีเจอร์นี้ปิดเป็นค่าเริ่มต้น ต้องตั้ง environment variable เป็น{" "}
          <code className="rounded bg-white/10 px-1 text-emerald-300">true</code> แล้ว{" "}
          <strong className="text-slate-300">รีสตาร์ท dev server</strong> (หยุดแล้วรัน{" "}
          <code className="text-slate-300">npm run dev</code> ใหม่) เพื่อให้ Next โหลดค่าใหม่
        </p>
        <pre className="overflow-x-auto rounded-xl border border-white/10 bg-black/30 p-4 text-left text-xs leading-relaxed text-slate-300">
          {`# ในไฟล์ .env ที่รากโปรเจกต์ (ข้าง package.json)
EXPERIMENTAL_OPD_ASSIST=true

# หรือใช้ชื่อเก่า (ยอมรับเหมือนกัน)
# EXPERIMENTAL_CHART_ASSIST=true`}
        </pre>
        <p className="text-xs text-slate-500">
          ถ้าเข้า /admin ไม่ได้เลย: ต้องล็อกอินด้วยบัญชีที่{" "}
          <code className="text-slate-400">role = admin</code> ในฐานข้อมูล หรือใช้ Admin login ตามที่ตั้งใน env
        </p>
        <Link href="/admin" className="inline-block text-sm text-emerald-400 hover:underline">
          ← กลับหน้า Admin
        </Link>
      </div>
    </main>
  );
}
