import { Suspense } from "react";
import { notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isAdminSession, isChartAssistLabEnabled } from "@/lib/chartAssist/guards";
import ChartAssistLab from "@/components/chartAssist/ChartAssistLab";

export default async function ChartAssistLabPage() {
  const session = await getServerSession(authOptions);
  if (!isAdminSession(session)) notFound();
  if (!isChartAssistLabEnabled()) notFound();

  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#070b12] p-8 text-sm text-slate-500">Loading…</div>
      }
    >
      <ChartAssistLab />
    </Suspense>
  );
}
