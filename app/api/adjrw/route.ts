import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { calcAdjRwFromDrg } from "@/lib/tdrg";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body" }, { status: 400 });
  }

  const drgCode = String((body as { drgCode?: unknown } | null)?.drgCode ?? "").trim();
  const losDaysRaw = (body as { losDays?: unknown } | null)?.losDays;
  const losDays = typeof losDaysRaw === "number" ? losDaysRaw : Number(losDaysRaw);

  if (!drgCode) {
    return NextResponse.json({ ok: false, error: "Missing drgCode" }, { status: 400 });
  }
  if (!Number.isFinite(losDays) || losDays < 0) {
    return NextResponse.json({ ok: false, error: "Invalid losDays" }, { status: 400 });
  }

  const r = calcAdjRwFromDrg(drgCode, losDays);
  if (!r.ok) {
    return NextResponse.json({ ok: false, error: r.details }, { status: 404 });
  }

  return NextResponse.json({
    ok: true,
    drgCode,
    losDays,
    baseRw: r.baseRw,
    adjrw: r.adjrw,
    caseType: r.caseType,
    details: r.details,
  });
}

