import { TUTORIAL_MOCK_RESULT } from "@/lib/tutorial-mock-snapshot";

/** localStorage: ผู้ใช้ที่จบหรือข้าม tutorial (ทั้งสมาชิกและ guest) */
export const WORKSPACE_TUTORIAL_DONE_KEY = "dischargex_workspace_tutorial_done";

export function readWorkspaceTutorialDone(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(WORKSPACE_TUTORIAL_DONE_KEY) === "1";
  } catch {
    return false;
  }
}

/** ตัวอย่างหน้า order sheet (IPD paperless) — คลิกในช่องนี้แล้ว Ctrl+A เลือกเฉพาะกล่องนี้ */
export const TUTORIAL_SAMPLE_ORDER_SHEET = `=== IPD Paperless · Doctor's Order (ตัวอย่างการสาธิต) ===
Ward: Med 7    HN: DEMO-0001    ชื่อ: ตัวอย่าง (ไม่ใช่ข้อมูลจริง)

Sex: Female
Age: 78 ปี 10 เดือน
=== ORDER_SHEET ===
Date Time ORDER FOR ONE DAY CONTINUOUS ORDER
19/02/69
10:33
Other
- Retain foley's cayth No.14
19/02/69
09:45
Medication
- Diazepam inj. 10 mg/2ml. Ampule (2 ml.) [STAT]
ฉีดเข้าเส้นเลือด 1 amp ทันที
Other
- on ETT , no.7 Mark 19
- refer
- case หญิง 78 ปี U/D HT
admit รพ.บ้านไร่ 18/2/69
CC เหนื่อยมากขึ้น 3 วัน
PI 3 วัน ไข้ ไอเสมหะเยอะ อ่อนเพลีย
วันนี้เหนื่อยมากขึ้น รักษาคลินิกได้ CXR RLL infiltration จึงมารพ.
PE not pale, no jx , dyspnea, lung crepitation RLL, fair air entry,
heart regular, no murmur, abdomen soft, not tender ,
no pitting edema
CXR RLL infiltration
SpO2 84
Dx pneumonia
Rx ceftri + Rulid , berodual NB
เช้านี้ ไอ เหนื่อยมากขึ้น ร้องคราง
RR 36,accesory muscle use, lung crepitation Rt lung, poor air entry
SpO2 83 on mask c bag
on ETT No.7 Mark 19, valium10mg iv ก่อน ETT
1.Lobar pneumonia RLL with septic shock
2.AKI
3.acute respiratory failure
consult นพ.สุรเดช ให้ refer ได้
19/02/69 09:45
S : เหนื่อยมากขึ้น ร้องคราง
accesory m. use RR 36 , SpO2 83 on mask c bag
lung crepitation Rt lung , decrease BS
19/02/69
07:52
Medication
- *Berodual NB 1.25+0.5 mg/4 ml. หลอด (4 ml.)
พ่นผ่านเครื่องละอองฟอย 1 NB q 4 hr [Locked]
- NSS [1,000 ml.] 0.9 % ขวด
IV rate 80 ml/hr
Examination
- Lab : Sputum Culture : <Item>
- Lab : Sputum AFB 1 ครั้ง : <Item>
x 3 วัน
- Lab : Gram stain : <Item>
sputum
19/02/69 07:52
S : case U/D HT
CC เหนื่อยมากขึ้น 3 วัน
PI 3 วัน ไข้ ไอเสมหะเยอะ อ่อนเพลีย มีไข้
วันนี้เหนื่อยมากขึ้น รักษาคลินิกได้ CXR พบ ปอดบวม
O : not pale, no jx , dyspnea, lung crepitation RLL
no pitting edema
CXR RLL infiltration
SpO2 84
A : Lobar pneumonia RLL with septic shock
AKI
P : septic w/u , IV load, IV ATB
19/02/69
07:19
Medication
- Dexamethasone inj. 4 mg/ml. Ampule (1 ml.) [STAT]
ฉีดเข้าเส้นเลือดดำ 1 amp/vial [Locked]
Examination
- Radiology : Film CXR (PA)
19/02/69 07:19
Note : รายงานผู้ป่วยหายใจเหนื่อย RR 28/min retraction หายใจเป่าปาก + urine 100 ml/8hr แพทย์รับทราบ
18/02/69
19:24
Medication
- NSS [1,000 ml.] 0.9 % ขวด
500 ml iv load [Locked]
18/02/69 19:24
S : ปฏิเสธกินยาชุด ยาสมุนไพร ยาหม้อ
O : U/S IVC kissing IVC
try load NSS 500 ml
18/02/69
18:40
Medication
- *Berodual NB 1.25+0.5 mg/4 ml. หลอด (4 ml.)
พ่นผ่านเครื่องละอองฟอย 1 NB q 15 min x 2 doses [Locked]
- *Berodual NB 1.25+0.5 mg/4 ml. หลอด (4 ml.)
พ่นผ่านเครื่องละอองฟอย 1 NB q 4 hr [Locked]
- NSS [1,000 ml.] 0.9 % ขวด
1000 ml iv load [Locked]
- NSS [1,000 ml.] 0.9 % ขวด
IV rate 80 ml/hr
Operation
- E.C.G.(Electrocardiography)`;

/** ผลสรุปสาธิต — ดึงจาก snapshot ที่จัดรูปแบบใกล้ผลจริง (แก้ที่ tutorial-mock-snapshot.ts) */
export function buildTutorialMockApiResponse() {
  return {
    result: structuredClone(TUTORIAL_MOCK_RESULT),
  };
}
