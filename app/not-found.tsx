import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[#081120] px-4 text-slate-100">
      <h1 className="text-2xl font-semibold text-white">ไม่พบหน้าที่ต้องการ</h1>
      <p className="text-sm text-slate-400">หน้าที่คุณเข้าหาอาจถูกลบหรือ URL ผิด</p>
      <Link
        href="/"
        className="rounded-xl border border-cyan-500/50 bg-cyan-500/10 px-4 py-2 text-sm font-medium text-cyan-200 transition hover:bg-cyan-500/20"
      >
        กลับหน้าแรก
      </Link>
    </main>
  );
}
