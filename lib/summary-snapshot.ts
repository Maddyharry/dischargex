import { deidentify } from "./deidentify";

const MAX_SNAPSHOT_CHARS = 48_000;
const likelyIdentifierPatterns = [
  /\b(?:HN|AN|MRN|CID|PID|VN)\s*[:：=/-]\s*[A-Z0-9๐-๙][A-Z0-9๐-๙./_-]*/i,
  /(?<![\d๐-๙])(?:[0-9๐-๙][\s.-]?){12}[0-9๐-๙](?![\d๐-๙])/,
  /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i,
  /(?<![\d๐-๙])(?:\+?66|0)(?:[ \t().-]*[0-9๐-๙]){8,10}(?![\d๐-๙])/,
  /(?:ชื่อผู้ป่วย|patient\s*name|วันเกิด|วันเดือนปีเกิด|ที่อยู่|address)\s*[:：=]\s*(?!\[REDACTED\])/i,
];

/** Stores only best-effort redacted text. Null means do not persist the snapshot. */
export function createDeidentifiedSummarySnapshot(source: string, result: string): string | null {
  try {
    const safeSource = deidentify(source).trim();
    const safeResult = deidentify(result).trim();
    if (!safeResult || likelyIdentifierPatterns.some((pattern) => pattern.test(safeResult))) return null;
    const sourceIsSafeEnoughToStore = Boolean(safeSource) &&
      !likelyIdentifierPatterns.some((pattern) => pattern.test(safeSource));
    const header = "ข้อมูลต้นทาง (ผ่านการปกปิดแบบ best-effort; โปรดตรวจทานเอง)\n";
    const summaryHeader = "\n\nผลสรุป\n";
    const available = MAX_SNAPSHOT_CHARS - header.length - summaryHeader.length - 100;
    if (available <= 0) return null;
    const safeSourceForStorage = sourceIsSafeEnoughToStore
      ? safeSource
      : "ไม่ได้บันทึกข้อความต้นทาง เนื่องจากระบบพบข้อมูลที่อาจระบุตัวบุคคล";
    const sourceLimit = Math.min(safeSourceForStorage.length, Math.floor(available * 0.55));
    const resultLimit = available - sourceLimit;
    return `${header}${safeSourceForStorage.slice(0, sourceLimit)}${safeSourceForStorage.length > sourceLimit ? "\n[ข้อมูลต้นทางถูกตัดให้สั้น]" : ""}${summaryHeader}${safeResult.slice(0, resultLimit)}${safeResult.length > resultLimit ? "\n[ผลสรุปถูกตัดให้สั้น]" : ""}`;
  } catch {
    return null;
  }
}
