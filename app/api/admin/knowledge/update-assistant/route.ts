import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import OpenAI from "openai";
import { authOptions } from "@/lib/auth";
import { getMergedKnowledge } from "@/lib/knowledge-store";
import { retrieveExternalEvidence } from "@/lib/reference-retriever";

export const runtime = "nodejs";

function isAdmin(session: unknown) {
  return (session as { user?: { role?: string } } | null)?.user?.role === "admin";
}

function cleanLines(input: unknown, max = 10) {
  if (!Array.isArray(input)) return [] as string[];
  return input
    .map((x) => String(x || "").trim())
    .filter(Boolean)
    .slice(0, max);
}

async function extractPdfText(file: File) {
  const bytes = Buffer.from(await file.arrayBuffer());
  const { PDFParse } = await import("pdf-parse");
  const parser = new PDFParse({ data: bytes });
  try {
    const parsed = await parser.getText();
    return String(parsed.text || "").trim();
  } finally {
    await parser.destroy();
  }
}

function matchTopicCandidates(topicHint: string, knowledge: Awaited<ReturnType<typeof getMergedKnowledge>>) {
  const q = topicHint.toLowerCase();
  if (!q) return [];
  return knowledge
    .map((k) => {
      const pool = [k.slug, k.name, ...k.aliases].join(" ").toLowerCase();
      let score = 0;
      if (pool.includes(q)) score += 2;
      if (q.includes(k.slug.toLowerCase())) score += 2;
      for (const alias of k.aliases) {
        if (q.includes(alias.toLowerCase())) score += 1;
      }
      return { slug: k.slug, name: k.name, score };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!isAdmin(session)) return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  if (!process.env.OPENAI_API_KEY) return NextResponse.json({ ok: false, error: "Missing OPENAI_API_KEY" }, { status: 503 });

  let topicHint = "";
  let sourceName = "";
  let sourceType = "text";
  let guidelineText = "";
  let discoverOnly = false;

  const contentType = req.headers.get("content-type") || "";
  if (contentType.includes("multipart/form-data")) {
    const form = await req.formData();
    topicHint = String(form.get("topicHint") || "").trim();
    sourceName = String(form.get("sourceName") || "").trim();
    discoverOnly = String(form.get("discoverOnly") || "") === "1";
    const rawText = String(form.get("content") || "").trim();
    const file = form.get("file");
    if (file instanceof File && file.name.toLowerCase().endsWith(".pdf")) {
      sourceType = "pdf";
      guidelineText = await extractPdfText(file);
      if (!sourceName) sourceName = file.name;
    } else {
      sourceType = "text";
      guidelineText = rawText;
    }
  } else {
    const body = (await req.json()) as {
      topicHint?: string;
      sourceName?: string;
      content?: string;
      discoverOnly?: boolean;
    };
    topicHint = String(body.topicHint || "").trim();
    sourceName = String(body.sourceName || "").trim();
    guidelineText = String(body.content || "").trim();
    discoverOnly = Boolean(body.discoverOnly);
  }

  const knowledge = await getMergedKnowledge(false);
  const candidateTopics = matchTopicCandidates(topicHint, knowledge);
  const external = topicHint
    ? await retrieveExternalEvidence(`${topicHint} guideline update ล่าสุด`, {
        thaiChargeGuidance: true,
        maxDomains: 6,
        maxEvidence: 4,
      })
    : { evidences: [], whitelist: [] };

  if (discoverOnly) {
    return NextResponse.json({
      ok: true,
      mode: "discover_only",
      candidateTopics,
      externalSources: external.evidences.map((x) => ({
        sourceName: x.sourceName,
        title: x.title,
        url: x.sourceUrl,
      })),
    });
  }

  if (!guidelineText || guidelineText.length < 120) {
    return NextResponse.json({ ok: false, error: "Missing or too short guideline content" }, { status: 400 });
  }

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const prompt = [
    "You are a Thai clinical guideline update assistant for OPD knowledge base.",
    "Task: compare incoming guideline text with existing topic summary and propose actionable updates.",
    "Priority policy: Thai guidelines first. If Thai source unavailable, then international fallback.",
    "Return strict JSON only with keys:",
    "{",
    '  "suggestedAction": "expand_topic" | "new_topic",',
    '  "targetSlug": "string_or_empty",',
    '  "topicName": "string",',
    '  "changeSummary": ["..."],',
    '  "fields": {',
    '    "diagnosisToWrite": ["..."],',
    '    "thinkWhen": ["..."],',
    '    "considerMore": ["..."],',
    '    "notYetDiagnosis": ["..."],',
    '    "investigations": ["..."],',
    '    "icd10": ["..."],',
    '    "refs": ["R1"],',
    '    "diagnosticCriteria": [{"label":"...","criteria":"...","priority":"core|supporting","sourceType":"thai_guideline|thai_reference|international_fallback","sourceNote":"...","lastReviewed":"YYYY-MM-DD"}]',
    "  }",
    "}",
    "Rules:",
    "- Keep each list concise and clinically verifiable.",
    "- If uncertain, put conservative statement in notYetDiagnosis.",
    "- criteria should be explicit, measurable when possible (e.g. >3 times/day).",
    "",
    `TOPIC_HINT: ${topicHint || "-"}`,
    `SOURCE_NAME: ${sourceName || "-"}`,
    `SOURCE_TYPE: ${sourceType}`,
    `CANDIDATE_TOPICS: ${JSON.stringify(candidateTopics)}`,
    `CURRENT_TOPIC_SNAPSHOT: ${JSON.stringify(candidateTopics[0] || null)}`,
    "GUIDELINE_TEXT:",
    guidelineText.slice(0, 14000),
  ].join("\n");

  const resp = await openai.responses.create({
    model: process.env.OPENAI_SPECIALIST_CHAT_MODEL_PRECISE || process.env.OPENAI_CHAT_MODEL || "gpt-5.5",
    input: prompt,
    max_output_tokens: 1400,
  });
  const text = String("output_text" in resp ? resp.output_text || "" : "").trim();

  let parsed: {
    suggestedAction?: "expand_topic" | "new_topic";
    targetSlug?: string;
    topicName?: string;
    changeSummary?: string[];
    fields?: {
      diagnosisToWrite?: string[];
      thinkWhen?: string[];
      considerMore?: string[];
      notYetDiagnosis?: string[];
      investigations?: string[];
      icd10?: string[];
      refs?: string[];
      diagnosticCriteria?: Array<{
        label: string;
        criteria: string;
        priority?: "core" | "supporting";
        sourceType?: "thai_guideline" | "thai_reference" | "international_fallback";
        sourceNote?: string;
        lastReviewed?: string;
      }>;
    };
  } | null = null;
  try {
    const jsonStart = text.indexOf("{");
    const jsonEnd = text.lastIndexOf("}");
    parsed = JSON.parse(jsonStart >= 0 && jsonEnd > jsonStart ? text.slice(jsonStart, jsonEnd + 1) : text);
  } catch {
    parsed = null;
  }

  if (!parsed) return NextResponse.json({ ok: false, error: "AI output parsing failed", raw: text }, { status: 422 });

  const today = new Date().toISOString().slice(0, 10);
  return NextResponse.json({
    ok: true,
    analysis: {
      suggestedAction: parsed.suggestedAction || (candidateTopics.length ? "expand_topic" : "new_topic"),
      targetSlug: parsed.targetSlug || candidateTopics[0]?.slug || "",
      topicName: parsed.topicName || topicHint || sourceName || "Guideline update",
      changeSummary: cleanLines(parsed.changeSummary, 8),
      fields: {
        diagnosisToWrite: cleanLines(parsed.fields?.diagnosisToWrite, 20),
        thinkWhen: cleanLines(parsed.fields?.thinkWhen, 20),
        considerMore: cleanLines(parsed.fields?.considerMore, 20),
        notYetDiagnosis: cleanLines(parsed.fields?.notYetDiagnosis, 20),
        investigations: cleanLines(parsed.fields?.investigations, 20),
        icd10: cleanLines(parsed.fields?.icd10, 20),
        refs: cleanLines(parsed.fields?.refs, 20),
        diagnosticCriteria: Array.isArray(parsed.fields?.diagnosticCriteria)
          ? parsed.fields?.diagnosticCriteria
              .map((row) => ({
                label: String(row?.label || "Criteria").trim() || "Criteria",
                criteria: String(row?.criteria || "").trim(),
                priority: row?.priority === "supporting" ? "supporting" : "core",
                sourceType:
                  row?.sourceType === "international_fallback"
                    ? "international_fallback"
                    : row?.sourceType === "thai_reference"
                    ? "thai_reference"
                    : "thai_guideline",
                sourceNote: String(row?.sourceNote || sourceName || "").trim(),
                lastReviewed: String(row?.lastReviewed || today).trim(),
              }))
              .filter((x) => x.criteria)
              .slice(0, 15)
          : [],
      },
      candidateTopics,
      externalSources: external.evidences.map((x) => ({
        sourceName: x.sourceName,
        title: x.title,
        url: x.sourceUrl,
      })),
      sourceMeta: {
        sourceName,
        sourceType,
        charCount: guidelineText.length,
      },
    },
  });
}

