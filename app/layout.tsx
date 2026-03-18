import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "./providers";
import { Header } from "./components/Header";
import { FeedbackProvider } from "./context/FeedbackContext";
import { FeedbackWidget } from "./components/FeedbackWidget";

export const metadata: Metadata = {
  title: "DischargeX",
  description: "Discharge summary workspace",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="th" suppressHydrationWarning>
      <body className="bg-slate-50 text-slate-900 antialiased dark:bg-slate-950 dark:text-slate-50">
        <Providers>
          <FeedbackProvider>
            <Header />
            {children}
            <FeedbackWidget />
          </FeedbackProvider>
        </Providers>
      </body>
    </html>
  );
}