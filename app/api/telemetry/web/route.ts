import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { trackTelemetry } from "@/lib/telemetry";

export const runtime = "nodejs";

const ALLOWED_EVENTS = new Set(["page_view", "page_leave", "cta_click", "ab_variant_assigned"]);

function normalizePath(raw: unknown) {
  const path = String(raw || "/").trim();
  if (!path.startsWith("/")) return "/";
  return path.length > 180 ? path.slice(0, 180) : path;
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      event?: string;
      path?: string;
      durationMs?: number;
      visitorId?: string;
      sessionId?: string;
      ctaKey?: string;
      href?: string;
      abTest?: string;
      abVariant?: string;
    };
    const event = String(body.event || "").trim().toLowerCase();
    if (!ALLOWED_EVENTS.has(event)) {
      return NextResponse.json({ ok: false, error: "Invalid event" }, { status: 400 });
    }

    const path = normalizePath(body.path);
    const durationMsRaw = Number(body.durationMs || 0);
    const durationMs = Number.isFinite(durationMsRaw) ? Math.max(0, Math.min(durationMsRaw, 12 * 60 * 60 * 1000)) : 0;
    const visitorId = String(body.visitorId || "").slice(0, 80);
    const sessionId = String(body.sessionId || "").slice(0, 80);
    const ctaKey = String(body.ctaKey || "").slice(0, 120);
    const href = String(body.href || "").slice(0, 300);
    const abTest = String(body.abTest || "").slice(0, 80);
    const abVariant = String(body.abVariant || "").slice(0, 24);

    const session = await getServerSession(authOptions);
    const userId = (session?.user as { id?: string } | undefined)?.id ?? null;

    await trackTelemetry({
      userId,
      source: "web",
      event,
      payload: {
        path,
        durationMs,
        visitorId: visitorId || null,
        sessionId: sessionId || null,
        ctaKey: ctaKey || null,
        href: href || null,
        abTest: abTest || null,
        abVariant: abVariant || null,
      },
    });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false, error: "Bad request" }, { status: 400 });
  }
}
