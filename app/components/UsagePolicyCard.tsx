type UsagePolicy = {
  mode: "legacy_internal" | "revenue_5x";
  capThb: number | null;
  spendThb: number | null;
  remainingThb: number | null;
  resetAt: string | null;
  status: "active" | "expired" | "not_started";
  costEstimate: {
    basis: "legacy_internal" | "actual_api_standard_rates";
    status: "known" | "unknown";
    uncertainty: string[];
  };
};

type UsagePolicyCardProps = {
  policy: UsagePolicy | null | undefined;
  summaryUsedToday: number | null | undefined;
  summaryDailyLimit: number | null | undefined;
  summaryResetAt: string | null | undefined;
  paidPlan: boolean;
};

function formatUnits(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value) ? `${value.toFixed(2)} หน่วย` : "ไม่ทราบ";
}

export function formatUsageReset(value: string | null | undefined) {
  if (!value) return "ไม่ทราบ";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "ไม่ทราบ";
  return new Intl.DateTimeFormat("th-TH", {
    dateStyle: "medium", timeStyle: "medium", timeZone: "Asia/Bangkok",
  }).format(date);
}

export default function UsagePolicyCard({ policy, summaryUsedToday, summaryDailyLimit, summaryResetAt, paidPlan }: UsagePolicyCardProps) {
  const knownSpend = policy?.costEstimate.status === "known" && policy.spendThb !== null;
  return (
    <section aria-label="สรุปการใช้งานและการรีเซ็ต" className="rounded-2xl border border-cyan-900/60 bg-slate-950/60 p-4">
      <h3 className="text-sm font-semibold text-slate-100">การใช้งานและรอบรีเซ็ต</h3>
      <div className="mt-3 space-y-2 text-sm">
        <p className="text-slate-300">
          สรุปวันนี้: <span className="font-semibold text-white">{summaryUsedToday ?? "ไม่ทราบ"} / {summaryDailyLimit ?? "ไม่ทราบ"}</span>
        </p>
        <p className="text-xs text-slate-400">รีเซ็ตสรุปรายวัน: {formatUsageReset(summaryResetAt)} (เวลาไทย)</p>
        <div className="border-t border-slate-800 pt-2">
          {!policy ? <p className="text-slate-400">ข้อมูลงบประมาณยังไม่พร้อม</p> : <>
            <p className="text-slate-300">
              หน่วยงบ AI ที่ใช้: {knownSpend ? formatUnits(policy.spendThb) : "ไม่ทราบ/ข้อมูลไม่ครบ"}
              {policy.capThb === null ? "" : ` / ${formatUnits(policy.capThb)}`}
            </p>
            {policy.mode === "legacy_internal" ? <p className="text-xs text-slate-400">ยอดนี้ใช้หน่วยงบประมาณของแพ็กเกจ ไม่ใช่ค่าใช้จ่ายที่เรียกเก็บแยกรายการ</p> : <p className="text-xs text-slate-400">ระบบคำนวณหน่วยงบ AI จากการใช้งานที่บันทึก</p>}
            {policy.costEstimate.status === "unknown" ? <p className="text-xs text-amber-300">ข้อมูลการใช้งานยังไม่ครบ จึงยืนยันยอดคงเหลือไม่ได้</p> : <p className="text-slate-300">หน่วยงบ AI คงเหลือ: {formatUnits(policy.remainingThb)}</p>}
            <p className="text-xs text-slate-400">รอบงบรีเซ็ต: {formatUsageReset(policy.resetAt)} (เวลาไทย) · สถานะ: {policy.status === "active" ? "ใช้งานอยู่" : policy.status === "expired" ? "หมดอายุ" : "ยังไม่เริ่ม"}</p>
            {paidPlan && policy.mode === "legacy_internal" ? <p className="text-xs text-slate-400">สำหรับสมาชิกเดิม เงื่อนไขงบรอบใหม่เริ่มเมื่อถึงการต่ออายุ/รอบชำระครั้งถัดไป</p> : null}
          </>}
        </div>
      </div>
    </section>
  );
}
