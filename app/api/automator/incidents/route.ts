import { createHash } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { automatorUser } from "@/lib/automator-auth";
import { incidentSchema, normalizeIncidentInput, readBoundedJson } from "@/lib/automator-contract";
export const runtime="nodejs";
export async function POST(req:Request) {
  try {
    const user=await automatorUser(req); if(!user)return Response.json({error:"Login required"},{status:401});
    let input:unknown;
    try { input=normalizeIncidentInput(await readBoundedJson(req)); } catch { return Response.json({error:"Invalid report"},{status:400}); }
    const parsed=incidentSchema.safeParse(input); if(!parsed.success)return Response.json({error:"Invalid report"},{status:400});
    const report=parsed.data;
    if(req.headers.get("idempotency-key")!==report.incidentId)return Response.json({error:"Idempotency key required"},{status:400});
    const id="incident_"+createHash("sha256").update(user.id+":"+report.incidentId).digest("hex");
    const existing=await prisma.feedback.findUnique({where:{id},select:{id:true}});
    if(existing)return Response.json({incidentId:report.incidentId,status:"received"});
    const count=await prisma.feedback.count({where:{userId:user.id,type:"automator_incident",createdAt:{gte:new Date(Date.now()-3600000)}}});
    if(count>=30)return Response.json({error:"Try later"},{status:429,headers:{"Retry-After":"3600"}});
    const fingerprint=createHash("sha256").update(JSON.stringify([report.appVersion,report.failure,report.timeline.slice(-8).map(e=>e.action)])).digest("hex");
    try {
      await prisma.feedback.create({data:{id,userId:user.id,type:"automator_incident",message:report.failure,payload:JSON.stringify(report),category:"bug",shortSummary:`Auto ${report.appVersion}: ${report.failure}`,fingerprint,status:"pending"}});
    } catch(error) { if(!(error && typeof error==="object" && "code" in error && error.code==="P2002"))throw error; }
    return Response.json({incidentId:report.incidentId,status:"received"},{status:201});
  } catch { return Response.json({error:"Report service unavailable"},{status:503}); }
}
