import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { assertChartAssistLabAccess } from "@/lib/chartAssist/guards";
import { analyzeChartCase } from "@/lib/chartAssist/ruleEngine";
import { normalizeTimelineEntry } from "@/lib/chartAssist/caseModel";
import type { AssistMode } from "@/lib/chartAssist/cardTypes";

export const runtime = "nodejs";

const timelineEntrySchema = z.object({
  entryId: z.string().uuid(),
  at: z.string(),
  channel: z.literal("desktop").optional(),
  kind: z.literal("text").optional(),
  payload: z.object({ text: z.string() }).optional(),
  /** legacy */
  text: z.string().optional(),
});

const bodySchema = z.object({
  caseId: z.string().uuid(),
  timeline: z.array(timelineEntrySchema),
  modeOverride: z.enum(["OPD", "ER", "TRAUMA", "PSYCH", "LABOR_ROOM", "GYNE"]).nullable().optional(),
  liveAssist: z.boolean().optional(),
  caseVersion: z.number().int().optional(),
});

function timelineToRawText(
  timeline: z.infer<typeof bodySchema>["timeline"],
): string {
  const lines: string[] = [];
  for (const e of timeline) {
    const n = normalizeTimelineEntry(e);
    const t = n?.payload.text?.trim() ?? "";
    if (t) lines.push(t);
  }
  return lines.join("\n");
}

export async function POST(req: Request) {
  const access = assertChartAssistLabAccess(await getServerSession(authOptions));
  if (access === "forbidden") {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }
  if (access === "disabled") {
    return NextResponse.json({ ok: false, error: "Feature disabled" }, { status: 403 });
  }

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "Invalid body" }, { status: 400 });
  }

  const { caseId, timeline, modeOverride } = parsed.data;
  const rawText = timelineToRawText(timeline);
  const override = (modeOverride ?? null) as AssistMode | null;
  const analysis = analyzeChartCase(rawText, override);

  return NextResponse.json({
    ok: true,
    echo: { caseId },
    ...analysis,
  });
}
