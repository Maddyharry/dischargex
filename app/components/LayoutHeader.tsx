"use client";

import { usePathname } from "next/navigation";
import { Header } from "./Header";

export function LayoutHeader() {
  const pathname = usePathname();
  if (pathname === "/chat") return null;
  return <Header />;
}
