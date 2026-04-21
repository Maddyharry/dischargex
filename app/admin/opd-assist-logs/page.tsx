import Link from "next/link";
import { notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import OpdAssistFeatureDisabled from "@/components/chartAssist/OpdAssistFeatureDisabled";
import { isOpdAssistEnabled, isAdminSession } from "@/lib/chartAssist/guards";
import { listOpdAssistLabLogs } from "@/lib/opdAssistLabLogStore";

export default async function OpdAssistLogsPage() {
  const session = await getServerSession(authOptions);
  if (!isAdminSession(session)) notFound();
  if (!isOpdAssistEnabled()) {
    return <OpdAssistFeatureDisabled />;
  }

  const logs = await listOpdAssistLabLogs(200);

  return (
    <main className="min-h-screen bg-[#081120] text-slate-100">
      <div className="mx-auto max-w-6xl px-4 py-10 space-y-6">
        <div className="flex flex-wrap items-baseline justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-white">OPD Assist — บันทึกการทดสอบ</h1>
            <p className="mt-1 text-sm text-slate-400">
              ใช้วิเคราะห์คุณภาพ/ข้อผิดพลาดจากการกด Analyze ใน Lab (ไม่ใช่ HN จริง)
            </p>
          </div>
          <div className="flex flex-col items-end gap-2 sm:flex-row sm:items-center sm:gap-3">
            <div className="text-right text-[11px] font-mono text-slate-500">/admin/opd-assist-lab</div>
            <Link
              href="/admin/opd-assist-lab"
              className="inline-flex items-center justify-center rounded-xl border border-emerald-500/35 bg-emerald-500/15 px-4 py-2.5 text-sm font-medium text-emerald-200 transition hover:bg-emerald-500/25"
            >
              เข้า OPD Assist Lab
            </Link>
            <Link href="/admin" className="text-sm text-slate-400 hover:text-white">
              ← Admin
            </Link>
          </div>
        </div>

        <div className="overflow-x-auto rounded-2xl border border-white/10 bg-white/[0.03]">
          <table className="w-full min-w-[900px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-white/10 text-xs uppercase tracking-wide text-slate-500">
                <th className="p-3 font-medium">เวลา</th>
                <th className="p-3 font-medium">ผู้ใช้</th>
                <th className="p-3 font-medium">แหล่ง</th>
                <th className="p-3 font-medium">ผล</th>
                <th className="p-3 font-medium">โหมด</th>
                <th className="p-3 font-medium">การ์ด</th>
                <th className="p-3 font-medium">กฎ</th>
                <th className="p-3 font-medium">ตัวอย่างข้อความ</th>
              </tr>
            </thead>
            <tbody>
              {logs.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-slate-500">
                    ยังไม่มีบันทึก — ไปที่ OPD Assist Lab แล้วกด Analyze
                  </td>
                </tr>
              ) : (
                logs.map((row) => (
                  <tr key={row.id} className="border-b border-white/5 align-top hover:bg-white/[0.02]">
                    <td className="whitespace-nowrap p-3 text-xs text-slate-400">
                      {row.createdAt.toISOString().replace("T", " ").slice(0, 19)}
                    </td>
                    <td className="p-3 text-xs">
                      <div className="max-w-[180px] truncate text-slate-200" title={row.user.email ?? row.userId}>
                        {row.user.email ?? row.userId}
                      </div>
                    </td>
                    <td className="p-3 text-xs">
                      <span className="rounded bg-white/10 px-1.5 py-0.5">{row.source}</span>
                      {row.demoKey ? (
                        <span className="ml-1 text-slate-500" title={row.demoKey}>
                          {row.demoKey}
                        </span>
                      ) : null}
                    </td>
                    <td className="p-3">
                      {row.ok ? (
                        <span className="text-emerald-400">ok</span>
                      ) : (
                        <span className="text-red-400" title={row.errorMessage ?? ""}>
                          fail
                        </span>
                      )}
                    </td>
                    <td className="p-3 text-xs text-slate-300">
                      {row.mode ?? "—"}
                      {row.modeOverride ? (
                        <span className="text-slate-500"> (ovr {row.modeOverride})</span>
                      ) : null}
                    </td>
                    <td className="max-w-[200px] p-3 font-mono text-[10px] text-slate-400 break-all">
                      {row.cardIds ?? (row.ok ? "—" : row.errorMessage?.slice(0, 120))}
                    </td>
                    <td className="whitespace-nowrap p-3 text-xs text-slate-500">{row.ruleVersion ?? "—"}</td>
                    <td className="max-w-md p-3 text-xs text-slate-400">
                      <div className="line-clamp-3 whitespace-pre-wrap" title={row.textPreview ?? ""}>
                        {row.textPreview ?? "—"}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}
