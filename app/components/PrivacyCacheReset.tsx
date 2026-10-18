import Script from "next/script";

export function PrivacyCacheReset() {
  return <Script src="/privacy-reset-sw.js" strategy="beforeInteractive" />;
}
