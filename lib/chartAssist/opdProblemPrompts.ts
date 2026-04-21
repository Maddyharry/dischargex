/** ระบบทางคลินิกสำหรับ OPD framework (Layer 2) */
export type ProblemSystem =
  | "skin"
  | "respiratory"
  | "gi"
  | "gu"
  | "msk"
  | "trauma"
  | "fever"
  | "general";

/** Layer 2: ถามต่อ — ตามระบบ (ภาษาไทย) */
export const HISTORY_ASK_NEXT: Record<ProblemSystem, string[]> = {
  skin: [
    "กำเริบเมื่อไร / ระยะเวลา (onset)",
    "ตำแหน่งแรกที่ขึ้น (first location)",
    "การลาม/แพร่กระจาย (progression)",
    "คันหรือเจ็บ — รุนแรงแค่ไหน",
    "คันมากตอนกลางคืนหรือไม่ (nocturnal itch)",
    "คนในบ้านคันหรือมีผื่นหรือไม่",
    "ไข้หรือไม่ — อาการทางเดินหายใจร่วมหรือไม่ (URI)",
    "มีหนอง / คราด / สะเก็ด / discharge หรือไม่",
    "เมือก ลิ้น ตา — มีร่วมหรือไม่ (mucosal)",
    "สัมผัสแมลง กลางแจ้ง สัตว์เลี้ยง สารระคายเคือง",
    "เคยรักษาอะไรมาแล้ว — ตอบสนองหรือไม่",
    "เคยเป็นแบบนี้ซ้ำหรือไม่ — ประวัติภูมิแพ้/atopy",
  ],
  respiratory: [
    "อัตราการหายใจ (RR) / หอบหรือไม่",
    "SpO₂ หรืออาการหายใจลำบาก",
    "การทำงานของหายใจ (retraction, nasal flaring)",
    "เสียงหายใจ / crackles / wheeze",
    "เด็ก: กินได้ / เล่นได้ / ปัสสาวะ",
    "ไข้หรือไม่ / ระยะเวลา",
  ],
  gi: [
    "สัญญาณขาดน้ำ (ปัสสาวะน้อย ปากแห้ง ตาโหล ซึม)",
    "ปวดท้อง / กดเจ็บ / guarding",
    "ท้องอืด / distension",
    "ลักษณะอุจจาระ / อาเจียน",
    "ปัสสาวะออกมากน้อย",
    "ยาเบื่อท้อง / กินอะไรก่อนล้มเหลว",
  ],
  gu: [
    "dysuria / frequency / urgency / hematuria — ระยะเวลา",
    "ปวดท้องน้อย / costovertebral angle tenderness (ถ้าเด่น)",
    "ประวัติ UTI ซ้ำ / ตั้งครรภ์ / catheter",
    "discharge ทางเดินปัสสาวะ / STI risk ตามบริบท",
    "ไข้หรือไม่ — แยก uncomplicated vs complicated",
  ],
  msk: [
    "ตำแหน่งปวด / รังสีไปขา/แขน (radicular)",
    "ประวัติบาดเจ็บ / ยกของหนัก",
    "การเคลื่อนไหวข้อ (ROM)",
    "จุดกดเจ็บเฉพาะจุด",
    "อาการรากประสาท / ชา / อ่อนแรง",
    "ความแรงอ่อนแรงระดับกล้ามเนื้อ",
    "red flags: ไข้, กลั้นปัสสาวะไม่ได้, อ่อนแรงกะทันหัน",
  ],
  trauma: [
    "กลไกการบาดเจ็บ / ความสูงของการล้ม",
    "สติ / GCS / ชักหลังบาดเจ็บ",
    "เลือดออก / แผล / บาดแผล",
    "คอ/กระดูกสันหลัง — ป้องกันการเคลื่อนไหว",
    "การทำงานของหายใจ (หลังหน้าอก)",
  ],
  fever: [
    "ระยะเวลาไข้ / รูปแบบสูงสุด",
    "แหล่งติดเชื้อที่สงสัย (หู คอ ปอด ผื่น ท้อง ปัสสาวะ)",
    "ยาแก้ไข้ / การตอบสนอง",
    "ซึม / กินไม่ได้ / ปัสสาวะน้อย",
  ],
  general: [
    "อาการสำคัญหลักและระยะเวลา",
    "อาการร่วมและอาการที่ไม่มี (pertinent negatives)",
    "ยาและการรักษาเดิม",
  ],
};

/** Layer 2: ตรวจต่อ — ตามระบบ */
export const EXAM_FOCUS_NEXT: Record<ProblemSystem, string[]> = {
  skin: [
    "morphology — macule/papule/vesicle/pustule/crust/scale",
    "distribution — กระจาย โฟกัส รูปแบบ dermatomal",
    "ซ้าย/ขวา หรือสมมาตร (bilateral vs unilateral)",
    "มีรอยแกะเกา (excoriation) หรือไม่",
    "ร้อน (warmth) / กดเจ็บ (tenderness)",
    "fluctuance / ฝี — ถ้าสงสัย abscess",
    "เมือก ลิ้น ตา — mucosal lesion",
    "ฝ่ามือ/ฝ่าเท้า — palm/sole involvement",
    "ระหว่างนิ้ว / burrow — ถ้าสงสัย scabies",
    "ต่อมน้ำเหลืองโต — ถ้าเกี่ยวข้อง",
  ],
  respiratory: [
    "RR, SpO₂",
    "work of breathing, retraction, nasal flaring",
    "auscultation — breath sounds",
    "เด็ก: กิน/activity",
  ],
  gi: [
    "สัญญาณขาดน้ำ (skin, fontanelle ถ้าเด็ก, cap refill)",
    "abdomen — tenderness, guarding, distension",
    "ลักษณะอุจจาระ / อาเจียน",
  ],
  gu: [
    "suprapubic / CVA tenderness ตามชี้",
    "urinalysis / dipstick ถ้ามี",
    "สัญญาณ systemic toxicity",
  ],
  msk: [
    "ตรวจกระดูกสันหลัง / จุดกดเจ็บ",
    "ROM / straight leg raise (ถ้าเหมาะสม)",
    "neuro — motor, sensory, reflex, สัญญาณ cauda equina",
  ],
  trauma: [
    "Primary survey ABCDE + c-spine control",
    "ทบทวน breathing, circulation, disability, exposure",
    "secondary survey เมื่อเสถียร",
  ],
  fever: [
    "Vital signs ครบ",
    "หาแหล่งติดเชื้อ — ตรวจตามโฟกัส",
    "perfusion / mental status",
  ],
  general: [
    "สัญญาณชีพ",
    "การตรวจตามประเด็นหลัก",
  ],
};

/** Pertinent negatives — แนะนำให้บันทึกถ้าตรวจแล้วไม่มี (กรองใน opdRecordFramework) */
export const NEGATIVE_TEMPLATES: Record<ProblemSystem, string[]> = {
  skin: [
    "ถ้าไม่มีผื่นที่เมือก/ลิ้น/ตา — ให้บันทึกชัด (no mucosal lesion)",
    "ถ้าไม่มีผื่นที่ฝ่ามือ/ฝ่าเท้า — ให้บันทึก (no palm/sole)",
    "ถ้าไม่มี abscess / fluctuance — ให้บันทึกเมื่อตรวจแล้วไม่มี",
    "ถ้าไม่มีรอยแดงลามเร็ว / ไม่มีร้อน — ให้บันทึก (no spreading erythema)",
    "ถ้าไม่มีคนในบ้านคัน — ให้บันทึก (no family itching)",
    "ถ้าไม่มีคันกลางคืนเป็นพิเศษ — ให้บันทึกเมื่อสอบถามแล้วไม่มี (no nocturnal itch)",
    "ถ้าไม่มีอาการ URI โดดเด่น — ให้บันทึก (ไม่ให้ default เป็น URI เพียงเพราะไอ/น้ำมูกร่วม)",
  ],
  respiratory: [
    "ถ้าไม่มี hypoxemia / SpO₂ ปกติ — ให้บันทึก",
    "ถ้าไม่มี retraction รุนแรง — ให้บันทึก",
    "ถ้าไม่มี focal crackles — ให้บันทึกชัด",
  ],
  gi: [
    "ถ้าไม่มี peritoneal signs — ให้บันทึก",
    "ถ้าไม่มีเลือดในอุจจาระ — ให้บันทึก",
    "ถ้าไม่มีสัญญาณขาดน้ำรุนแรง — ให้บันทึก",
  ],
  gu: [
    "ถ้าไม่มี CVA tenderness — ให้บันทึกเมื่อสอบถาม/ตรวจแล้ว",
    "ถ้าไม่มี hematuria — ให้บันทึกเมื่อตรวจแล้ว",
    "ถ้าไม่มี systemic toxicity — ให้บันทึก",
  ],
  msk: [
    "ถ้าไม่มี fever / ไม่มีกลั้นปัสสาวะไม่ได้ — ให้บันทึก (red flag)",
    "ถ้าไม่มีอ่อนแรง motor กะทันหัน — ให้บันทึก",
    "ถ้าไม่มี sensory level — ให้บันทึกชัด",
  ],
  trauma: [
    "ถ้า airway โล่ง / ไม่มี obstruction — ให้บันทึก",
    "ถ้าไม่มีเสียงปอดลดลงฝั่งเดียว — ให้บันทึก",
    "ถ้าไม่มีช็อก — ให้บันทึก perfusion",
  ],
  fever: [
    "ถ้าไม่มีภาวะ shock — ให้บันทึก",
    "ถ้าไม่มี altered mental status — ให้บันทึก",
  ],
  general: [
    "บันทึก pertinent negatives ที่ตรวจแล้วไม่มี",
  ],
};
