import Link from "next/link";

export default function Home() {
  return (
    <div className="flex min-h-[calc(100vh-3.5rem)] flex-col items-center justify-center bg-[#081120] px-4 py-16">
      <div className="mx-auto max-w-2xl text-center">
        <h1 className="text-4xl font-bold tracking-tight text-white md:text-5xl">
          Discharge<span className="text-cyan-400">X</span>
        </h1>
        <p className="mt-4 text-lg text-slate-300">
          AI ช่วยสรุป discharge summary จัดกลุ่ม diagnosis และแนะนำ ICD
          สำหรับ workflow ของแพทย์และ coder
        </p>
        <div className="mt-10 flex flex-wrap justify-center gap-4">
          <Link
            href="/login"
            className="rounded-2xl bg-cyan-500 px-6 py-3 text-base font-semibold text-white shadow-lg shadow-cyan-900/30 hover:bg-cyan-600"
          >
            เข้าสู่ระบบ
          </Link>
          <Link
            href="/pricing"
            className="rounded-2xl border border-slate-600 bg-slate-800/80 px-6 py-3 text-base font-medium text-slate-200 hover:bg-slate-700"
          >
            ดูแพ็กเกจ
          </Link>
        </div>
        <p className="mt-6 text-sm text-slate-500">
          ทดลองใช้ฟรี 5 เคส · หลังล็อกอินเข้าไปที่ Workspace เพื่อเริ่มใช้งาน
        </p>
        <p className="mt-2 text-sm text-slate-500">
          <Link href="/guidelines" className="text-cyan-400 hover:underline">
            แนวทางใช้งาน · ข้อจำกัด · การปกปิดความลับผู้ป่วย
          </Link>
        </p>
      </div>
    </div>
  );
}
