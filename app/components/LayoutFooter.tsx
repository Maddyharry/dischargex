"use client";

import { usePathname } from "next/navigation";
import { SiteFooter } from "./SiteFooter";

export function LayoutFooter() {
  const pathname = usePathname();
  if (pathname === "/chat") return null;
  return <SiteFooter />;
}
