import type { Metadata } from "next";
import { getSeoCopy } from "@/lib/seo-variants";

const seo = getSeoCopy("guidelines");
const title = seo.title;
const description = seo.description;

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: "/guidelines" },
  openGraph: {
    title,
    description,
    url: "https://dischargex.net/guidelines",
    siteName: "DischargeX",
    locale: "th_TH",
    type: "article",
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

export default function GuidelinesLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return children;
}
