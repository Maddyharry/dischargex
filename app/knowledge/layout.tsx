import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Clinical Knowledge References | DischargeX",
  description:
    "ค้นหาแนวทางสรุปเวชระเบียนพร้อมตัวอย่างจากเอกสารมาตรฐาน (CODING AUDIT, MRA, Peer Review, สปสช.) เพื่อช่วยตรวจทานการลง diagnosis และ ICD ให้สอดคล้องหลักเกณฑ์.",
  keywords: [
    "Discharge summary",
    "ICD-10",
    "Clinical coding",
    "CODING AUDIT 2562",
    "MRA 2563",
    "NHSO",
    "เวชระเบียน",
    "DRG",
  ],
  openGraph: {
    title: "Clinical Knowledge References | DischargeX",
    description:
      "ตัวอย่างจากเอกสารจริงสำหรับตรวจทาน diagnosis และ ICD ในงานสรุปเวชระเบียน",
    type: "website",
    url: "https://dischargex.net/knowledge",
  },
  alternates: {
    canonical: "https://dischargex.net/knowledge",
  },
};

export default function KnowledgeLayout({ children }: { children: ReactNode }) {
  return children;
}

