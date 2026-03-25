import type { Metadata } from "next";

/**
 * Admin routes must not appear in Google (or other) search results.
 * Complements robots.txt Disallow and reduces leakage if URLs are ever exposed.
 */
export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false,
    googleBot: {
      index: false,
      follow: false,
      noimageindex: true,
    },
  },
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return children;
}
