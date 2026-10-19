import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "เกี่ยวกับ DischargeX — เครื่องมือ AI ช่วยสรุปชาร์จและทบทวน coding",
  description:
    "รู้จัก DischargeX: เครื่องมือช่วยสรุปชาร์จ จัดโครง diagnosis และช่วยทบทวน coding สำหรับทีมแพทย์และเวชระเบียนในโรงพยาบาลไทย",
  alternates: { canonical: "/about" },
  openGraph: {
    title: "เกี่ยวกับ DischargeX",
    description:
      "เครื่องมือ AI ช่วยสรุปชาร์จและทบทวนการจัดโครง coding สำหรับงานเวชระเบียนไทย",
    url: "https://dischargex.net/about",
    siteName: "DischargeX",
    locale: "th_TH",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "เกี่ยวกับ DischargeX",
    description:
      "เครื่องมือ AI ช่วยสรุปชาร์จและช่วยทบทวน coding สำหรับโรงพยาบาลไทย",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function AboutPage() {
  return (
    <main className="min-h-screen bg-[#081120] text-slate-100">
      <div className="mx-auto max-w-3xl px-4 py-12">
        <Link href="/" className="mb-6 inline-block text-sm text-slate-400 hover:text-white">
          ← กลับหน้าแรก
        </Link>
        <h1 className="text-3xl font-semibold tracking-tight text-white">เกี่ยวกับ DischargeX</h1>
        <div className="mt-8 space-y-6 text-sm leading-7 text-slate-300">
          <p>
            DischargeX คือเครื่องมือช่วยสรุปชาร์จและทบทวนการจัดโครง coding สำหรับงานเวชระเบียน
          </p>
          <p>
            ระบบช่วยจัดข้อมูลสำคัญ แยกกลุ่มวินิจฉัย และชี้จุดที่อาจตกหล่น เพื่อประกอบการทบทวน coding
          </p>
          <p>
            DischargeX เป็นเครื่องมือช่วยทบทวน ไม่ใช่ผู้แทนแพทย์หรือ coder และไม่ใช่ระบบจัดกลุ่มอย่างเป็นทางการ
            โปรดตรวจผลกับเวชระเบียนก่อนใช้งานทุกครั้ง
          </p>
          <p>
            ระบบอ้างอิงแนวทางสาธารณะที่เกี่ยวข้อง เช่น ICD-10 และ Thai DRG โดยรายละเอียดแหล่งอ้างอิงและข้อจำกัดอยู่ในประกาศทางกฎหมาย
          </p>
        </div>
        <p className="mt-10 text-sm text-slate-500">
          แนวทางใช้งาน:{" "}
          <Link href="/guidelines" className="text-cyan-400 hover:underline">
            วิธีใช้ DischargeX สำหรับงานสรุปชาร์จและทบทวน ICD-10
          </Link>
          {" · "}
          ราคาและแพ็กเกจ:{" "}
          <Link href="/pricing" className="text-cyan-400 hover:underline">
            ดูแพ็กเกจ DischargeX
          </Link>
        </p>
        <p className="mt-3 text-sm text-slate-500">
          รายละเอียดทางกฎหมายและการอ้างอิง:{" "}
          <Link href="/legal" className="text-cyan-400 hover:underline">
            Reference &amp; Legal Notice
          </Link>
        </p>
      </div>
    </main>
  );
}
