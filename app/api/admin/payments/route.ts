import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export const runtime = "nodejs";

function isAdmin(session: unknown) {
  return (session as { user?: { role?: string } } | null)?.user?.role === "admin";
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!isAdmin(session)) {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }
  return NextResponse.json(
    { ok: false, error: "Legacy manual payment approval is disabled (Stripe webhook only)." },
    { status: 410 }
  );
}

export async function POST(req: Request) {
  void req;
  const session = await getServerSession(authOptions);
  if (!isAdmin(session)) {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }

  return NextResponse.json(
    { ok: false, error: "Legacy manual payment approval is disabled (Stripe webhook only)." },
    { status: 410 }
  );
}

