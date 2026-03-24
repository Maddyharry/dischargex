import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "สมัครสมาชิก DischargeX",
  description: "สมัครบัญชี DischargeX เพื่อเริ่มทดลองใช้งาน",
  alternates: { canonical: "/signup" },
  robots: {
    index: false,
    follow: true,
  },
};

export default function SignupLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return children;
}
