/**
 * Best-effort text redaction for common labeled identifiers. This is not a
 * guarantee of anonymization; clinical text still needs human review.
 */
const patterns: RegExp[] = [
  // HN / AN / MRN style labels with whitespace and common separators.
  /\b(?:HN|AN|MRN|CID|PID|VN)[ \t]*[:：=\/-][ \t]*[A-Z0-9๐-๙][A-Z0-9๐-๙./_-]*/gi,
  /\b(?:HN|AN|MRN|CID|PID|VN)[ \t]+(?=[0-9๐-๙])[A-Z0-9๐-๙][A-Z0-9๐-๙./_-]*/g,
  // Thai citizen ID, allowing Thai numerals and separators.
  /(?<![\d๐-๙])(?:[0-9๐-๙][\s.-]?){12}[0-9๐-๙](?![\d๐-๙])/g,
  /(?<![\d๐-๙])(?:[0-9๐-๙]){9,12}(?![\d๐-๙])/g,
  // Labeled names, with or without honorifics (Thai and English).
  /(?:ชื่อผู้ป่วย|ชื่อ|patient[ \t]*name|name)[ \t]*[:：=][ \t]*(?:(?:นาย|นาง|นางสาว|น\.ส\.|ด\.ช\.|ด\.ญ\.|Mr\.?|Mrs\.?|Ms\.?|Miss)[ \t]*)?[ก-๙A-Za-z][ก-๙A-Za-z.'’-]*(?:[ \t]+[ก-๙A-Za-z][ก-๙A-Za-z.'’-]*){0,3}/gi,
  /(?<![ก-๙A-Za-z])(?:นาย|นางสาว|นาง|น\.ส\.|ด\.ช\.|ด\.ญ\.)[ \t]*[ก-๙]+(?:[ \t]+[ก-๙]+){1,3}/g,
  /\b(?:Mr|Mrs|Ms|Miss)\.?[ \t]+[A-Za-z][A-Za-z.'’-]*(?:[ \t]+[A-Za-z][A-Za-z.'’-]*){1,3}\b/gi,
  // Contact details, including country codes and spaces.
  /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi,
  /(?<![\d๐-๙])(?:\+?66|0)(?:[ \t().-]*[0-9๐-๙]){8,10}(?![\d๐-๙])/g,
  // Explicitly labeled address and birth date fields.
  /(?:ที่อยู่|address|บ้านเลขที่)[ \t]*[:：=][ \t]*(?:(?!\x5c[nr])[^\r\n,;"']){1,160}/gi,
  /(?:วันเกิด|วันเดือนปีเกิด|เกิดวันที่|date[ \t]*of[ \t]*birth|DOB)[ \t]*[:：=][ \t]*(?:(?!\x5c[nr])[^\r\n,;"']){1,50}/gi,
  // Medical staff names and hospital identifiers.
  /(?:นพ\.?|น\.พ\.?|พญ\.?|นายแพทย์|แพทย์หญิง)[ \t]*[ก-๙]+(?:[ \t]+[ก-๙]+){0,2}/g,
  /พยาบาล[ \t]*(?:ผู้ดูแล|เวร|ประจำ)?[ \t]*[:：][ \t]*[ก-๙]+(?:[ \t]+[ก-๙]+)?/g,
  /(?:โรงพยาบาล|รพ\.)\s*[ก-๙A-Za-z]+/g,
];

export function deidentify(text: string): string {
  let result = String(text ?? "");
  for (const pattern of patterns) result = result.replace(pattern, "[REDACTED]");
  return result;
}
