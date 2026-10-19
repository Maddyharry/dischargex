import { prisma } from "@/lib/prisma";
import { summarizeImpact, type CompletedJob } from "@/lib/summary-impact";
export const runtime = "nodejs";

const PAGE_SIZE = 1000;
const MAX_PAGES = 100;

type IdentifiedRow = { id: string };

/** Read a bounded number of rows per query and fail closed rather than publish a partial total. */
async function readAllRows<T extends IdentifiedRow>(
  fetchPage: (cursor: string | null) => Promise<T[]>,
): Promise<T[] | null> {
  const rows: T[] = [];
  let cursor: string | null = null;
  let pages = 0;

  while (true) {
    const page = await fetchPage(cursor);
    if (page.length === 0) return rows;
    if (pages >= MAX_PAGES) return null;
    rows.push(...page);
    pages += 1;
    cursor = page[page.length - 1].id;
    if (page.length < PAGE_SIZE) return rows;
  }
}

export async function GET() {
  try {
    // UsageLog is written in the same transaction that commits a successful Generate.
    // It also covers older successful jobs from before summary_job feedback logging existed.
    // UsageLog has no environment column, so only trust it from the production deployment.
    const isProductionDeployment = process.env.VERCEL_ENV === "production";
    const [usageRows, feedbackRows] = await Promise.all([
      isProductionDeployment
        ? readAllRows((cursor) => prisma.usageLog.findMany({
            where: { reason: { in: ["generate", "long_case_generate", "token_generate"] }, caseId: { not: null } },
            orderBy: { id: "asc" },
            ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
            take: PAGE_SIZE,
            select: { id: true, caseId: true, reason: true },
          }))
        : Promise.resolve([]),
      readAllRows((cursor) => prisma.feedback.findMany({
        where: { type: "summary_job", status: "completed" },
        orderBy: { id: "asc" },
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
        take: PAGE_SIZE,
        select: { id: true, status: true, payload: true },
      })),
    ]);
    // Never present a capped sample as a complete public total.
    if (usageRows === null || feedbackRows === null) {
      return Response.json({ available: false }, { headers: { "Cache-Control": "public, s-maxage=60" } });
    }

    const caseIds=new Set<string>();
    for(const row of usageRows){
      if(typeof row.caseId==="string"&&row.caseId.trim())caseIds.add(row.caseId);
    }
    const durationsByCase=new Map<string,number>();
    for(const row of feedbackRows){
      try {
        if(row.status!=="completed"||!row.id.startsWith("summary_"))continue;
        const job=JSON.parse(row.payload||"{}");
        if(job.production!==true||job.mode!=="generate")continue;
        const caseId=row.id.slice("summary_".length);
        if(!caseId)continue;
        caseIds.add(caseId);
        if(typeof job.durationMs==="number"&&!durationsByCase.has(caseId))durationsByCase.set(caseId,job.durationMs);
      }catch{ /* malformed optional metadata is ignored */ }
    }
    const durationMetrics=summarizeImpact(Array.from(durationsByCase.values()).map((durationMs):CompletedJob=>({durationMs})));
    return Response.json({
      available:true,
      ...durationMetrics,
      completedJobs:caseIds.size,
      updatedAt:new Date().toISOString(),
      measurement:"server_generation_only",
    },{headers:{"Cache-Control":"public, s-maxage=30, stale-while-revalidate=30"}});
  } catch { return Response.json({available:false},{status:503,headers:{"Cache-Control":"no-store"}}); }
}
