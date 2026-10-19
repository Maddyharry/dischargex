import BoostPurchaseButton from "@/app/components/BoostPurchaseButton";

type UsagePolicyCardProps = {
  used: number;
  remaining: number;
  total: number;
  summaryUsedToday: number | null | undefined;
  summaryDailyLimit: number | null | undefined;
  summaryResetAt: string | null | undefined;
  periodAllowanceResetAt: string | null | undefined;
  periodEnd: string | null | undefined;
  periodPercentUsed: number | null | undefined;
  allowanceDisplayMode: "ai_cost" | "legacy_units" | "not_applicable";
  grandfathered: boolean;
  boostCredits: number;
  active: boolean;
  canPurchaseBoost: boolean;
};

export function formatUsageReset(value: string | null | undefined) {
  if (!value) return "ไม่ทราบ";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "ไม่ทราบ";
  return new Intl.DateTimeFormat("th-TH", {
    dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Bangkok",
  }).format(date);
}

export default function UsagePolicyCard(props: UsagePolicyCardProps) {
  const percent = props.periodPercentUsed;
  return (
    <section aria-label="สรุปการใช้งานและการรีเซ็ต" className="rounded-2xl border border-cyan-900/60 bg-slate-950/60 p-4">
      <h3 className="text-sm font-semibold text-slate-100">การใช้งานและรอบรีเซ็ต</h3>
      <div className="mt-3 space-y-3 text-sm">
        <div>
          <p className="text-slate-300">โควตารายวัน: <span className="font-semibold text-white">{props.summaryUsedToday ?? "ไม่ทราบ"} / {props.summaryDailyLimit ?? "ไม่ทราบ"} เคส</span></p>
          <p className="text-xs text-slate-400">รีเซ็ตรายวัน: {formatUsageReset(props.summaryResetAt)} (เวลาไทย)</p>
        </div>
        <div className="border-t border-slate-800 pt-3">
          {props.allowanceDisplayMode === "legacy_units" ? <>
            <p className="text-slate-300">หน่วยสิทธิ์รอบเดิม: <span className="font-semibold text-white">ใช้แล้ว {props.used} · คงเหลือ {props.remaining} จาก {props.total}</span></p>
            <p className="mt-1 text-xs leading-relaxed text-slate-400">ตัวเลขนี้เป็นหน่วยสิทธิ์ของแพ็กเกจรอบเดิม ไม่ใช่จำนวนเคส; เพดานรายวันนับจำนวนครั้ง ส่วนรอบนโยบายใหม่แสดงการใช้วงเงิน AI เป็นเปอร์เซ็นต์</p>
            {props.grandfathered ? <p className="mt-2 rounded-lg border border-amber-700/40 bg-amber-950/20 p-2 text-xs leading-relaxed text-amber-200">แพ็กเกจรอบที่ชำระอยู่ยังคงเงื่อนไขเดิมถึงวันสิ้นสุดรอบข้างต้น เงื่อนไขใหม่จึงเริ่มเมื่อรอบต่ออายุ</p> : null}
            <p className="mt-1 text-xs text-slate-400">สิ้นสุดรอบแพ็กเกจ: {formatUsageReset(props.periodEnd)} (เวลาไทย)</p>
          </> : props.allowanceDisplayMode === "ai_cost" ? <>
            <p className="text-slate-300">วงเงิน AI รอบนี้ (ประเมินตามปริมาณประมวลผล)</p>
            {typeof percent === "number" ? <div className="mt-2" aria-label={`ใช้วงเงิน AI รอบนี้แล้ว ${percent}%`}>
              <div className="h-2 overflow-hidden rounded-full bg-slate-800"><div className="h-full rounded-full bg-cyan-400" style={{ width: `${Math.max(0, Math.min(100, percent))}%` }} /></div>
              <p className="mt-1 text-xs text-slate-400">ใช้วงเงิน AI ไปแล้ว {percent}%</p>
            </div> : <p className="mt-1 text-xs text-amber-300">ข้อมูลวงเงิน AI ยังไม่พร้อมแสดง</p>}
            <p className="mt-1 text-xs text-slate-400">วงเงินรีเซ็ต: {formatUsageReset(props.periodAllowanceResetAt)} (เวลาไทย)</p>
            <p className="mt-1 text-xs text-slate-400">สิ้นสุดรอบแพ็กเกจ: {formatUsageReset(props.periodEnd)} (เวลาไทย)</p>
          </> : <p className="text-xs text-amber-300">ข้อมูลวงเงิน AI ยังไม่พร้อมแสดง</p>}
        </div>
        <div className="border-t border-slate-800 pt-3">
          <p className="text-slate-300">Boost คงเหลือ: <span className="font-semibold text-white">{props.boostCredits} สิทธิ์</span></p>
          <p className="mt-1 text-xs text-slate-400">Boost คือสิทธิ์สรุปเพิ่ม แยกจากตัวเลขวงเงินปกติ เคสยาวหรือมีรูปอาจใช้วงเงิน AI มากกว่า เมื่อถึงขีดจำกัดให้รอเวลาที่แสดง หรือใช้ Boost หากมีสิทธิ์</p>
          {props.active && props.canPurchaseBoost ? <div className="mt-2 flex gap-2"><BoostPurchaseButton credits={5} compact /><BoostPurchaseButton credits={15} compact /></div> : null}
        </div>
        <p className="border-t border-slate-800 pt-3 text-xs text-slate-400">สถานะแพ็กเกจ: {props.active ? "ใช้งานอยู่" : "หมดอายุหรือยังไม่ active"}</p>
      </div>
    </section>
  );
}
