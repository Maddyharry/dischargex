"""One-off patcher: insert sourceExamples into every DiseaseSummary in clinical-knowledge.ts.

Reads verbatim-style lines from CODING AUDIT 2562 (extracted separately). Skips slugs that
already contain sourceExamples.
"""

from __future__ import annotations

import pathlib
import re

ROOT = pathlib.Path(__file__).resolve().parents[1]
TS_PATH = ROOT / "lib" / "clinical-knowledge.ts"

EXAMPLES: dict[str, list[str]] = {
    "sepsis-septic-shock": [
        "CODING AUDIT 2562 p.4: Sepsis (A40.-, A41.-) — มีอาการของ SIRS + ติดเชื้อที่อวัยวะ/ระบบ + H/C ต้อง Positive (ยกเว้น Immunocompromised ผล Negative แต่ต้องส่ง H/C) + รักษาด้วย ATB 5-7 วันหาย or ตายใน 3-5 วัน",
        "CODING AUDIT 2562 p.4: ไม่วินิจฉัย Sepsis เป็น Pdx เมื่อ — ให้ ATB 1-2 วันไข้ลง + D/C [Fever; R50.9]",
        "CODING AUDIT 2562 p.4: ไม่วินิจฉัย Sepsis เป็น Pdx เมื่อ — ทราบตำแหน่งติดเชื้อชัด [Pdx: ตำแหน่งติดเชื้อ, Sdx: Sepsis (ถ้า H/C positive)]",
        "CODING AUDIT 2562 p.4: Severe sepsis/MOD (R65.1) — เกณฑ์ 2 ใน 5 ระบบ (เช่น SBP < 90 หรือต่ำกว่าเดิม 40 หรือ MAP < 70 + ตอบสนอง IV, urine < 0.5 ml/kg/hr ใน 1 ชม., PaO2/FiO2 < 250, platelet < 80,000 หรือลด > 50% ใน 3 วัน, pH < 7.3 + lactate > 1.5 หรือ HCO3 < 15)",
    ],
    "pneumonia": [
        "CODING AUDIT 2562 p.14: Pneumonia, unspecified — J18.9 (ไข้ > 38.3 + ไอมีเสมหะ + หอบเหนื่อย + acute < 2 wk + CXR new infiltration)",
        "CODING AUDIT 2562 p.14: Bronchopneumonia, unspecified — J18.0 (เมื่อไม่พบเชื้อ)",
        "CODING AUDIT 2562 p.14: Lobar pneumonia — J18.1",
        "CODING AUDIT 2562 p.14: Pneumonia due to food and vomit (สำลักอาหาร) — J69.0",
    ],
    "dengue": [
        "CODING AUDIT 2562 p.5-6: Dengue fever — A90 (ไข้ ปวดศีรษะ ปวดกล้ามเนื้อ + LN โต/petechiae/Tourniquet +ve + lab WBC ลง/atypical lymphocyte/plt ลง + NS1/serology)",
        "CODING AUDIT 2562 p.6: Dengue hemorrhagic fever — A91 (DF + Hct > 45% หรือเพิ่ม > 20% หรือมี pleural effusion)",
        "CODING AUDIT 2562 p.6: DHF + platelet transfusion — DF/DHF + Thrombocytopenia + A90/A91 + D69.6 + หัตถการ 9905",
        "CODING AUDIT 2562 p.6: DHF + shock — A91 + R57.1 หรือ R57.8 หรือ shock unspecified R57.9",
    ],
    "hypovolemic-shock": [
        "CODING AUDIT 2562 p.26 (Shock): Hypovolemic shock — R57.1",
        "CODING AUDIT 2562 p.21 (Diarrhea): ยกเว้น Shock ให้ Hypovolemic Shock เป็น Sdx ได้",
    ],
    "acute-respiratory-failure": [
        "CODING AUDIT 2562 p.15 (Respiratory failure): PaO2 < 55 mmHg or O2 sat < 90% — Acute respiratory failure J96.0",
        "CODING AUDIT 2562 p.15: ให้ J96.0 + Ventilator (เมื่อเข้าเกณฑ์และมีการสนับสนุนในบันทึก)",
    ],
    "gi-bleeding": [
        "CODING AUDIT 2562 p.22: Hematemesis — K92.0",
        "CODING AUDIT 2562 p.22: Melena — K92.1",
        "CODING AUDIT 2562 p.22: Upper + Lower GI hemorrhage, unspecified — K92.2",
    ],
    "acute-bronchitis": [
        "CODING AUDIT 2562 p.11-12: ไอ มีเสมหะ ไม่ระบุเชื้อ — Acute bronchitis, unspecified J20.9",
        "CODING AUDIT 2562 p.12: CXR ปกติ / ไม่ได้ตรวจ — Acute bronchitis due to Haemophilus influenzae J20.1 (เมื่อเข้าเกณฑ์ตาราง)",
    ],
    "asthma-exacerbation": [
        "CODING AUDIT 2562 p.15: Asthma, unspecified — J45.9",
        "CODING AUDIT 2562 p.15: Predominant allergic asthma — J45.0",
        "CODING AUDIT 2562 p.15: Nonallergic asthma — J45.1",
        "CODING AUDIT 2562 p.15: Status asthmaticus — J46",
    ],
    "pleural-effusion": [
        "CODING AUDIT 2562 p.15 (Pleural): ทราบสาเหตุ — Pleural effusion in conditions classified elsewhere + J91",
        "CODING AUDIT 2562 p.15: ไม่ทราบสาเหตุ — Pleural effusion, not elsewhere classified J90",
    ],
    "dehydration": [
        "CODING AUDIT 2562 p.21 (Diarrhea): โดยทั่วไปไม่บันทึก dehydration เป็น Sdx ยกเว้นกรณีพิเศษตามเกณฑ์อื่นในเอกสาร",
        "CODING AUDIT 2562 p.21: ยกเว้น Shock — Hypovolemic shock (R57.1) บันทึกเป็น Sdx ได้เมื่อเข้าเกณฑ์",
    ],
    "hypokalemia": [
        "CODING AUDIT 2562 p.23: Hypokalemia — E87.6 (มีการรักษาโดย KCl หรือ F/U K ใน 24 ชม. + ผลยังผิดปกติ)",
        "CODING AUDIT 2562 p.21: ***ให้ Hypokalemia ใน diarrhea ได้ เมื่อ K < 2.5***",
    ],
    "hyponatremia": [
        "CODING AUDIT 2562 p.23: Hyponatremia — E87.1 (Na < 135 + ให้ 0.9% NaCl/salt tab/จำกัดน้ำ/F-U Na ใน 24 ชม. + ผลยังผิดปกติ + มีวินิจฉัยแพทย์)",
        "CODING AUDIT 2562 p.21: ***ให้ Hyponatremia ใน diarrhea ได้ เมื่อ Na < 125***",
    ],
    "dka-hhs": [
        "CODING AUDIT 2562 p.24: Diabetic ketoacidosis with COMA — E11.0 / E10.0 (BS > 250 + ketone +ve + metabolic acidosis + หอบลึก/ปัสสาวะมาก/N/V)",
        "CODING AUDIT 2562 p.24: Diabetic ketoacidosis without COMA — E11.1 / E10.1",
    ],
    "metabolic-acidosis": [
        "CODING AUDIT 2562 p.23: Acidosis — E87.2",
        "CODING AUDIT 2562 p.24: (Acidosis จาก shock, DKA, diarrhea, sepsis, renal failure ไม่ต้องสรุป) — ใช้รหัสสาเหตุหลักตามบริบท",
    ],
    "cirrhosis-of-liver": [
        "CODING AUDIT 2562 p.19: Alcoholic cirrhosis of liver — K70.3 (พบอย่างน้อย 3 ใน: spider nevus/palmar erythema/jaundice/ascites/HSM/raised bilirubin/prolong PT/low albumin)",
        "CODING AUDIT 2562 p.19: Cirrhosis + Ascites — K74.6",
        "CODING AUDIT 2562 p.19: Portal hypertensive gastropathy + Cirrhosis — K31.89 + K74.6",
    ],
    "hepatic-encephalopathy": [
        "CODING AUDIT 2562 p.19: Uremic encephalopathy — G92 (ในหมวดโรคที่ลงรหัสเพิ่มได้ใน CKD เป็น Sdx — ใช้คู่บริบทไต/uremia)",
        "CODING AUDIT 2562 p.19: Cirrhosis + altered mental status — พิจารณา encephalopathy ตามบริบทตับและหลักฐานในเวชระเบียน",
    ],
    "acute-heart-failure": [
        "CODING AUDIT 2562 p.16: Congestive heart failure — I50.0 (ตรวจพบขาบวม + JVP เพิ่ม)",
        "CODING AUDIT 2562 p.16: Left ventricular failure — I50.1",
        "CODING AUDIT 2562 p.16: Heart failure, unspecified — I50.9 (แพทย์ไม่ระบุรายละเอียด LV/RV)",
        "CODING AUDIT 2562 p.16: แต่ถ้ามี CHF ให้ I50.0 หรือ I50.9 ได้ตามบริบท",
    ],
    "acute-appendicitis": [
        "CODING AUDIT 2562 p.22: Acute appendicitis with generalized peritonitis — K35.2 (+ Op note แตกของไส้ติ่ง + guarding 2 ฝั่ง)",
        "CODING AUDIT 2562 p.22: Acute appendicitis with localized peritonitis — K35.3 (McBurney’s point localized peritonitis)",
    ],
    "peritonitis": [
        "CODING AUDIT 2562 p.22: Acute appendicitis with generalized peritonitis — K35.2 (บริบท rupture + หนองกระจาย)",
        "CODING AUDIT 2562 p.22: Acute appendicitis with localized peritonitis — K35.3",
    ],
    "acute-pancreatitis": [
        "CODING AUDIT 2562 p.3: Sdx ต้องมีวินิจฉัยโดยแพทย์ในเวชระเบียน ไม่ใช่ Discharge summary เท่านั้น",
        "CODING AUDIT 2562 p.2: Major OR ต้องมี Op note ครบองค์ประกอบที่ระบุในเอกสาร (ใช้ประกอบการลงรหัสภาวะ/หัตถการ)",
    ],
    "influenza": [
        "CODING AUDIT 2562 p.12: Influenza, virus not identified — J11.1 (ไข้สูง + URI symptom + myalgia + ไม่ตรวจ/ไม่พบไวรัส)",
        "CODING AUDIT 2562 p.12: Influenza with pneumonia, virus not identified — J11.0",
        "CODING AUDIT 2562 p.13: Influenza due to identified avian influenza virus — J09",
        "CODING AUDIT 2562 p.13: Influenza due to other identified influenza virus — J10 (พบ A/B/C/H1N1)",
    ],
    "covid-19-viral-pneumonia": [
        "CODING AUDIT 2562 ไม่มีหมวด COVID-19 โดยตรง — ใช้หลัก Pdx/Sdx และหลักฐานเชื้อ/ภาพรังสีตามบันทึกแพทย์",
        "CODING AUDIT 2562 p.14: Viral pneumonia / pneumonia unspecified — อ้างอิงเกณฑ์ปอดอักเสบในตารางเดียวกันเมื่อบริบทเข้าได้",
    ],
    "ischemic-stroke": [
        "CODING AUDIT 2562 p.8: มีประวัติ CVA — Sdx: Sequelae of cerebrovascular disease + I69.-",
        "CODING AUDIT 2562 p.8: Neuro deficit — ถ้า CT แรกมี hemorrhage ให้ Intracerebral hemorrhage [I61.-] เพิ่มได้ถ้ามี F/U CT",
    ],
    "hemorrhagic-stroke": [
        "CODING AUDIT 2562 p.8: Intracerebral hemorrhage [I61.-] (บริบทตาม CT และ course)",
    ],
    "old-cva-hemiplegia": [
        "CODING AUDIT 2562 p.8: Sequelae of cerebrovascular disease — I69.- (เมื่อมีประวัติ CVA และอาการคงที่)",
    ],
    "seizure": [
        "CODING AUDIT 2562 p.3: Sign & Symptoms — ไม่สรุป S&S ถ้าเป็นอาการของโรคที่ถูกวินิจฉัยแล้ว (ยกเว้นกรณีในเอกสาร)",
    ],
    "meningitis-encephalitis": [
        "CODING AUDIT 2562 p.3: Sdx ต้องมีวินิจฉัยโดยแพทย์ในเวชระเบียน ไม่ใช่ Discharge summary เท่านั้น",
        "CODING AUDIT 2562 p.2: Non OR procedure — บันทึกสิ่งที่พบ + รายละเอียดหัตถการใน Progress note",
    ],
    "postpartum-hemorrhage": [
        "CODING AUDIT 2562 p.27: Postpartum hemorrhage — O72.- (NL>500 หรือ C/S>1000 ml ตามเกณฑ์ในตาราง)",
        "CODING AUDIT 2562 p.27: Delayed and secondary postpartum hemorrhage — O72.2 (< 6 wk + ซีด/BP ลด + วินิจฉัยแพทย์)",
        "CODING AUDIT 2562 p.27: PPH + Obstetric shock — O72 + O75.1",
    ],
    "newborn-jaundice": [
        "CODING AUDIT 2562 p.26: Term: total bilirubin > 12 mg/dL — Physical Jaundice + P59.9",
        "CODING AUDIT 2562 p.26: Preterm: total bilirubin > 15 mg/dL — Physical Jaundice + P59.9",
        "CODING AUDIT 2562 p.26: Neonatal jaundice from breast milk inhibitor — P59.3 (เหลือง > 5 วัน)",
        "CODING AUDIT 2562 p.26: Neonatal jaundice from other specified causes (Breast feeding) — P59.8 (2-3 วันหลังคลอด + กินนมแม่น้อย)",
    ],
    "neonatal-sepsis": [
        "CODING AUDIT 2562 p.26: Sepsis of newborn — P36.- (Hypo/Hyperthermia + บริบทตามตาราง)",
    ],
    "preterm-low-birth-weight": [
        "CODING AUDIT 2562 p.26: Extremely LBW — P07.0 (<1000 g + GA < 37 wk)",
        "CODING AUDIT 2562 p.26: Other LBW — P07.1 (1000-2499 g + GA < 37 wk)",
        "CODING AUDIT 2562 p.26: Other preterm infant — P07.3 (BW > 2500 g แต่ GA < 37 wk + Ballard score/หลักฐาน)",
    ],
    "uti-acute-pyelonephritis": [
        "CODING AUDIT 2562 p.28: Acute pyelonephritis — N10 (UA ปั่น + ไข้สูง > 38C + ชาย WBC>5 หรือหญิง WBC>10 + CVA tenderness)",
        "CODING AUDIT 2562 p.28: Acute cystitis — N30.0 (UA ไม่ปั่น + bac + อาการระบบทางเดินปัสสาวะ)",
        "CODING AUDIT 2562 p.28: Urinary tract infection, site not specified — N39.0 (+ C/S bac > 10^5 colony)",
    ],
    "malaria": [
        "CODING AUDIT 2562 ไม่พบตาราง Malaria โดยตรง — ใช้หลัก Pdx/Sdx p.3 และหลักฐานเชื้อ/การรักษาในเวชระเบียน",
    ],
    "melioidosis": [
        "CODING AUDIT 2562 ไม่พบตาราง Melioidosis โดยตรง — ใช้หลัก Pdx/Sdx p.3 และหลักฐานเชื้อ/การรักษาในเวชระเบียน",
    ],
    "leptospirosis": [
        "CODING AUDIT 2562 ไม่พบตาราง Leptospirosis โดยตรง — ใช้หลัก Pdx/Sdx p.3 และหลักฐานเชื้อ/การรักษาในเวชระเบียน",
    ],
    "scrub-typhus": [
        "CODING AUDIT 2562 ไม่พบตาราง Scrub typhus โดยตรง — ใช้หลัก Pdx/Sdx p.3 และหลักฐานเชื้อ/การรักษาในเวชระเบียน",
    ],
    "cellulitis-necrotizing-fasciitis": [
        "CODING AUDIT 2562 p.43: Cellulitis, unspecified — L03.9",
        "CODING AUDIT 2562 p.43: Local infection of skin and subcutaneous tissue, unspecified — L08.9",
        "CODING AUDIT 2562 p.27 (ตัวอย่างบริบท): Necrotizing fasciitis + M72.6 (ตามตาราง/Op note ในเอกสาร)",
    ],
    "blood-transfusion-procedure": [
        "CODING AUDIT 2562 p.44: Whole blood — 99.03 (Other transfusion of whole blood)",
        "CODING AUDIT 2562 p.44: PRC — 99.04 (Transfusion of packed cells)",
        "CODING AUDIT 2562 p.44: Platelets — 99.05",
        "CODING AUDIT 2562 p.44: Factor VIII, IX — 99.06; FFP/Cryo — 99.07",
    ],
    "dialysis-procedure": [
        "CODING AUDIT 2562 p.3: Other Dx (ไม่มีผลต่อ DRG) — โรคที่รุนแรงไม่มากพอเป็นก่อน/หลัง Admit ได้ และมีได้มากกว่า 1 โรค",
        "CODING AUDIT 2562 p.2: Non OR procedure — บันทึกสิ่งที่พบ + รายละเอียดหัตถการใน Progress note (ใช้ประกอบหัตถการ dialysis ตามบันทึกจริง)",
    ],
    "debridement-procedure": [
        "CODING AUDIT 2562 p.45-46: Excisional debridement — 86.22 (แพทย์สรุปลักษณะเนื้อตายที่จำเป็นต้องตัดออก)",
        "CODING AUDIT 2562 p.45-46: Nonexcisional debridement — 86.28 (ไม่ระบุลักษณะเนื้อตายที่จำเป็นต้องตัดออก)",
        "CODING AUDIT 2562 p.46: แผลเปิด ทำ Debridement + suture — Excisional debridement 86.22",
    ],
    "lumbar-puncture-procedure": [
        "CODING AUDIT 2562 p.2: Non OR procedure — บันทึกเพียงสิ่งที่พบ + รายละเอียดการทำหัตถการใน Progress note",
        "CODING AUDIT 2562 p.44: หมวดหัตถการ — ใช้รหัสหัตถการตามบันทึกที่ทำจริง (อ้างอิงตารางหัตถการในเล่ม)",
    ],
    "chest-tube-pleural-procedure": [
        "CODING AUDIT 2562 p.2: Non OR procedure — บันทึกสิ่งที่พบ + รายละเอียดการทำหัตถการใน Progress note",
        "CODING AUDIT 2562 p.44: หมวดหัตถการ — ใช้รหัสหัตถการตามบันทึกที่ทำจริง (อ้างอิงตารางหัตถการในเล่ม)",
    ],
    "external-cause": [
        "CODING AUDIT 2562 p.43: External cause ตามสาเหตุ (ระบุกลไก/สถานที่/กิจกรรมตามบันทึก)",
        "CODING AUDIT 2562 p.29: + External cause (Accidental/assault/intent self-harm ฯลฯ) เมื่อบริบท toxic/poisoning",
    ],
}

# Slugs already populated manually in TS — keep as-is (script skips if sourceExamples exists)
ALREADY = {
    "acute-diarrhea",
    "aki-acute-renal-failure",
    "copd-acute-exacerbation",
    "ckd-esrd",
    "hiv-infection-disease",
    "pulmonary-tuberculosis",
}


def main() -> None:
    text = TS_PATH.read_text(encoding="utf-8")
    for slug, lines in EXAMPLES.items():
        if slug in ALREADY:
            continue
        if slug not in text:
            raise SystemExit(f"slug not found: {slug}")
        needle = f'    slug: "{slug}"'
        pos = text.find(needle)
        if pos < 0:
            raise SystemExit(f"slug anchor not found: {slug}")
        # find refs line within this object (next 2500 chars)
        window = text[pos : pos + 6000]
        if "sourceExamples" in window.split("chartChecklist", 1)[0]:
            continue
        m = re.search(r"refs: \[[^\]]*\],\n", window)
        if not m:
            raise SystemExit(f"refs not found for {slug}")
        insert_at = pos + m.end()
        block_lines = ["    sourceExamples: ["]
        for line in lines:
            escaped = line.replace("\\", "\\\\").replace('"', '\\"')
            block_lines.append(f'      "{escaped}",')
        block_lines.append("    ],")
        block = "\n".join(block_lines) + "\n"
        text = text[:insert_at] + block + text[insert_at:]

    TS_PATH.write_text(text, encoding="utf-8")


if __name__ == "__main__":
    main()
