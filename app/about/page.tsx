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
        <h1 className="text-3xl font-semibold tracking-tight text-white">About DischargeX</h1>
        <div className="mt-8 space-y-6 text-sm leading-7 text-slate-300">
          <p>
            DischargeX คือเครื่องมือช่วยสรุปชาร์จและทบทวนการจัดโครง coding สำหรับงานเวชระเบียน
          </p>
          <p>
            ระบบช่วยดึงข้อมูลสำคัญจากข้อความในเวชระเบียน, จัดกลุ่มวินิจฉัยตามบทบาท, ค้นหารายการที่อาจตกหล่น
            และช่วยประเมินผลต่อการ coding review และ AdjRW แบบประมาณการ เพื่อให้ผู้ใช้งานทำงานได้เร็วขึ้นและเป็นระบบมากขึ้น
          </p>
          <p>
            DischargeX ถูกออกแบบให้เป็นเครื่องมือช่วยตัดสินใจ ไม่ใช่ผู้แทนแพทย์ ไม่ใช่ผู้แทน coder
            และไม่ใช่ระบบจัดกลุ่มอย่างเป็นทางการ ผู้ใช้งานควรทบทวนผลลัพธ์ร่วมกับข้อมูลในเวชระเบียนทุกครั้งก่อนนำไปใช้งานจริง
          </p>
          <p>
            ระบบพัฒนาตามหลักการจากเอกสารอ้างอิงที่เผยแพร่สาธารณะ เช่น ICD-10, Thai DRG และแนวทาง coding ที่เกี่ยวข้อง
            โดยมีการระบุชุดอ้างอิงและเวอร์ชันที่ใช้งานในระบบ เพื่อให้ตรวจสอบย้อนหลังได้
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
