import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  getTrialExpiredPolicy,
  setTrialExpiredPolicy,
  type TrialExpiredChatScope,
} from "@/lib/trial-expired-policy";

function isAdmin(session: unknown) {
  return (session as { user?: { role?: string } } | null)?.user?.role === "admin";
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!isAdmin(session)) return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  const policy = await getTrialExpiredPolicy();
  return NextResponse.json({ ok: true, policy });
}

export async function PATCH(req: Request) {
  const session = await getServerSession(authOptions);
  if (!isAdmin(session)) return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });

  const body = (await req.json()) as {
    enabled?: boolean;
    chatScope?: TrialExpiredChatScope;
    allowOpdDemo?: boolean;
    allowSummarize?: boolean;
    forceFastModel?: boolean;
  };

  const next: Record<string, unknown> = {};
  if (typeof body.enabled === "boolean") next.enabled = body.enabled;
  if (body.chatScope === "icd10_only" || body.chatScope === "icd10_guidance") next.chatScope = body.chatScope;
  if (typeof body.allowOpdDemo === "boolean") next.allowOpdDemo = body.allowOpdDemo;
  if (typeof body.allowSummarize === "boolean") next.allowSummarize = body.allowSummarize;
  if (typeof body.forceFastModel === "boolean") next.forceFastModel = body.forceFastModel;

  const policy = await setTrialExpiredPolicy(next);
  return NextResponse.json({ ok: true, policy });
}
