"use client";

import Script from "next/script";
import { usePathname } from "next/navigation";
import { useEffect } from "react";

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

const GA_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID?.trim() || "";
const ADS_ID = process.env.NEXT_PUBLIC_GOOGLE_ADS_ID?.trim() || "";
const TAG_ID = GA_ID || ADS_ID;

export function GoogleTag() {
  const pathname = usePathname();

  useEffect(() => {
    if (!TAG_ID || typeof window === "undefined" || typeof window.gtag !== "function") return;
    const pagePath = pathname || "/";
    window.gtag("event", "page_view", {
      page_path: pagePath,
      page_location: window.location.href,
      send_to: GA_ID || ADS_ID,
    });
  }, [pathname]);

  if (!TAG_ID) return null;

  return (
    <>
      <Script src={`https://www.googletagmanager.com/gtag/js?id=${TAG_ID}`} strategy="afterInteractive" />
      <Script
        id="google-tag-init"
        strategy="afterInteractive"
        dangerouslySetInnerHTML={{
          __html: `
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            window.gtag = gtag;
            gtag('js', new Date());
            ${GA_ID ? `gtag('config', '${GA_ID}', { send_page_view: false });` : ""}
            ${ADS_ID ? `gtag('config', '${ADS_ID}');` : ""}
          `,
        }}
      />
    </>
  );
}

