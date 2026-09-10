import { prisma } from "@/lib/prisma";
import { summarizeImpact, type CompletedJob } from "@/lib/summary-impact";
export const runtime="nodejs";
export async function GET() {
  try {
    const since=new Date(Date.now()-30*24*3600000);
    const rows=await prisma.feedback.findMany({where:{type:"summary_job",createdAt:{gte:since}},orderBy:{createdAt:"desc"},take:10001,select:{payload:true}});
    // Never present a capped sample as a complete public total.
    if(rows.length>10000)return Response.json({available:false},{headers:{"Cache-Control":"public, s-maxage=60"}});
    const jobs:CompletedJob[]=rows.flatMap(row=>{try {const job=JSON.parse(row.payload||"{}");return job.production===true?[{durationMs:job.durationMs}]:[];}catch{return [];}});
    return Response.json({available:true,...summarizeImpact(jobs),periodDays:30,updatedAt:new Date().toISOString(),measurement:"server_generation_only"},{headers:{"Cache-Control":"public, s-maxage=30, stale-while-revalidate=30"}});
  } catch { return Response.json({available:false},{status:503,headers:{"Cache-Control":"no-store"}}); }
}
