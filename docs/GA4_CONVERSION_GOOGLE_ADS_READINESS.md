# DischargeX: สถานะ Conversion และแผนเตรียม Google Ads

เอกสารนี้แยกหลักฐานจากโค้ด, telemetry ฝั่งระบบ และการตรวจ GA4 จริงออกจากกัน เพื่อไม่ตีความ event ที่มีโค้ดรองรับว่าเป็น conversion ที่ยืนยันแล้ว

## สรุปสถานะ

- **GA4 production page view: PASS แบบมีขอบเขต** — เคยตรวจ consent accept แล้วพบ `page_view` เข้า GA4 Realtime/DebugView บนหน้า public; การปฏิเสธ consent ไม่ส่ง Google request. หลักฐานเดิมยืนยันหน้า public ที่ทดสอบ ไม่ได้ยืนยันทุก URL
- **Google Ads: ยังปิดอยู่** — ไม่พบ Production environment variable สำหรับ Ads ID หรือ conversion labels. ไม่มีการสร้างแคมเปญหรือใช้งบ
- **Conversion funnel: PARTIAL** — มี implementation และ server-side validation หลายขั้น แต่ยังขาดหลักฐาน production ที่ยืนยัน conversion จริงสำหรับ signup, first case, checkout และ purchase
- **Knowledge detail page view: code fix added, not deployed** — เฉพาะ static public detail slug จะเข้า GA4 หลัง analytics consent; index, admin-like/invalid slugs และ detail URL ที่มี query/hash ถูกกันออกจาก page view

## Funnel และหลักฐาน

ข้อมูล telemetry ต่อไปนี้เป็นยอดรวม 30 วัน ไม่มีรายชื่อหรือข้อมูลผู้ใช้:

| ขั้นตอน | สถานะ | หลักฐาน/เงื่อนไข |
|---|---|---|
| Landing / `page_view` | **PASS เฉพาะหน้าที่ทดสอบ** | ตรวจ production consent accept และพบ page view ใน GA4; หน้า public อื่นต้องทดสอบแยก |
| `demo_started` | **PARTIAL** | telemetry ภายใน 2 ครั้งในช่วงรายงาน; ก่อน parent ทำ mock tutorial มี 1 ครั้ง และเพิ่มเป็น 2 หลังทดสอบจำลอง 1 ครั้ง. GA4 event ยังไม่มีหลักฐาน production ยืนยัน |
| `demo_completed` | **PARTIAL** | telemetry ภายใน 2 ครั้งในช่วงรายงาน; ก่อน parent ทำ mock tutorial มี 1 ครั้ง และเพิ่มเป็น 2 หลังทดสอบจำลอง 1 ครั้ง. GA4 event ยังไม่มีหลักฐาน production ยืนยัน |
| `sign_up` | **PARTIAL / NOT VERIFIED** | Email signup ส่งหลัง API สมัครตอบสำเร็จเท่านั้น; telemetry ภายในที่ยืนยันได้ 0. ไม่มี signal ที่เชื่อถือได้สำหรับ Google OAuth signup จึงไม่เพิ่ม conversion สำหรับ OAuth |
| `first_case_completed` | **NOT VERIFIED** | โค้ด claim marker หลัง Generate สำเร็จและบันทึก transaction; telemetry ภายในที่ยืนยันได้ 0. ไม่ใช้ข้อมูลผู้ป่วยหรือสร้างเคสจริงเพื่อทดสอบ |
| `pricing_viewed` | **PARTIAL** | telemetry ภายใน 7 ครั้งใน 30 วัน; implementation ขอ consent และ dedupe ต่อ session. การมองเห็น body ของ custom event ใน browser capture ไม่ชัดเจน จึงสรุปว่า inconclusive; ยังยืนยันการรับ event ใน GA4 ไม่ได้ |
| `begin_checkout` | **NOT VERIFIED** | โค้ดส่งเมื่อ checkout API สำเร็จและคืน URL เท่านั้น; ไม่มีการสร้าง checkout เพื่อทดสอบในงานนี้ |
| `purchase` | **NOT VERIFIED** | telemetry ภายในที่ยืนยันได้ 0. โค้ดต้องตรวจ Stripe paid, webhook-applied entitlement, เจ้าของ session, ยอด THB และ customer ก่อนส่ง; ไม่มีการซื้อจริงเพื่อทดสอบ |

ยอด 0 หมายถึงไม่มีรายการที่ telemetry ภายในยืนยันได้ในช่วงที่รายงาน ไม่ได้ยืนยันว่าไม่มีการใช้งานที่ไม่ถูกบันทึก

## Consent, ความเป็นส่วนตัว และ dedupe

- Consent ทุกประเภทเริ่มต้นเป็น denied; GA4 ต้องมี analytics consent ก่อนโหลด tag หรือส่ง event
- Reject/no consent ไม่ควรมี Google request. เมื่อยอมรับ analytics จึงโหลด GA4; marketing consent แยกจาก analytics และ Ads IDs/labels ยังไม่ได้ตั้งค่า
- GA `page_location` ใช้ origin กับ pathname ที่ sanitize แล้ว; `page_referrer` ว่าง; event ไม่ใส่ slug ความรู้เป็น custom parameter
- Public knowledge detail ใช้ client-safe allowlist ของ 45 slug และทดสอบให้ตรงกับ static SEO slug list. `/knowledge`, admin-like/unknown slug, path รูปแบบผิด และ query/hash บน knowledge detail ไม่ได้ page view
- Sensitive routes เช่น account, admin, chat, auth และ workflow สรุปชาร์จไม่ส่ง Google event
- Event schema เป็น allowlist และปฏิเสธ field เพิ่มเติม; payload ไม่รับ email, free text, clinical note, HN/AN หรือข้อมูลผู้ป่วย
- Signup event ส่งหลังสมัครสำเร็จ ไม่ส่งจากการกดปุ่มหรือการเปิดหน้า
- `first_case_completed` มี marker ต่อผู้ใช้หลัง Generate สำเร็จ; ไม่รวม retry, failure หรือ recalc
- `purchase` ผูกกับ transaction ID ที่ผ่าน Stripe/webhook verification และ dedupe ฝั่งระบบกับ browser. GA4 DebugView/Realtime ของ purchase ยังไม่ยืนยัน
- ข้อจำกัด: telemetry ภายในยืนยันว่าระบบรับ event แต่ไม่ได้ยืนยันว่า GA4 ประมวลผล event นั้น; client-side purchase อาจไม่ถูกส่งหากผู้ใช้ไม่กลับหน้า success หลัง Stripe แม้ backend ให้สิทธิ์แล้ว

## `pricing_viewed` audit

ตรวจลำดับใน `WebAnalyticsTracker` และ `safe-analytics-client`: หน้า Pricing พยายามส่งหลังอ่าน consent; หาก Google Tag ยังไม่พร้อม event จะเข้าคิวด้วย ID คงที่ต่อ session และส่งเมื่อ tag พร้อม. ระบบเช็กทั้ง sent history และ pending queue ก่อนเพิ่ม event; มี test ครอบคลุมการ retry ใน session เดิมและการ dedupe. ไม่พบ deterministic regression ที่พิสูจน์ได้ จึงไม่มีการเปลี่ยน implementation ส่วนนี้. Browser capture มองเห็น custom-event body ไม่ชัดเจน จึงถือว่าหลักฐานเครือข่าย inconclusive ไม่ใช่หลักฐานว่า GA4 รับ event แล้ว

## GA4 Key Events ที่แนะนำ

1. **Primary: `purchase`** เมื่อ GA4 ยืนยันเหตุการณ์จาก transaction ที่ชำระจริงและ entitlement ถูกใช้แล้ว
2. **Secondary: `first_case_completed`** เป็นสัญญาณ activation ที่มีคุณภาพ แต่ต้องยืนยัน production event และ privacy flow ก่อน
3. **Secondary: `begin_checkout`** ใช้ดูความตั้งใจซื้อ ไม่ควรนับเป็นยอดขาย
4. `sign_up`, `demo_completed` ใช้เป็น funnel diagnostics ก่อน ยังไม่ควรเป็นเป้าหมายหลักของ Ads
5. `page_view`, `pricing_viewed`, `demo_started` เป็นพฤติกรรมประกอบ ไม่ควรกำหนดทั้งหมดเป็น Primary conversion

ก่อนนำ event เข้า Google Ads ให้เลือกเฉพาะ conversion ที่เจ้าของธุรกิจยอมรับว่าเป็นผลลัพธ์จริง และตั้ง attribution/counting ตามรอบการซื้อที่ต้องการ

## Google Ads Search draft — ประเทศไทย

สถานะ: **แผนร่างเท่านั้น; campaign และค่าใช้จ่ายยังปิดอยู่.** งบสมมติสำหรับการทดลองคือ ฿100/วัน เป็นเวลา 14 วัน รวมวงเงินสูงสุด ฿1,400 เมื่อเจ้าของอนุมัติภายหลัง. ยังไม่มีข้อมูล Keyword Planner ที่ยืนยันปริมาณค้นหา, CPC หรือการแข่งขัน จึงไม่ใส่ตัวเลขคาดการณ์

### กลุ่มคำค้นสมมติฐาน

เริ่มตรวจใน Keyword Planner แล้วค่อยเลือก Exact/Phrase ตาม intent และ Search Terms จริง:

- **สรุปชาร์จ:** `[โปรแกรมสรุปชาร์จ]`, `"โปรแกรมสรุปชาร์จ"`, `"discharge summary"`, `"สรุปชาร์จผู้ป่วยใน"`
- **ทบทวน coding:** `[เครื่องมือช่วย coding เวชระเบียน]`, `"ทบทวนรหัส ICD-10"`, `"ICD-10 coding review"`
- **งาน IPD:** `"สรุป diagnosis ผู้ป่วยใน"`, `"โปรแกรมช่วยสรุปเวชระเบียน IPD"`

กลุ่ม ICD ทั่วไปควรจำกัดด้วยคำ IPD/coding เพราะการค้นหารหัสโรคทั่วไปอาจไม่ใช่ผู้ซื้อเป้าหมาย

### Negative keyword ตั้งต้นเพื่อทบทวน

`สมัครงาน`, `งาน`, `เงินเดือน`, `ข้อสอบ`, `เฉลย`, `เรียน`, `โหลดฟรี`, `crack`, `เถื่อน`, `คนไข้`, `รักษาออนไลน์`, `วินิจฉัยออนไลน์`, `ปรึกษาแพทย์`

ตรวจ Search Terms ก่อนเพิ่มจริง โดยเฉพาะคำที่อาจมีความหมายต่อบุคลากรทางการแพทย์

### Responsive Search Ad draft

หัวข้อ:

- ช่วยสรุปชาร์จผู้ป่วยใน
- จัดระเบียบข้อมูลเพื่อทบทวน Coding
- ลดงานคัดลอกข้อมูลซ้ำ
- มีผลลัพธ์ให้ตรวจทานก่อนใช้งาน
- ทดลองใช้ DischargeX

คำอธิบาย:

- ช่วยจัดข้อมูลสรุปชาร์จและรหัสที่เกี่ยวข้องให้อ่านทบทวนง่าย แพทย์และผู้ตรวจต้องยืนยันกับเวชระเบียนต้นฉบับ
- ดูตัวอย่างขั้นตอนและเลือกแพ็กเกจตามการใช้งาน ข้อมูลที่สร้างเป็นเครื่องมือช่วยทบทวน ไม่ใช่คำวินิจฉัยหรือการรับรองการเบิกจ่าย

ตรวจนโยบายโฆษณาด้านสุขภาพและหน้า landing ก่อนส่งโฆษณา ห้ามกล่าวอ้างว่าระบบวินิจฉัยหรือรับประกันผล coding

### Landing page map

| Intent | หน้าแนะนำ | เหตุผล |
|---|---|---|
| สรุปชาร์จ / ทดลองผลิตภัณฑ์ | `/` | อธิบายประโยชน์และพาไป demo/signup |
| เลือกซื้อแพ็กเกจ | `/pricing` | แสดงราคาและเงื่อนไขก่อนเริ่ม checkout |
| ค้นหาความรู้เฉพาะโรคหรือ coding | `/knowledge/<public-slug>` หลัง deploy analytics fix | ให้เนื้อหาสาธารณะตรงคำค้น; ห้ามส่ง query/hash ไป GA |
| ข้อมูลวิธีใช้ | `/learn` | ใช้เป็น landing เฉพาะเมื่อข้อความตรงกับ intent |

อย่าใช้หน้า account, auth, chat, หรือ workflow patient-facing ภายในระบบเป็น landing page สำหรับ Ads

### UTM convention

รูปแบบ: `utm_source=google&utm_medium=cpc&utm_campaign=th_search_{theme}_{yyyymm}&utm_content={variant}`

UTM ใช้รหัสแคมเปญ/โฆษณาทั่วไปเท่านั้น ห้ามใส่ชื่อ, email, HN/AN, diagnosis รายบุคคล, free text หรือ URL ที่มีข้อมูลผู้ป่วย. Query string ไม่ถูกส่งเป็น GA page location; ให้ยืนยัน attribution ใน preview ก่อนเปิดแคมเปญ

### แผนทดลองและกติกาหยุด/ขยาย

- จำกัดการทดลอง 14 วันและไม่เกินงบรวม ฿1,400 ที่เจ้าของอนุมัติ; ตั้ง daily budget ฿100
- หยุดทันทีเมื่อ consent, privacy, billing หรือ conversion tracking ผิดปกติ; หยุดเมื่อถึงงบรวม/วันสิ้นสุด
- ตรวจ search terms และ landing behavior ทุก 2–3 วัน; เพิ่ม negative keywords เมื่อพบ intent ที่ไม่เกี่ยวข้อง
- ก่อนเพิ่มงบ ต้องมี purchase/qualified conversion ที่ตรวจสอบได้, คำนวณ CPA จากยอดจริง และให้เจ้าของอนุมัติ. หากยังไม่มี conversion หลังใช้ครึ่งวงเงิน ให้พักเพื่อทบทวน keyword/landing/tracking แทนการเพิ่มงบ
- อย่าขยายเพราะ click หรือ signup อย่างเดียว และอย่าตีความ demo/page view เป็นยอดขาย

## งานที่ต้องทำก่อนเปิดโฆษณา

1. Deploy และตรวจหน้า knowledge detail ใหม่ด้วย analytics consent accept/reject; ยืนยัน `/knowledge` และ sensitive routes ไม่มี Google event
2. ตรวจ GA4 DebugView/Realtime สำหรับ `pricing_viewed`, demo, signup และ first case ในบัญชีทดสอบที่ได้รับอนุญาต โดยใช้ข้อมูลจำลองเท่านั้น
3. ยืนยัน conversion attribution จริงใน GA4; ยังไม่สร้าง purchase ปลอมและไม่ทำธุรกรรมเงินจริงเพื่อทดสอบ
4. ตัดสินใจว่าจะวัด Google OAuth signup อย่างไร; ปัจจุบันไม่ส่ง `sign_up` สำหรับ OAuth เพราะยังไม่มีจุดสำเร็จที่ dedupe ได้อย่างแม่นยำโดยไม่ขยาย auth/database
5. หากจะใช้ Ads conversion โดยตรง ให้เจ้าของตั้งค่า Ads ID/labels และยืนยัน consent policy ก่อน; ห้ามใส่ placeholder
6. ใช้ Keyword Planner ตรวจ volume/CPC/competition, ยืนยันกลุ่มเป้าหมายและหน้า landing
7. เจ้าของอนุมัติ conversion goals, creative, งบ และวันเริ่มก่อนเปิด campaign

ไม่มี campaign, billing หรือค่าโฆษณาถูกสร้างหรือเปิดจากงานนี้
