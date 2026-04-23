import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createHash } from "node:crypto";
import { prisma } from "@/lib/prisma";
import {
  getMergedKnowledge,
  getPendingKnowledgeGaps,
  reviewPendingKnowledgeGap,
  reviewPendingKnowledgeEntry,
  updateKnowledgeOverride,
} from "@/lib/knowledge-store";

export const runtime = "nodejs";

function isAdmin(session: unknown) {
  return (session as { user?: { role?: string } } | null)?.user?.role === "admin";
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!isAdmin(session)) return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  const items = await getMergedKnowledge(true);
  const pendingGaps = await getPendingKnowledgeGaps();
  const pendingDocuments = await prisma.knowledgeDocument.findMany({
    where: { isActive: false },
    orderBy: { createdAt: "desc" },
    take: 200,
    select: { id: true, sourceName: true, sourceType: true, version: true, createdAt: true },
  });
  return NextResponse.json({ ok: true, items, pendingGaps, pendingDocuments });
}

export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!isAdmin(session)) return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  const body = (await req.json()) as {
    slug?: string;
    deprecated?: boolean;
    version?: string;
    effectiveDate?: string;
    action?:
      | "approve_document"
      | "reject_document"
      | "approve_pending_entry"
      | "reject_pending_entry"
      | "approve_pending_gap"
      | "reject_pending_gap";
    documentId?: string;
    entryId?: string;
    gapId?: string;
    publishMode?: "new_topic" | "expand_topic";
    targetSlug?: string;
    topicName?: string;
  };
  if (body.action === "approve_document" || body.action === "reject_document") {
    if (!body.documentId) return NextResponse.json({ ok: false, error: "Missing documentId" }, { status: 400 });
    if (body.action === "approve_document") {
      await prisma.knowledgeDocument.update({ where: { id: body.documentId }, data: { isActive: true } });
      return NextResponse.json({ ok: true, published: true });
    }
    await prisma.knowledgeChunk.deleteMany({ where: { documentId: body.documentId } });
    await prisma.knowledgeDocument.delete({ where: { id: body.documentId } });
    return NextResponse.json({ ok: true, published: false });
  }

  if (body.action === "approve_pending_entry" || body.action === "reject_pending_entry") {
    if (!body.entryId) return NextResponse.json({ ok: false, error: "Missing entryId" }, { status: 400 });
    const reviewed = await reviewPendingKnowledgeEntry(
      body.entryId,
      body.action === "approve_pending_entry" ? "approve" : "reject",
      {
        publishMode: body.publishMode,
        targetSlug: body.targetSlug,
        topicName: body.topicName,
      }
    );
    return NextResponse.json({ ok: reviewed.ok, published: reviewed.ok ? reviewed.published : false });
  }

  if (body.action === "approve_pending_gap" || body.action === "reject_pending_gap") {
    if (!body.gapId) return NextResponse.json({ ok: false, error: "Missing gapId" }, { status: 400 });
    const reviewed = await reviewPendingKnowledgeGap(
      body.gapId,
      body.action === "approve_pending_gap" ? "approve" : "reject",
      {
        publishMode: body.publishMode,
        targetSlug: body.targetSlug,
        topicName: body.topicName,
      }
    );
    return NextResponse.json({
      ok: reviewed.ok,
      published: reviewed.ok ? reviewed.published : false,
      count: reviewed.ok ? reviewed.count : 0,
    });
  }

  if (!body.slug) return NextResponse.json({ ok: false, error: "Missing slug" }, { status: 400 });
  await updateKnowledgeOverride(body.slug, {
    slug: body.slug,
    deprecated: typeof body.deprecated === "boolean" ? body.deprecated : undefined,
    version: body.version || undefined,
    effectiveDate: body.effectiveDate || undefined,
  });
  return NextResponse.json({ ok: true });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!isAdmin(session)) return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  const body = (await req.json()) as { sourceName?: string; content?: string; sourceType?: string; version?: string };
  const sourceName = String(body.sourceName || "").trim();
  const content = String(body.content || "").trim();
  if (!sourceName || !content) {
    return NextResponse.json({ ok: false, error: "Missing sourceName/content" }, { status: 400 });
  }
  const checksum = createHash("sha256").update(content).digest("hex");
  const document = await prisma.knowledgeDocument.create({
    data: {
      sourceName,
      sourceType: body.sourceType || "manual",
      version: body.version || new Date().toISOString().slice(0, 10),
      checksum,
      isActive: false,
    },
  });
  const chunkSize = 1200;
  const rows: Array<{ documentId: string; ordinal: number; title: string; content: string; pageRef: string }> = [];
  for (let i = 0; i < content.length; i += chunkSize) {
    rows.push({
      documentId: document.id,
      ordinal: rows.length,
      title: sourceName,
      content: content.slice(i, i + chunkSize),
      pageRef: `chunk-${rows.length + 1}`,
    });
  }
  if (rows.length) await prisma.knowledgeChunk.createMany({ data: rows });
  return NextResponse.json({ ok: true, documentId: document.id, chunks: rows.length, pendingReview: true });
}

