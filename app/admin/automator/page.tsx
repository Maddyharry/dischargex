import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
export const dynamic="force-dynamic";
export default async function AutomatorSupport() {
  const session=await getServerSession(authOptions);
  if((session?.user as {role?:string}|undefined)?.role!=="admin")return <main className="p-8">กรุณาเข้าสู่ระบบผู้ดูแล</main>;
  const items=await prisma.feedback.findMany({where:{type:"automator_incident"},orderBy:{createdAt:"desc"},take:100,select:{id:true,createdAt:true,message:true,shortSummary:true,status:true,payload:true,fingerprint:true}});
  const groups=new Map<string,number>();items.forEach(i=>groups.set(i.fingerprint||i.id,(groups.get(i.fingerprint||i.id)||0)+1));
  return <main className="mx-auto max-w-5xl p-6 text-slate-100"><Link href="/admin" className="text-cyan-300">← ผู้ดูแล</Link><h1 className="mt-6 text-3xl font-semibold">ปัญหาจาก Auto</h1><p className="my-4 text-slate-300">รายงานล่าสุดสูงสุด 100 รายการ · จำนวนซ้ำคิดเฉพาะรายการที่แสดง · ไม่มีภาพหรือข้อความคนไข้ในสัญญารายงานนี้</p>{items.length===0?<p>ยังไม่มีรายงานจากโปรแกรม</p>:items.map(i=><details key={i.id} className="mb-3 rounded-lg border border-white/15 p-4"><summary>{i.shortSummary} · {groups.get(i.fingerprint||i.id)} รายการรูปแบบเดียวกัน · {i.createdAt.toLocaleString("th-TH",{timeZone:"Asia/Bangkok"})}</summary><pre className="mt-4 overflow-auto whitespace-pre-wrap text-xs text-slate-300">{i.payload ? JSON.stringify(JSON.parse(i.payload),null,2):""}</pre><p className="mt-3 text-sm">สถานะ: {i.status} · วิธีแก้ต้องผ่านการทดสอบก่อนนำไปใช้กับเครื่องลูกค้า</p></details>)}</main>;
}
