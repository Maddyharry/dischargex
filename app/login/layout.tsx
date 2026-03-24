import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "เข้าสู่ระบบ DischargeX",
  description: "เข้าสู่ระบบเพื่อใช้งาน DischargeX workspace",
  alternates: { canonical: "/login" },
  robots: {
    index: false,
    follow: true,
  },
};

export default function LoginLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return children;
}
