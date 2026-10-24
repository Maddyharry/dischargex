# DischargeX: SEO, Analytics และ Google Ads readiness

เอกสารส่งมอบสำหรับเตรียมวัดผลและโฆษณา ไม่ได้เปิดหรือแก้แคมเปญ

## สถานะและสิ่งที่ตรวจจาก repository

- ก่อนปรับปรุง `GoogleTag` ถูกโหลดบนหน้า public โดยตั้ง consent เป็น denied ชั่วครู่ แล้วโค้ดเปลี่ยนเป็น granted อัตโนมัติเมื่อเข้า public page ผู้ใช้จึงยังไม่ได้เลือกจริง
- `WebAnalyticsTracker` เดิมส่ง page path, CTA key, URL ปลายทาง และรหัส visitor/session ไปยัง `/api/telemetry/web` โดยไม่ได้ตรวจ consent ใน client
- หน้า Signup ยืนยันผลจากคำตอบสำเร็จของ `/api/auth/register`; หน้า Pricing ได้ checkout URL จริงจาก `/api/stripe/checkout` ก่อนพาไป Stripe
- หน้า Pricing เมื่อกลับจาก Stripe ตรวจเพียงสถานะ subscription/usage ในระบบ ไม่มี transaction ID และยอดเงินที่ยืนยันจาก Stripe ใน browser response ที่ใช้เป็น conversion handoff ได้ จึงไม่นับเป็น purchase event
- เนื้อหาหน้า `/knowledge` ปัจจุบันโหลดผ่าน API และมีการแก้ไข catalog โดย admin จึงไม่นำหน้านั้นมาเป็น SEO detail แบบ dynamic
- รายละเอียด `/knowledge/[slug]` ที่เพิ่มใหม่สร้างจาก `DISEASE_SUMMARIES` และ `KNOWLEDGE_REFERENCES` ที่เป็น static source ใน repository เท่านั้น เลือกเฉพาะหัวข้อที่ผ่าน structural audit ของ catalog (ข้อมูลนี้ไม่ใช่การรับรองความถูกต้องทางการแพทย์)
- Sitemap เพิ่มเฉพาะ URL detail ของหัวข้อ static ที่ผ่านเงื่อนไข และคง URL อื่นตามเดิม

## ขอบเขตความเป็นส่วนตัว

- Consent ด้าน analytics และ marketing เริ่มต้นเป็น denied แยกการเลือกกัน และบันทึกไว้ใน localStorage ของ browser; ผู้ใช้เปิดการตั้งค่าเพื่อเปลี่ยนภายหลังได้
- Google tag จะเริ่มโหลดเมื่อผู้ใช้ให้ consent ที่เกี่ยวข้องเท่านั้น และไม่ตั้ง automatic page view
- ส่ง GA4 `page_view` เฉพาะเมื่อ analytics consent เป็น true, มี GA4 ID และ route อยู่ใน allowlist ของ public pages (`/`, `/about`, `/pricing`, `/downloads`, `/learn`, `/legal`, `/privacy-policy`, `/terms-of-service`); ระบุ `send_to` เป็น GA4 Measurement ID โดยตรง, `page_location` สร้างจาก origin ปัจจุบันกับ pathname ที่ตัด query/hash แล้ว และ `page_referrer` เป็นสตริงว่าง
- GA4 event params ระบุ `send_to` เป็น `NEXT_PUBLIC_GA_MEASUREMENT_ID`; Google Ads conversion ยังคงระบุ `send_to` ด้วย Ads ID และ conversion label ของตนเอง. ทุก event ใช้ `page_location` จาก origin + pathname ที่ผ่านการตัด query/hash และกำหนด `page_referrer` เป็นค่าว่าง; event ของ GA4 ไม่ถูกส่งเมื่อไม่มี GA4 ID
- ไม่ส่ง query string, hash, referrer, ข้อความอิสระ, email, เนื้อหาผู้ป่วย หรือข้อมูลจากฟอร์มไปกับ event analytics; sensitive/internal route ไม่ส่ง Google event
- Client และ `/api/telemetry/web` ใช้ event allowlist `sign_up`, `pricing_viewed`, `begin_checkout`, `demo_started`, `demo_completed`, `first_case_completed`, `purchase`; ทุก event ปฏิเสธ field ที่ไม่อยู่ใน schema แบบปิด
- `sign_up` ส่ง event แบบไม่มี metadata หลัง `/api/auth/register` ตอบสำเร็จเท่านั้น บน route สมัครจะส่งเฉพาะ telemetry ของระบบเองเมื่อผู้ใช้เคยยินยอม analytics; ไม่ส่ง Google event บน sensitive route
- `pricing_viewed` ส่งเมื่อเปิด `/pricing` หลังยินยอม analytics สูงสุดหนึ่งครั้งต่อ session
- `begin_checkout` ส่งหลัง API ตอบ `ok` พร้อม checkout URL เท่านั้น ไม่ใช่การคลิกปุ่ม หากยินยอม marketing และตั้ง `NEXT_PUBLIC_GOOGLE_ADS_BEGIN_CHECKOUT_LABEL` จึงส่ง Ads conversion สำหรับขั้นเริ่ม checkout โดยไม่มีราคา
- Event ที่เกิดในหน้า sensitive ส่ง internal telemetry ได้เฉพาะ payload ที่ผ่าน allowlist และไม่ส่ง page/location ไป Google; เมื่อมี consent จะพักเฉพาะ event ที่ตรวจแล้วใน localStorage แล้วส่งบน public route ถัดไป โดย dedupe ด้วย event token หรือ transaction ID เมื่อบันทึกหรือเปลี่ยน consent จะล้างเฉพาะ pending queue ก่อนบันทึก และเก็บ sent dedupe history ไว้
- `demo_started` นับเมื่อ guest เริ่ม flow บนมือถือหรือเปิดหน้าต่างตัวอย่างสำเร็จ; `demo_completed` นับเมื่อ mock tutorial สร้างผลลัพธ์จำลองสำเร็จ ไม่ใช่แค่เปิดหน้า/ข้าม tutorial
- `first_case_completed` ใช้ `User.totalGenerations` ที่อ่านก่อน increment ภายใน transaction เดียวกับ UsageLog และ marker ที่ unique ต่อผู้ใช้; marker จะถูกสร้างหลัง Generate สำเร็จเท่านั้น เคสเก่า (รวมยอด legacy), recalc, failure และ retry ไม่สร้าง event
- `purchase` ตรวจ session กับ Stripe แบบอ่านอย่างเดียว และต้องตรงกับผู้ใช้ที่ล็อกอิน, PaymentRequest ที่ webhook อนุมัติและให้สิทธิ์แล้ว, สถานะ paid, ยอด THB และ Stripe customer เดียวกัน; ส่ง `transaction_id`, `value`, `currency` และ `items` หนึ่งรายการ `{item_id: "dischargex_purchase", item_name: "DischargeX purchase", price: ยอดที่ยืนยันแล้ว, quantity: 1}`; dedupe ฝั่ง server ด้วย transaction ID
- หน้า return จับและนำ `session_id` ออกจาก address bar ก่อนเริ่ม request ตรวจสอบแบบ async; metadata ใช้ `no-referrer` เพื่อไม่ส่ง URL เดิมไปกับคำขอ
- Checkout success URL มี `CHECKOUT_SESSION_ID` สำหรับ handoff; query `stripe=success` อย่างเดียวไม่ทำให้เกิด purchase

## ค่าที่เจ้าของต้องตั้งเอง

สำหรับ analytics/SEO ไม่มี environment variable ที่จำเป็นต่อการรันแอป; ทุกค่าด้านล่างเป็น optional และเปิดความสามารถตามรายการเท่านั้น ตั้งค่าใน Vercel environment ที่ต้องการ (Production/Preview แยกกัน) โดยไม่ใส่ค่าจริงลงใน source code:

| Variable | ใช้สำหรับ | สถานะใน code |
|---|---|---|
| `NEXT_PUBLIC_GA_MEASUREMENT_ID` | GA4 Measurement ID | Optional; เปิด GA4 events และ public `page_view` เมื่อ analytics consent=true |
| `NEXT_PUBLIC_GOOGLE_ADS_ID` | Google Ads tag ID เช่น `AW-…` | Optional; โหลด/ส่ง Ads event เมื่อ marketing consent=true |
| `NEXT_PUBLIC_GOOGLE_ADS_BEGIN_CHECKOUT_LABEL` | Conversion label ของ action “Begin checkout” | Optional; ใช้ได้เมื่อมี Ads ID และสร้าง action ใน Ads แล้ว |
| `NEXT_PUBLIC_GOOGLE_ADS_PURCHASE_LABEL` | Conversion label ของ action “Purchase” | Optional; ใช้ได้เมื่อมี Ads ID และสร้าง action ใน Ads แล้ว |
| `NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION` | token สำหรับยืนยัน Search Console | Optional; เพิ่ม verification metadata |

ตัวแปร runtime ที่ระบบเดิมต้องมี เช่น `DATABASE_URL`, `NEXTAUTH_URL`, `AUTH_SECRET`, `STRIPE_SECRET_KEY` และ `STRIPE_WEBHOOK_SECRET` ยังคงเป็นข้อกำหนดของแอปตามระบบเดิม ไม่ใช่ค่าที่ analytics เพิ่มเข้ามา; Stripe price IDs ใช้ตาม checkout configuration เดิม

ตรวจ Search Console domain/property, sitemap และ indexing หลังเพิ่ม verification token. ไม่ได้ตรวจหรือเปลี่ยนค่าจริงใน Vercel, Google Analytics, Ads หรือ Search Console ในงานนี้.

## PostgreSQL migration และขั้นตอน release

Migration `20261022220000_add_first_case_analytics` เป็น additive: สร้างตาราง marker ใหม่, unique index สำหรับ event token และ foreign key ไปยัง `User`; ไม่แก้หรือลบข้อมูล/คอลัมน์เดิม. ใช้กับ PostgreSQL ผ่าน Prisma migration history และตรวจ schema ก่อน deploy. ห้ามใช้ `prisma db push` แทน migration ใน production.

1. ก่อนปล่อย เตรียม rollback release artifact/commit และตรวจ Vercel environment ของ target; สำรองฐานข้อมูล PostgreSQL production พร้อมตรวจว่าไฟล์สำรองไม่ว่างและเก็บในที่จำกัดสิทธิ์:

   ```powershell
   pg_dump --format=custom --no-owner --no-acl --file="dischargex-pre-seo-analytics-YYYYMMDD-HHMM.dump" $env:DATABASE_URL
   Get-Item "dischargex-pre-seo-analytics-YYYYMMDD-HHMM.dump" | Select-Object Name,Length
   ```

2. ตรวจ local migration และรัน migration ที่เตรียมไว้กับ production database ก่อน deploy:

   ```powershell
   npx prisma migrate status
   npx prisma migrate deploy
   npx prisma migrate status
   ```

3. Deploy application release หลัง migration สำเร็จ แล้วตรวจ health/build logs, consent opt-in/opt-out, public `page_view` URL (ไม่มี query/hash/referrer), sensitive route ไม่มี Google event, verified purchase และ first Generate เฉพาะบัญชีใหม่ใน environment ที่เหมาะสม.
4. หาก deploy code มีปัญหา ให้ rollback application ไปยัง artifact ก่อนหน้า โดยคง additive table ไว้; ตรวจ health และ telemetry. อย่าลบตารางหรือ restore backup เป็น rollback ปกติ เพราะอาจทำข้อมูลใหม่หาย.
5. หาก migration ล้มเหลว ให้หยุด deploy, ตรวจ `prisma migrate status` และ migration/database logs, แก้สาเหตุด้วย migration forward-fix แล้วรัน `prisma migrate deploy` ใหม่หลังยืนยันสถานะ. Restore backup ทำเฉพาะเหตุข้อมูลเสียหายที่ประเมินผลกระทบและหยุด writes แล้วเท่านั้น.

## นิยาม event

| Event | เงื่อนไข | ข้อมูลที่ส่ง | ไม่นับเป็น |
|---|---|---|---|
| `sign_up` | `/api/auth/register` ตอบสำเร็จ | ชื่อ event เท่านั้น | การเปิดหน้า/กดปุ่มสมัคร |
| `pricing_viewed` | เข้า Pricing และ analytics consent; ครั้งเดียวต่อ session | ชื่อ event เท่านั้น | การเห็นราคาในหน้าอื่น |
| `begin_checkout` | checkout API ตอบ URL จริง | ชื่อ event + plan ID จาก allowlist | การคลิกที่ล้มเหลวหรือการชำระเงินสำเร็จ |
| `demo_started` | guest เริ่ม tutorial จริง (มือถือเริ่ม flow หรือ popup เปิดสำเร็จ) | ชื่อ event + opaque session event ID | เปิดหน้า, กดข้าม, popup ถูกบล็อก |
| `demo_completed` | mock tutorial สร้างผลลัพธ์จำลองสำเร็จ | ชื่อ event + opaque session event ID | เริ่ม tutorialแต่ไม่จบหรือเกิด error |
| `first_case_completed` | transaction commit บันทึก Generate สำเร็จ และ claim marker ต่อผู้ใช้ได้ครั้งแรก | ชื่อ event + opaque event token | recalc, งานล้มเหลว, retry, หรือบัญชีที่มี Generate สำเร็จเดิม |
| `purchase` | authenticated handoff ยืนยัน Stripe session ที่ paid และ webhook-applied entitlement พร้อมยอด THB | ชื่อ event + Stripe Checkout Session ID + ยอด + `THB` | query success เอง, session ของผู้อื่น, webhook ยังไม่ sync, ยอด/สกุลเงินไม่ตรง |

## Convention สำหรับ UTM

ใช้ตัวพิมพ์เล็กและ snake_case; ห้ามใส่ข้อมูลส่วนบุคคลหรือข้อมูลผู้ป่วย:

`utm_source=google&utm_medium=cpc&utm_campaign=th_search_{theme}_{yyyymm}&utm_content={ad_variant}&utm_term={keyword}`

ตัวอย่างเชิงรูปแบบ: `utm_campaign=th_search_discharge_summary_202610` (เป็นเพียง convention ไม่ใช่แคมเปญที่สร้างแล้ว)

## สมมติฐานกลุ่มคำค้นสำหรับเตรียมค้นใน Keyword Planner

รายการต่อไปนี้เป็นสมมติฐานเพื่อเริ่ม research เท่านั้น **ไม่ใช่ผลจาก Google Keyword Planner** และยังไม่มีข้อมูล volume, CPC, competition หรือ forecast:

1. สรุปชาร์จ/Discharge summary: `โปรแกรมสรุปชาร์จ`, `discharge summary`, `สรุปเวชระเบียนผู้ป่วยใน`
2. ตรวจทาน ICD: `ตรวจรหัส ICD-10`, `ICD-10 coding review`, `ทบทวนรหัสโรค`
3. งานเวชระเบียนและ coding: `เครื่องมือช่วย coding เวชระเบียน`, `แนวทาง coding โรงพยาบาล`, `สรุป diagnosis ผู้ป่วยใน`

คำ negative เบื้องต้นสำหรับทบทวนกับ Search Terms จริง: `สมัครงาน`, `งาน`, `เงินเดือน`, `เรียน`, `ข้อสอบ`, `เฉลย`, `โหลด ICD ฟรี`, `crack`, `เถื่อน`, `คนไข้`, `รักษา`, `วินิจฉัยโรคออนไลน์`, `ปรึกษาแพทย์`. ตรวจผลก่อนเพิ่มจริง เพราะคำบางคำอาจมีความหมายที่เกี่ยวข้องกับกลุ่มผู้ใช้.

## แผนเตรียม Google Ads 14 วัน

| วัน | งาน |
|---|---|
| 1–2 | เจ้าของยืนยันหน้า landing, กลุ่มเป้าหมายบุคลากรโรงพยาบาล และ conversion objective; ตั้ง GA4/Ads/Search Console IDs ใน Vercel |
| 3–4 | ตรวจ consent บน desktop/mobile, ตรวจ network payload ให้ไม่มี URL/path/referrer/form content และตรวจ opt-out |
| 5–6 | เพิ่มและส่ง sitemap ใน Search Console; ตรวจ canonical, indexability และข้อผิดพลาดของ detail pages |
| 7–8 | ใช้ Keyword Planner เลือกคำค้น, ตำแหน่ง/ภาษา และวางแผน negative keywords จากข้อมูลจริง |
| 9–10 | เขียนโฆษณาและหน้า landing ให้ตรงคำค้น; ตรวจข้อความเรื่องความช่วยเหลือด้าน coding โดยไม่สื่อว่าเป็นคำวินิจฉัย/การจัดกลุ่มทางการ |
| 11 | ยืนยัน Ads conversion actions “Begin checkout” และ “Purchase” แล้วตั้ง conversion labels; ตรวจ event ใน Google หลัง deploy และตั้งค่าจริง |
| 12 | ตรวจลิงก์, UTM, consent rejection, conversion ซ้ำ และการไม่ยิงเมื่อ checkout API ล้มเหลว |
| 13 | เจ้าของตรวจงบรายวัน, bid strategy, geo/language, policy และหน้า billing ใน Google Ads |
| 14 | เริ่มได้เมื่อเจ้าของอนุมัติงบและ campaign settings; ตรวจ diagnostics ก่อนเปิดใช้จริง |

ไม่มีการสร้างแคมเปญ, ส่งโฆษณา, ตั้งงบ, เติมเงิน หรือเปลี่ยน billing ในงานนี้.
