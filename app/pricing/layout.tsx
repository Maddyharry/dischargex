import type { Metadata } from "next";
import { getSeoCopy } from "@/lib/seo-variants";

const seo = getSeoCopy("pricing");
const title = seo.title;
const description = seo.description;

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: "/pricing" },
  openGraph: {
    title,
    description,
    url: "https://dischargex.net/pricing",
    siteName: "DischargeX",
    locale: "th_TH",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function PricingLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return children;
}
