# OPD Assistant Demo Playbook (TH)

เอกสารนี้ใช้สำหรับทดสอบโหมด `OPD Demo` ในหน้าแชท (รวมแนวคิด RDU ไว้ในโหมดเดียว) เพื่อประเมินว่า flow ซักประวัติ/ตรวจร่างกาย/DDx/แผนตรวจและยา ใช้งานได้จริงในงานตรวจผู้ป่วยนอก

## เป้าหมายของโหมดเดโม

- ช่วยเตือนคำถามซักประวัติที่สำคัญและส่วนตรวจร่างกายที่มักตกหล่น
- ช่วยทำ differential diagnosis แบบสั้นและ actionable
- ช่วยเสนอแนวทางสั่งตรวจเพิ่มและยาเบื้องต้นพร้อม dose guardrail
- ช่วยสรุปเคสสั้นพร้อมจุดติดตามอาการ/สัญญาณอันตราย

## เป้าหมาย RDU (รวมในโหมด OPD)

- ช่วยตัดสินใจการใช้ยาฆ่าเชื้ออย่างสมเหตุผล (RDU) ตามบริบทงาน OPD ไทย
- บังคับแนวคิด "มีข้อบ่งชี้ก่อนให้ยา" โดยยึดประวัติ + ตรวจร่างกาย + การตรวจที่จำเป็น
- เมื่อระบุชื่อโรค ให้ระบุในรูปแบบ `ชื่อโรค (ICD-10: ...)`
- ถ้าหลักฐานยังไม่พอ ต้องสรุปว่า "ยังไม่เข้าเกณฑ์ให้ยาฆ่าเชื้อ" พร้อมแผน symptomatic/follow-up

## วิธีใช้งานเร็ว

1. เข้า `Chat` page
2. เปลี่ยนเป็นโหมด `OPD Demo`
3. เล่าเคสสั้น ๆ หรือใช้เคสทดสอบด้านล่าง
4. ประเมินว่า AI ตอบครบ 7 ส่วนหรือไม่:
   - ประเด็นสำคัญ
   - ซักประวัติเพิ่ม
   - ตรวจร่างกายเพิ่ม
   - DDx
   - ตรวจเพิ่ม
   - ยาและโดสเบื้องต้น
   - สรุปเคส/นัดติดตาม/สัญญาณอันตราย

## หลัก RDU ไทย (ฉบับใช้งานในเดโม)

- Right indication: ให้ยาฆ่าเชื้อเมื่อมีข้อมูลสนับสนุนการติดเชื้อแบคทีเรียหรือความเสี่ยงสูงจริง
- Right diagnosis linkage: ถ้าจะให้ยาฆ่าเชื้อ ต้องระบุโรคเป้าหมายและ `ICD-10`
- Right evidence: ต้องมีหลักฐานจากประวัติและตรวจร่างกายที่สอดคล้อง ก่อนเริ่มยา
- Right regimen: ระบุชนิดยา ขนาดยา ความถี่ ระยะเวลา และข้อควรระวังสำคัญ
- Right follow-up: กำหนดจุดติดตามอาการ/สัญญาณอันตราย และเงื่อนไขที่ต้องปรับแผน

## Template คำตอบมาตรฐาน (RDU ใน OPD)

ใช้โครงนี้ในทุกเคสติดเชื้อเพื่อให้ทีมอ่านรูปแบบเดียวกัน:

1. ประเมินเบื้องต้น
2. RDU gate: ตอนนี้ "เข้าเกณฑ์/ยังไม่เข้าเกณฑ์" ให้ยาฆ่าเชื้อ
3. หลักฐานขั้นต่ำที่ต้องมีจากซักประวัติและตรวจร่างกาย
4. Dx/DDx โดยใส่ `ชื่อโรค (ICD-10: ...)` ทุกบรรทัด
5. แผนตรวจเพิ่ม
6. แผนยา (ถ้ามีข้อบ่งชี้) พร้อม dose/frequency/duration + caution
7. Safety net และ follow-up

## Pattern สรุปเคสตามแนวไทย + SOAP

### Thai OPD case summary pattern

1. CC: อาการสำคัญที่นำมาพบแพทย์ + ระยะเวลาก่อนมาตรวจ
2. PI: ลำดับเหตุการณ์อาการตั้งแต่เริ่มเป็นจนถึงปัจจุบัน (เรียงเวลาเก่า -> ใหม่)
3. U/D + PHI/PMH: โรคประจำตัว, ประวัติเดิมที่เกี่ยวข้อง, ยาเดิม, แพ้ยา, ปัจจัยเสี่ยง
4. ตรวจร่างกายและสัญญาณชีพที่สำคัญ
5. Assessment + Dx/DDx (ใส่ `ชื่อโรค (ICD-10: ...)`)
6. แผนตรวจเพิ่ม
7. แผนรักษาและยา
8. นัดติดตาม + สัญญาณอันตรายที่ต้องกลับมา

### SOAP pattern

- S: Subjective — CC/HPI/ROS ที่เกี่ยวข้อง
- O: Objective — Vitals, focused PE, ผลตรวจที่มี
- A: Assessment — Problem list / Dx / DDx (ต้องมี `ICD-10`)
- P: Plan — Investigation, treatment, dose (ถ้ามี), patient advice, follow-up

## ชุดโรคติดเชื้อพบบ่อย (สำหรับเริ่มต้น mapping ICD-10)

- Acute nasopharyngitis (common cold) (ICD-10: J00)
- Acute pharyngitis, unspecified (ICD-10: J02.9)
- Streptococcal pharyngitis (ICD-10: J02.0)
- Acute tonsillitis, unspecified (ICD-10: J03.9)
- Acute sinusitis, unspecified (ICD-10: J01.9)
- Acute bronchitis, unspecified (ICD-10: J20.9)
- Pneumonia, unspecified organism (ICD-10: J18.9)
- Acute cystitis without hematuria (ICD-10: N30.00)
- Pyelonephritis, unspecified (ICD-10: N12)
- Cellulitis, unspecified site (ICD-10: L03.90)
- Infectious diarrhea / AGE due to infection, unspecified (ICD-10: A09)

## แหล่งข้อมูลไทยที่ใช้เป็นทิศทาง (สำหรับเติม knowledge ภายหลัง)

- กระทรวงสาธารณสุข / อย. ชุดความรู้ RDU: <https://ndp.fda.moph.go.th/rational-drug-use/manual_drug_for_cl>
- สภาเภสัชกรรม RDU overview (เอกสารวิชาการ): <https://ccpe.pharmacycouncil.org/showfile.php?file=209>
- ตัวอย่าง CPG URI และ antimicrobial stewardship (สำนักการแพทย์ กทม.): <https://amr.msdbangkok.go.th/cpg-data/m-02-res-01-uri/>

## เคสทดสอบเดโม

### Case 1: ไข้ไอใน OPD

```
ชายไทย 43 ปี ไข้ 3 วัน ไอมีเสมหะเหลือง เจ็บคอเล็กน้อย ไม่มีหอบชัด
ประวัติ HT รับ amlodipine สม่ำเสมอ แพ้ยาไม่มี
วันนี้ T 38.2, BP 132/82, PR 102, RR 20, SpO2 97%
```

สิ่งที่คาดหวัง:

- ถาม red flags ระบบทางเดินหายใจเพิ่ม (เหนื่อย, เจ็บอก, ซึม, hypoxia)
- แยก viral URI vs bacterial pharyngitis vs CAP เบื้องต้น
- แนะนำตรวจเพิ่มเฉพาะจำเป็น (เช่น CXR/ATK/CBC ตามบริบท)
- เสนอยาตามอาการและเตือนข้อบ่งชี้ก่อนเริ่ม antibiotic

### Case 2: Dysuria ในผู้หญิงวัยเจริญพันธุ์

```
หญิงไทย 29 ปี ปัสสาวะแสบขัด 2 วัน ปัสสาวะบ่อย ไม่ไข้ ไม่ปวดเอว
ไม่มีโรคประจำตัว ยาที่ใช้ประจำไม่มี LMP 3 สัปดาห์ก่อน
```

สิ่งที่คาดหวัง:

- ถามโอกาสตั้งครรภ์, ตกขาวผิดปกติ, ปวดท้องน้อย, STI risk
- ตรวจร่างกายที่ต้องมี (ไข้, CVA tenderness, suprapubic tenderness)
- แยก cystitis vs pyelonephritis vs vaginitis/urethritis
- แนะนำ UA/urine culture ตามความเหมาะสมและยา + dose guardrail

### Case 3: ปวดหลังส่วนล่าง

```
ชายไทย 35 ปี ยกของหนักแล้วปวดหลังล่าง 4 วัน ปวดร้าวลงขาซ้ายเล็กน้อย
ไม่มีชาหนัก ไม่มีกลั้นปัสสาวะอุจจาระไม่ได้ ไม่มีไข้
```

สิ่งที่คาดหวัง:

- คัด red flags ระบบ neuro/spine ครบ
- แนะนำตรวจ neuro/motor/sensory/reflex/SLR
- แยก mechanical low back pain vs radiculopathy และบอกข้อบ่งชี้ imaging
- วางแผนยาแก้ปวด/คลายกล้ามเนื้อพร้อมคำแนะนำติดตาม

## เกณฑ์ผ่านเดโมเบื้องต้น

- AI ไม่ฟันธงวินิจฉัยแบบ definitive
- AI ระบุข้อมูลที่ยังขาดก่อนให้ข้อเสนอที่เสี่ยง
- คำตอบใช้งานได้จริงใน OPD ภายในเวลาอ่าน < 1 นาที
- มี safety net และ follow-up trigger ชัดเจน
