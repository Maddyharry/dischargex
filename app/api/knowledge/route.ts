import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getMergedKnowledge } from "@/lib/knowledge-store";
import { KNOWLEDGE_REFERENCES } from "@/lib/clinical-knowledge";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const q = (searchParams.get("q") || "").trim().toLowerCase();
  const all = await getMergedKnowledge(false);
  const list = !q
    ? all
    : all.filter((d) =>
        [d.name, ...d.aliases, ...d.diagnosisToWrite, ...d.icd10, ...d.investigations].join(" ").toLowerCase().includes(q)
      );
  return NextResponse.json({ ok: true, items: list, references: KNOWLEDGE_REFERENCES });
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { q?: string; limit?: number };
    const q = String(body.q || "").trim();
    const limit = Math.min(20, Math.max(1, Number(body.limit || 8)));
    if (!q) return NextResponse.json({ ok: false, error: "Missing q" }, { status: 400 });

    const staticKnowledge = await getMergedKnowledge(false);
    const staticHits = staticKnowledge
      .filter((d) =>
        [d.name, ...d.aliases, ...d.diagnosisToWrite, ...d.investigations, ...d.icd10]
          .join(" ")
          .toLowerCase()
          .includes(q.toLowerCase())
      )
      .slice(0, limit)
      .map((d) => ({
        source: "static_catalog",
        title: d.name,
        snippet: d.diagnosisToWrite.slice(0, 3).join(" · "),
        pageRef: null as string | null,
        refs: d.refs,
      }));

    const chunkHits = await prisma.knowledgeChunk.findMany({
      where: {
        document: { isActive: true },
        OR: [
          { content: { contains: q, mode: "insensitive" } },
          { title: { contains: q, mode: "insensitive" } },
          { pageRef: { contains: q, mode: "insensitive" } },
        ],
      },
      include: { document: true },
      orderBy: { createdAt: "desc" },
      take: limit,
    });

    const chunks = chunkHits.map((c) => ({
      source: c.document.sourceName,
      title: c.title || c.document.sourceName,
      snippet: c.content.slice(0, 350),
      pageRef: c.pageRef || null,
      refs: [],
    }));

    return NextResponse.json({
      ok: true,
      q,
      items: [...chunks, ...staticHits].slice(0, limit),
      references: KNOWLEDGE_REFERENCES,
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "search_failed" },
      { status: 500 }
    );
  }
}

