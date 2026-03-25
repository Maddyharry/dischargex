import { NextResponse } from "next/server";
import type { Session } from "next-auth";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isOpdAssistEnabled, isAdminSession } from "@/lib/chartAssist/guards";
import { analyzeOpdCase } from "@/lib/chartAssist/analyzeCase";
import type { AssistMode } from "@/lib/chartAssist/cardTypes";

export const runtime = "nodejs";

const bodySchema = z.object({
  rawText: z.string(),
  modeOverride: z.enum(["OPD", "ER", "TRAUMA"]).nullable().optional(),
  caseId: z.string().max(128).optional(),
  source: z.enum(["analyze", "demo"]).optional(),
  demoKey: z.string().max(64).optional(),
});

const PREVIEW_MAX = 500;
const ERR_MSG_MAX = 2000;

async function resolveUserId(session: Session | null): Promise<string | null> {
  const email = session?.user?.email;
  if (!email) return null;
  const u = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  return u?.id ?? null;
}

async function logOpdAssistLab(data: {
  userId: string;
  rawText: string;
  caseId?: string | null;
  source: string;
  demoKey?: string | null;
  mode: string | null;
  modeOverride: AssistMode | null;
  ok: boolean;
  errorMessage?: string | null;
  cardIdsJson?: string | null;
  ruleVersion?: string | null;
}) {
  try {
    await prisma.opdAssistLabLog.create({
      data: {
        userId: data.userId,
        caseId: data.caseId ?? null,
        source: data.source,
        demoKey: data.demoKey ?? null,
        mode: data.mode,
        modeOverride: data.modeOverride,
        textLength: data.rawText.length,
        textPreview: data.rawText.slice(0, PREVIEW_MAX) || null,
        ok: data.ok,
        errorMessage: data.errorMessage ? data.errorMessage.slice(0, ERR_MSG_MAX) : null,
        cardIds: data.cardIdsJson ?? null,
        ruleVersion: data.ruleVersion ?? null,
      },
    });
  } catch (e) {
    console.error("opdAssistLabLog create failed", e);
  }
}

export async function POST(req: Request) {
  let userId: string | null = null;
  let rawTextForLog = "";
  let meta: {
    caseId?: string | null;
    source: string;
    demoKey?: string | null;
    modeOverride: AssistMode | null;
  } | null = null;

  try {
    if (!isOpdAssistEnabled()) {
      return NextResponse.json({ ok: false, error: "Feature disabled" }, { status: 403 });
    }
    const session = await getServerSession(authOptions);
    if (!isAdminSession(session)) {
      return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
    }
    userId = await resolveUserId(session);

    const json: unknown = await req.json();
    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: "Invalid body" }, { status: 400 });
    }

    const { rawText, modeOverride, caseId, source, demoKey } = parsed.data;
    rawTextForLog = rawText;
    meta = {
      caseId: caseId ?? null,
      source: source ?? "analyze",
      demoKey: demoKey ?? null,
      modeOverride: (modeOverride ?? null) as AssistMode | null,
    };

    const override = meta.modeOverride;
    const result = analyzeOpdCase(rawText, override);

    if (userId) {
      void logOpdAssistLab({
        userId,
        rawText,
        caseId: meta.caseId,
        source: meta.source,
        demoKey: meta.demoKey,
        mode: result.mode,
        modeOverride: override,
        ok: true,
        cardIdsJson: JSON.stringify(result.diseaseCards.map((c) => c.id)),
        ruleVersion: result.rulePack.ruleVersion,
      });
    }

    return NextResponse.json({
      ok: true,
      ...result,
    });
  } catch (e) {
    console.error(e);
    const msg = e instanceof Error ? e.message : "Server error";
    if (userId && rawTextForLog && meta) {
      void logOpdAssistLab({
        userId,
        rawText: rawTextForLog,
        caseId: meta.caseId,
        source: meta.source,
        demoKey: meta.demoKey,
        mode: null,
        modeOverride: meta.modeOverride,
        ok: false,
        errorMessage: msg,
      });
    } else if (userId && rawTextForLog) {
      void logOpdAssistLab({
        userId,
        rawText: rawTextForLog,
        caseId: null,
        source: "analyze",
        demoKey: null,
        mode: null,
        modeOverride: null,
        ok: false,
        errorMessage: msg,
      });
    }
    return NextResponse.json({ ok: false, error: "Server error" }, { status: 500 });
  }
}
