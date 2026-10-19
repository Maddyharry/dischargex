import { prisma } from "@/lib/prisma";
import { summarizeImpact, type CompletedJob } from "@/lib/summary-impact";
export const runtime="nodejs";
export async function GET() {
  try {
    const since=new Date(Date.now()-30*24*3600000);
    // UsageLog is written in the same transaction that commits a successful Generate.
    // It also covers older successful jobs from before summary_job feedback logging existed.
    // UsageLog has no environment column, so only trust it from the production deployment.
    const isProductionDeployment=process.env.VERCEL_ENV==="production";
    const [usageRows, feedbackRows]=await Promise.all([
      isProductionDeployment ? prisma.usageLog.findMany({
        where:{createdAt:{gte:since},reason:{in:["generate","long_case_generate","token_generate"]},caseId:{not:null}},
        orderBy:{createdAt:"desc"},take:10001,select:{caseId:true,reason:true},
      }) : Promise.resolve([]),
      prisma.feedback.findMany({
        where:{type:"summary_job",status:"completed",createdAt:{gte:since}},
        orderBy:{createdAt:"desc"},take:10001,select:{id:true,status:true,payload:true},
      }),
    ]);
    // Never present a capped sample as a complete public total.
    if(usageRows.length>10000||feedbackRows.length>10000)return Response.json({available:false},{headers:{"Cache-Control":"public, s-maxage=60"}});

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
      periodDays:30,
      updatedAt:new Date().toISOString(),
      measurement:"server_generation_only",
    },{headers:{"Cache-Control":"public, s-maxage=30, stale-while-revalidate=30"}});
  } catch { return Response.json({available:false},{status:503,headers:{"Cache-Control":"no-store"}}); }
}
