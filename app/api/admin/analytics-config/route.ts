import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export const runtime = "nodejs";

function isAdmin(session: unknown) {
  return (session as { user?: { role?: string } } | null)?.user?.role === "admin";
}

type ConfigCheck = {
  key: "gaMeasurementId" | "googleAdsId" | "googleSiteVerification";
  configured: boolean;
  maskedValue: string | null;
};

function maskValue(raw: string) {
  const value = raw.trim();
  if (!value) return null;
  if (value.length <= 6) return `${value.slice(0, 2)}***`;
  return `${value.slice(0, 4)}***${value.slice(-2)}`;
}

function toCheck(key: ConfigCheck["key"], envValue: string | undefined): ConfigCheck {
  const value = envValue?.trim() || "";
  return {
    key,
    configured: Boolean(value),
    maskedValue: value ? maskValue(value) : null,
  };
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!isAdmin(session)) {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }

  const gaMeasurementId = toCheck("gaMeasurementId", process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID);
  const googleAdsId = toCheck("googleAdsId", process.env.NEXT_PUBLIC_GOOGLE_ADS_ID);
  const googleSiteVerification = toCheck(
    "googleSiteVerification",
    process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION
  );

  const checks = [gaMeasurementId, googleAdsId, googleSiteVerification];
  const warningMessages: string[] = [];

  if (!gaMeasurementId.configured && !googleAdsId.configured) {
    warningMessages.push("Tracking disabled: set NEXT_PUBLIC_GA_MEASUREMENT_ID or NEXT_PUBLIC_GOOGLE_ADS_ID.");
  }
  if (!googleAdsId.configured) {
    warningMessages.push("Conversion tracking disabled: NEXT_PUBLIC_GOOGLE_ADS_ID is missing.");
  }
  if (!googleSiteVerification.configured) {
    warningMessages.push("Search Console verification missing: NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION is not set.");
  }

  return NextResponse.json({
    ok: true,
    checks,
    summary: {
      trackingEnabled: gaMeasurementId.configured || googleAdsId.configured,
      conversionEnabled: googleAdsId.configured,
      siteVerificationEnabled: googleSiteVerification.configured,
      warningCount: warningMessages.length,
    },
    warningMessages,
  });
}
