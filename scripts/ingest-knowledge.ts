import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { prisma } from "../lib/prisma";

function chunksOf(text: string, chunkSize = 1200) {
  const out: string[] = [];
  const normalized = text.replace(/\r/g, "");
  for (let i = 0; i < normalized.length; i += chunkSize) {
    out.push(normalized.slice(i, i + chunkSize));
  }
  return out;
}

async function ingestFile(filePath: string) {
  const raw = readFileSync(filePath, "utf8");
  const checksum = createHash("sha256").update(raw).digest("hex");
  const sourceName = filePath.split(/[\\/]/).pop() || filePath;
  const sourceType = sourceName.toLowerCase().endsWith(".md") ? "markdown" : "text";

  const doc = await prisma.knowledgeDocument.upsert({
    where: { id: checksum.slice(0, 24) },
    create: {
      id: checksum.slice(0, 24),
      sourceName,
      sourceType,
      version: new Date().toISOString().slice(0, 10),
      checksum,
      isActive: true,
    },
    update: {
      sourceName,
      sourceType,
      checksum,
      isActive: true,
    },
  });

  await prisma.knowledgeChunk.deleteMany({ where: { documentId: doc.id } });
  const chunks = chunksOf(raw, 1200);
  if (!chunks.length) return 0;
  await prisma.knowledgeChunk.createMany({
    data: chunks.map((content, i) => ({
      documentId: doc.id,
      ordinal: i,
      title: sourceName,
      content,
      pageRef: `chunk-${i + 1}`,
    })),
  });
  return chunks.length;
}

async function main() {
  const baseDir = process.argv[2];
  if (!baseDir) {
    throw new Error("Usage: tsx scripts/ingest-knowledge.ts <directory>");
  }
  const files = readdirSync(baseDir)
    .filter((f) => /\.(txt|md)$/i.test(f))
    .map((f) => join(baseDir, f));

  let total = 0;
  for (const f of files) {
    total += await ingestFile(f);
  }
  console.log(`Ingested ${files.length} documents, ${total} chunks`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
