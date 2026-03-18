export const THAI_PROVINCES = [
  "กรุงเทพมหานคร",
  "กระบี่",
  "กาญจนบุรี",
  "กาฬสินธุ์",
  "กำแพงเพชร",
  "ขอนแก่น",
  "จันทบุรี",
  "ฉะเชิงเทรา",
  "ชลบุรี",
  "ชัยนาท",
  "ชัยภูมิ",
  "ชุมพร",
  "เชียงราย",
  "เชียงใหม่",
  "ตรัง",
  "ตราด",
  "ตาก",
  "นครนายก",
  "นครปฐม",
  "นครพนม",
  "นครราชสีมา",
  "นครศรีธรรมราช",
  "นครสวรรค์",
  "นนทบุรี",
  "นราธิวาส",
  "น่าน",
  "บึงกาฬ",
  "บุรีรัมย์",
  "ปทุมธานี",
  "ประจวบคีรีขันธ์",
  "ปราจีนบุรี",
  "ปัตตานี",
  "พระนครศรีอยุธยา",
  "พะเยา",
  "พังงา",
  "พัทลุง",
  "พิจิตร",
  "พิษณุโลก",
  "เพชรบุรี",
  "เพชรบูรณ์",
  "แพร่",
  "ภูเก็ต",
  "มหาสารคาม",
  "มุกดาหาร",
  "แม่ฮ่องสอน",
  "ยโสธร",
  "ยะลา",
  "ร้อยเอ็ด",
  "ระนอง",
  "ระยอง",
  "ราชบุรี",
  "ลพบุรี",
  "ลำปาง",
  "ลำพูน",
  "เลย",
  "ศรีสะเกษ",
  "สกลนคร",
  "สงขลา",
  "สตูล",
  "สมุทรปราการ",
  "สมุทรสาคร",
  "สมุทรสงคราม",
  "สระแก้ว",
  "สระบุรี",
  "สิงห์บุรี",
  "สุโขทัย",
  "สุพรรณบุรี",
  "สุราษฎร์ธานี",
  "สุรินทร์",
  "หนองคาย",
  "หนองบัวลำภู",
  "อ่างทอง",
  "อำนาจเจริญ",
  "อุดรธานี",
  "อุตรดิตถ์",
  "อุทัยธานี",
  "อุบลราชธานี",
];

export function validateBirthDateBE(value: string): string | null {
  const s = (value || "").trim();
  if (!s) return "กรุณากรอกวันเกิด";
  const match = s.match(/^(\d{1,2})\s*\/\s*(\d{1,2})\s*\/\s*(\d{4})$/);
  if (!match) return "รูปแบบไม่ถูกต้อง ใช้ วว/ดด/ปี พ.ศ. (เช่น 15/8/2543)";
  const day = parseInt(match[1], 10);
  const month = parseInt(match[2], 10);
  const yearBE = parseInt(match[3], 10);
  if (yearBE < 2468 || yearBE > 2580) return "ปี พ.ศ. ควรอยู่ช่วง 2468–2580";
  if (month < 1 || month > 12) return "เดือนต้องอยู่ระหว่าง 1–12";
  if (day < 1 || day > 31) return "วันต้องอยู่ระหว่าง 1–31";
  const daysInMonth = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  const yearCE = yearBE - 543;
  const isLeap = (y: number) => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
  const maxDay = month === 2 ? (isLeap(yearCE) ? 29 : 28) : daysInMonth[month - 1];
  if (day > maxDay) return `วันในเดือนนี้ต้องไม่เกิน ${maxDay}`;
  return null;
}

export function normalizeThaiPhone(input: string): string {
  const raw = String(input || "").trim();
  if (!raw) return "";
  let digits = raw.replace(/[^\d+]/g, "");
  if (digits.startsWith("+66")) digits = "0" + digits.slice(3);
  digits = digits.replace(/\D/g, "");
  return digits;
}

export function validateThaiPhone(input: string): { ok: true; normalized: string } | { ok: false; error: string } {
  const digits = normalizeThaiPhone(input);
  if (!digits) return { ok: true, normalized: "" };
  if (digits.length !== 10) return { ok: false, error: "เบอร์โทรควรมี 10 หลัก (เช่น 0812345678)" };
  if (!digits.startsWith("0")) return { ok: false, error: "เบอร์โทรควรขึ้นต้นด้วย 0" };
  return { ok: true, normalized: digits };
}

