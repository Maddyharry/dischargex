/** Prefer explicit dates; chart boundaries are a reviewable fallback, never appointment dates. */
export type DateEvidence = { value: string | null; status: "found" | "missing" | "ambiguous"; source?: "label" | "chart_boundary" };
export type SummaryDates = { admit: DateEvidence; discharge: DateEvidence };
const months = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
const fullMonths = ["มกราคม","กุมภาพันธ์","มีนาคม","เมษายน","พฤษภาคม","มิถุนายน","กรกฎาคม","สิงหาคม","กันยายน","ตุลาคม","พฤศจิกายน","ธันวาคม"];
function digits(text: string) { return text.replace(/[๐-๙]/g, c => String(c.charCodeAt(0) - 0x0e50)); }
const datePattern = /(?<!\d)(?:\d{4}-\d{1,2}-\d{1,2}|\d{1,2}[/-]\d{1,2}[/-]\d{2,4}|\d{1,2}\s+(?:ม\.ค\.|ก\.พ\.|มี\.ค\.|เม\.ย\.|พ\.ค\.|มิ\.ย\.|ก\.ค\.|ส\.ค\.|ก\.ย\.|ต\.ค\.|พ\.ย\.|ธ\.ค\.|มกราคม|กุมภาพันธ์|มีนาคม|เมษายน|พฤษภาคม|มิถุนายน|กรกฎาคม|สิงหาคม|กันยายน|ตุลาคม|พฤศจิกายน|ธันวาคม)\s+(?:พ\.ศ\.\s*)?\d{2,4})(?!\d)/g;
const labelPattern = /\b(?:admission\s+date|date\s+of\s+admission|admit(?:ted)?(?:\s+date)?|discharge(?:d)?(?:\s+date)?|date\s+of\s+discharge|d\/c|dc)\b|วัน(?:ที่)?(?:รับไว้รักษา|รับเข้า|เข้าโรงพยาบาล|แอดมิ[ตท]|จำหน่าย|กลับบ้าน)|จำหน่าย/gi;

export function normalizeSummaryDate(raw: string): string | null {
  const text = digits(raw).trim();
  let day: number, month: number, year: number;
  const iso = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  const slash = text.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
  const named = text.match(/^(\d{1,2})\s+(.+?)\s+(?:พ\.ศ\.\s*)?(\d{2,4})$/);
  if (iso) [year, month, day] = iso.slice(1).map(Number);
  else if (slash) [day, month, year] = slash.slice(1).map(Number);
  else if (named) {
    day = Number(named[1]); year = Number(named[3]);
    const shortIndex = months.indexOf(named[2]);
    month = (shortIndex >= 0 ? shortIndex : fullMonths.indexOf(named[2])) + 1;
  } else return null;
  // HOSxP commonly uses short Buddhist years (e.g. 69). Reject ambiguous short older years.
  if (year < 100) { if (year < 40) return null; year += 2500; }
  if (year >= 2400) year -= 543;
  if (year < 1900 || year > 2100 || month < 1 || month > 12 || day < 1 || day > 31) return null;
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  return `${String(day).padStart(2,"0")}/${String(month).padStart(2,"0")}/${year + 543}`;
}

export function extractSummaryDates(raw: string): SummaryDates {
  const candidates: Record<"admit" | "discharge", Set<string>> = { admit: new Set(), discharge: new Set() };
  const lines = digits(raw).split(/\r?\n/);
  const appointment = /\b(?:f\s*\/\s*u|fu|follow[\s-]*up)\b|นัด/i;
  const chartDates = new Set<string>();
  // Only a date at the start of an entry is a chart timestamp. Dates embedded
  // in prescriptions, DOB, history and appointment instructions are not entries.
  for (let row = 0; row < lines.length; row++) {
    const line = lines[row].trim();
    const match = [...line.matchAll(datePattern)][0];
    if (!match || match.index !== 0) continue;
    const rest = line.slice(match[0].length).trim();
    const previous = lines[row - 1]?.trim() ?? "";
    if (appointment.test(rest) || /เกิด|birth|\bdob\b|history|previous|ย้อนหลัง|ประวัติ/i.test(rest)) continue;
    if (!rest && appointment.test(previous)) continue;
    // A naked date following any field label is that field's value, not a note.
    if (!rest && /[:：]\s*$/.test(previous)) continue;
    const value = normalizeSummaryDate(match[0]);
    if (value) chartDates.add(value);
  }
  for (let row = 0; row < lines.length; row++) {
    const line = lines[row];
    const labels = [...line.matchAll(labelPattern)];
    const dates = [...line.matchAll(datePattern)];
    const usedDates = new Set<number>();
    for (let i = 0; i < labels.length; i++) {
      const label = labels[i], index = label.index!;
      const kind = /discharge|d\/c|\bdc\b|จำหน่าย|กลับบ้าน/i.test(label[0]) ? "discharge" : "admit";
      // Plans, historical admissions and medication D/C are not confirmed encounter dates.
      const prefix = line.slice(Math.max(0,index - 45), index);
      if (/plan(?:ned)?|consider|นัด|วางแผน|เคย|previous|history|last\s*$/i.test(prefix)) continue;
      const previousLabelEnd = i ? labels[i-1].index! + labels[i-1][0].length : 0;
      const nextLabelStart = labels[i+1]?.index ?? line.length;
      const before = dates.filter(d => !usedDates.has(d.index!) && d.index! >= previousLabelEnd && d.index! + d[0].length <= index).at(-1);
      const after = dates.find(d => d.index! >= index + label[0].length && d.index! < nextLabelStart);
      // Timestamp immediately before an order belongs to that order, not the following day's entry.
      const immediateBefore = before && /^[\s:：,;|\-]*(?:\d{1,2}:\d{2}\s*)?$/.test(line.slice(before.index! + before[0].length,index));
      let selected = immediateBefore ? before : after;
      const gap = selected ? line.slice(Math.min(index+label[0].length, selected.index!),Math.max(index,selected.index!)) : "";
      if (appointment.test(gap) || /เกิด|birth|\bDOB\b/i.test(gap)) selected = undefined;
      // Standalone label/value on adjacent lines only; never scan across unrelated order text.
      if (!selected && labels.length === 1 && dates.length === 0 && /^\s*[:：-]?\s*$/.test(line.slice(index+label[0].length))) {
        const next = lines[row+1]?.trim() ?? "";
        const found = [...next.matchAll(datePattern)];
        if (found.length === 1 && next === found[0][0]) selected = found[0];
      }
      if (!selected) continue;
      // D/C meds is not discharge; only permit punctuation between shorthand and date.
      if (/^(?:d\/c|dc)$/i.test(label[0]) && !immediateBefore && after && !/^[\s:：-]*$/.test(line.slice(index+label[0].length,after.index))) continue;
      if (/^(?:d\/c|dc)$/i.test(label[0]) && immediateBefore && /\b(?:drug|med|iv|antibiotic|cef|stop)\b/i.test(line.slice(index+label[0].length))) continue;
      const value = normalizeSummaryDate(selected[0]);
      if (value) { candidates[kind].add(value); usedDates.add(selected.index!); }
    }
  }
  const resolve = (values: Set<string>): DateEvidence => values.size === 1 ? { value: [...values][0], status: "found", source: "label" } : { value: null, status: values.size ? "ambiguous" : "missing" };
  const result = { admit: resolve(candidates.admit), discharge: resolve(candidates.discharge) };
  const ordered = [...chartDates].sort((a,b) => {
    const key = (s: string) => s.split("/").reverse().join("");
    return key(a).localeCompare(key(b));
  });
  // Do not resolve conflicting admissions by guessing. A single unlabeled day
  // cannot establish both boundaries (possibly an incomplete chart).
  if (ordered.length >= 2 && result.admit.status !== "ambiguous" && result.discharge.status !== "ambiguous") {
    if (result.admit.status === "missing") result.admit = { value: ordered[0], status: "found", source: "chart_boundary" };
    if (result.discharge.status === "missing") result.discharge = { value: ordered.at(-1)!, status: "found", source: "chart_boundary" };
  }
  if (result.admit.value && result.discharge.value && summaryLosDays(result.admit.value,result.discharge.value) === null) {
    result.discharge = { value: null, status: "ambiguous" };
  }
  return result;
}

export function summaryLosDays(admit: string | null, discharge: string | null): number | null {
  function timestamp(value: string | null) {
    const date = value && normalizeSummaryDate(value);
    if (!date) return null;
    const [d,m,y] = date.split("/").map(Number);
    return Date.UTC(y-543,m-1,d);
  }
  const a=timestamp(admit), d=timestamp(discharge);
  return a===null || d===null || d<a ? null : Math.max(1,Math.round((d-a)/86400000));
}
