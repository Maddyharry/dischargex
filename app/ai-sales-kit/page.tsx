import type { Metadata } from "next";
import { AiSalesKitCheckout } from "./AiSalesKitCheckout";

export const metadata: Metadata = {
  title: "AI Sales Kit สำหรับแม่ค้าออนไลน์",
  description:
    "ซื้อ AI Sales Kit สำหรับแม่ค้าออนไลน์ เลือก Ebook 199 บาท หรือ Bundle 299 บาท พร้อม Prompt, Bonus และไฟล์คำนวณกำไร",
};

const bundleItems = [
  "AI-Sales-Kit-Ebook.pdf",
  "Prompt-Pack.pdf",
  "Content-Calendar-30-Days.pdf",
  "FAQ-Template.pdf",
  "Profit-Calculator-Formula.xlsx",
  "LINE-OA-Reply-Script.pdf",
  "Ad-Testing-Plan.pdf",
  "Launch-Checklist.pdf",
];

export default function AiSalesKitPage() {
  return (
    <main className="min-h-screen bg-[#101322] text-white">
      <section className="relative overflow-hidden px-4 py-12 sm:px-6 lg:px-8">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(249,115,22,0.3),transparent_32%),linear-gradient(135deg,#111827_0%,#3b2f8f_50%,#6d28d9_100%)]" />
        <div className="relative mx-auto grid max-w-6xl gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
          <div>
            <p className="inline-flex rounded-full border border-white/20 bg-white/10 px-4 py-1.5 text-sm font-semibold text-orange-100">
              Digital Product สำหรับแม่ค้าออนไลน์
            </p>
            <h1 className="mt-6 text-4xl font-black tracking-tight sm:text-6xl">
              ใช้ AI ช่วยตอบแชท คิดโพสต์ และปิดการขาย
            </h1>
            <p className="mt-5 max-w-2xl text-lg leading-8 text-white/82">
              เลือกซื้อ Ebook อย่างเดียว 199 บาท หรือ Bundle ครบชุด 299 บาท พร้อมไฟล์ PDF/XLSX ที่เปิดใช้งานง่ายบนมือถือและคอม
            </p>
            <div className="mt-8 grid gap-3 sm:grid-cols-3">
              {["จ่ายผ่าน QR", "ส่งไฟล์อัตโนมัติ", "มี Excel สูตรกำไร"].map((label) => (
                <div key={label} className="rounded-2xl border border-white/15 bg-white/10 p-4 text-sm font-bold">
                  {label}
                </div>
              ))}
            </div>
          </div>
          <AiSalesKitCheckout />
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid gap-6 md:grid-cols-2">
          <div className="rounded-3xl border border-white/10 bg-white/[0.06] p-6">
            <h2 className="text-2xl font-black">Ebook Only 199 บาท</h2>
            <p className="mt-3 text-white/75">
              เหมาะกับคนที่อยากอ่านคู่มือหลักก่อน ได้ไฟล์ `AI-Sales-Kit-Ebook.pdf`
            </p>
          </div>
          <div className="rounded-3xl border border-orange-300/35 bg-orange-400/10 p-6">
            <h2 className="text-2xl font-black">Full Bundle 299 บาท</h2>
            <p className="mt-3 text-white/75">
              เหมาะกับคนที่อยากได้ไฟล์พร้อมใช้ครบชุด รวม Prompt, Calendar, FAQ, Excel และ Bonus
            </p>
            <ul className="mt-5 grid gap-2 text-sm text-white/85 sm:grid-cols-2">
              {bundleItems.map((item) => (
                <li key={item} className="rounded-xl bg-white/8 px-3 py-2">
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>
    </main>
  );
}
