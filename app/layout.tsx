import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "./providers";
import { LayoutHeader } from "./components/LayoutHeader";
import { FeedbackProvider } from "./context/FeedbackContext";
import { FeedbackWidget } from "./components/FeedbackWidget";
import { LayoutFooter } from "./components/LayoutFooter";
import { WebAnalyticsTracker } from "./components/WebAnalyticsTracker";

export const metadata: Metadata = {
  metadataBase: new URL("https://dischargex.net"),
  title: {
    default: "DischargeX",
    template: "%s | DischargeX",
  },
  description:
    "เครื่องมือช่วยสรุป discharge summary และทบทวนการจัดโครง coding (ICD-10 / Thai DRG) สำหรับแพทย์และผู้รับผิดชอบเวชระเบียนโรงพยาบาลไทย — ไม่ใช่การจัดกลุ่มอย่างเป็นทางการ",
  keywords: [
    "Discharge summary",
    "ICD-10",
    "Thai DRG",
    "เวชระเบียน",
    "สรุปชาร์จ",
    "medical coding",
    "coding review",
  ],
  openGraph: {
    siteName: "DischargeX",
    locale: "th_TH",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="th" suppressHydrationWarning>
      <body className="bg-slate-50 text-slate-900 antialiased dark:bg-slate-950 dark:text-slate-50">
        <Providers>
          <FeedbackProvider>
            <WebAnalyticsTracker />
            <LayoutHeader />
            {children}
            <LayoutFooter />
            <FeedbackWidget />
          </FeedbackProvider>
        </Providers>
      </body>
    </html>
  );
}