import type { Metadata } from "next";

/** Authenticated workspace: do not index clinical/product UI in search engines. */
export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false,
    googleBot: { index: false, follow: false, noimageindex: true },
  },
};

export default function AppWorkspaceLayout({ children }: { children: React.ReactNode }) {
  return children;
}
