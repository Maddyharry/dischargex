import { prisma } from "@/lib/prisma";
import { summarizeImpact, type CompletedJob } from "@/lib/summary-impact";
export const runtime = "nodejs";

const PAGE_SIZE = 1000;
const MAX_PAGES = 100;

type IdentifiedRow = { id: string };

/** Read all retained rows for the duration metric, or fail closed instead of averaging a sample. */
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
    // This lifetime counter includes legacy summaries that have no caseId in UsageLog.
    // If the aggregate query fails, the outer catch makes the metric unavailable.
    const [userTotalsResult, feedbackRowsResult] = await Promise.allSettled([
      prisma.user.aggregate({ _sum: { totalGenerations: true } }),
      readAllRows((cursor) => prisma.feedback.findMany({
        where: { type: "summary_job", status: "completed" },
        orderBy: { id: "asc" },
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
        take: PAGE_SIZE,
        select: { id: true, status: true, payload: true },
      })),
    ]);
    if (userTotalsResult.status === "rejected") throw userTotalsResult.reason;
    const userTotals = userTotalsResult.value;
    const feedbackRows = feedbackRowsResult.status === "fulfilled" ? feedbackRowsResult.value : null;

    const durationsByCase=new Map<string,number>();
    for(const row of feedbackRows ?? []){
      try {
        if(row.status!=="completed"||!row.id.startsWith("summary_"))continue;
        const job=JSON.parse(row.payload||"{}");
        if(job.production!==true||job.mode!=="generate")continue;
        const caseId=row.id.slice("summary_".length);
        if(!caseId)continue;
        if(typeof job.durationMs==="number"&&!durationsByCase.has(caseId))durationsByCase.set(caseId,job.durationMs);
      }catch{ /* malformed optional metadata is ignored */ }
    }
    const durationMetrics=summarizeImpact(Array.from(durationsByCase.values()).map((durationMs):CompletedJob=>({durationMs})));
    return Response.json({
      available:true,
      durationAvailable:feedbackRows !== null,
      ...durationMetrics,
      completedJobs:userTotals._sum.totalGenerations ?? 0,
      updatedAt:new Date().toISOString(),
      measurement:"server_generation_only",
    },{headers:{"Cache-Control":"public, s-maxage=30, stale-while-revalidate=30"}});
  } catch { return Response.json({available:false},{status:503,headers:{"Cache-Control":"no-store"}}); }
}
