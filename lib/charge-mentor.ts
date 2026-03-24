import type { DischargeEnginePayload } from "@/lib/discharge-engine/types";

export type DxCoachType =
  | "broad_diagnosis"
  | "needs_evidence"
  | "more_specific_option"
  | "guideline_review";
export type DxCoachPriority = "high" | "medium" | "low";

export type DxCoachItem = {
  id: string;
  type: DxCoachType;
  source: "principal" | "chart_hint" | "warning" | "pattern";
  title: string;
  priority: DxCoachPriority;
  currentDiagnosis: string;
  whyThisMatters: string;
  whatToReview: string[];
  evidenceNeeded: string[];
  exampleWording: string;
  caution: string;
};

export type DxCoachSummary = {
  total_items: number;
  high_priority: number;
  medium_priority: number;
  low_priority: number;
  top_points: string[];
};

export type DxCoachData = {
  dx_coach_summary: DxCoachSummary;
  dx_coach_items: DxCoachItem[];
};

export function createDxCoachData(params: {
  engine: DischargeEnginePayload | null;
  warnings: string[];
  orderSheet: string;
  suppressChartHintItems?: boolean;
}): DxCoachData {
  const { engine, warnings: warningItems, orderSheet: orderText, suppressChartHintItems = false } = params;
  if (!engine) {
    return {
      dx_coach_summary: {
        total_items: 0,
        high_priority: 0,
        medium_priority: 0,
        low_priority: 0,
        top_points: [],
      },
      dx_coach_items: [],
    };
  }

  const items: DxCoachItem[] = [];
  const addItem = (item: DxCoachItem) => {
    if (!items.some((x) => x.id === item.id)) items.push(item);
  };
  const principalText = `${engine.principal_diagnosis?.text || ""}`.trim();
  const principalLower = principalText.toLowerCase();
  const allDiagnosis = [
    engine.principal_diagnosis?.text || "",
    ...(engine.comorbidities || []).map((d) => d.text || ""),
    ...(engine.complications || []).map((d) => d.text || ""),
    ...(engine.other_diagnoses || []).map((d) => d.text || ""),
  ];
  const joinedDiagnosisLower = allDiagnosis.join(" | ").toLowerCase();
  const lowerWarnings = warningItems.map((w) => w.toLowerCase());
  const orderLower = orderText.toLowerCase();
  const combinedLower = `${orderLower} ${joinedDiagnosisLower}`;
  const hasAny = (keywords: string[]) => keywords.some((k) => combinedLower.includes(k));

  const hasDizziness = hasAny(["dizziness", "vertigo", "giddiness"]);
  const hasAgePattern = hasAny(["age", "acute gastroenteritis", "gastroenteritis", "diarrhea"]);
  const hasSepsisPattern = hasAny(["sepsis", "septic shock", "severe infection"]);
  const hasPneumoniaPattern = hasAny(["pneumonia"]);
  const hasHypokalemiaPattern = hasAny(["hypokalemia"]);
  const hasMalnutritionPattern = hasAny(["malnutrition", "poor intake", "weight loss", "frailty", "cachexia", "underweight"]);
  const hasDehydrationPattern = hasAny(["dehydration", "hypovolemia", "volume depletion"]);

  const symptomPattern =
    /\b(dizziness|vertigo|giddiness|fatigue|weakness|abdominal pain|pain|fever|dyspnea)\b/i;
  if (symptomPattern.test(principalLower)) {
    addItem({
      id: "dx-broad-principal-symptom",
      type: "broad_diagnosis",
      source: "principal",
      priority: "high",
      title: `${principalText || "Diagnosis นี้"} ยังเป็นอาการ ไม่ใช่ diagnosis ที่จำเพาะพอ`,
      currentDiagnosis: principalText || "Principal diagnosis",
      whyThisMatters: "Diagnosis ระดับอาการอาจยังไม่พอสำหรับ final summary",
      whatToReview: [
        "โรคหรือสาเหตุที่จำเพาะกว่า ตามบริบททางคลินิก",
        "history + physical exam ที่ชี้สาเหตุ",
        "ผล lab/imaging ที่เกี่ยวข้อง",
      ],
      evidenceNeeded: ["ประวัติอาการละเอียด", "PE", "ผลตรวจสนับสนุน"],
      exampleWording: "",
      caution: "อย่าเปลี่ยนเป็น diagnosis จำเพาะ หากยังไม่มีหลักฐานเพียงพอ",
    });
  }

  if (hasDizziness) {
    addItem({
      id: "dx-dizziness-workup",
      type: "broad_diagnosis",
      source: "pattern",
      priority: "high",
      title: "Dizziness/Vertigo ยังเป็นอาการ ควรทบทวนสาเหตุที่จำเพาะกว่า",
      currentDiagnosis: "Dizziness/Vertigo",
      whyThisMatters: "ลดความเสี่ยงการสรุป diagnosis กว้างเกินไป",
      whatToReview: ["vestibular/orthostatic/metabolic/neurologic/cardiovascular context", "อาการร่วมและ neuro exam"],
      evidenceNeeded: ["orthostatic BP", "CBC/glucose/electrolytes", "ECG หรือผลตรวจที่เกี่ยวข้อง"],
      exampleWording: "",
      caution: "อย่า auto-upgrade diagnosis หากยังไม่มีหลักฐานชัดเจน",
    });
  }

  for (const h of engine.chart_capture_hints || []) {
    const target = (h.target_diagnosis_text || "").trim();
    if (!target) continue;
    const foundInCurrent = joinedDiagnosisLower.includes(target.toLowerCase());
    const missingList = h.missing_in_input || [];
    if (h.tier === "suggest_if_documented" || missingList.length > 0) {
      addItem({
        id: `dx-needs-evidence-${target}-${h.target_icd10 || "-"}`,
        type: "needs_evidence",
        source: "chart_hint",
        priority: h.tier === "suggest_if_documented" ? "high" : "medium",
        title: `${target} ลงได้เมื่อมีหลักฐานและ wording รองรับ`,
        currentDiagnosis: target,
        whyThisMatters: "Diagnosis นี้มีผลต่อความถูกต้องของสรุปและการทบทวน coding",
        whatToReview: [
          "physician documentation ที่ระบุ diagnosis ชัดเจน",
          "lab/imaging/trend ที่สอดคล้องกับ diagnosis",
          "การรักษาหรือ monitoring ที่สัมพันธ์กับภาวะนี้",
        ],
        evidenceNeeded: missingList.length ? missingList : ["หลักฐานทางคลินิก", "documentation จากแพทย์"],
        exampleWording: h.suggested_order_sheet_wording_th || "ถ้ามีข้อมูลจริง ควรใช้ถ้อยคำ diagnosis ที่เฉพาะและตรวจสอบได้",
        caution: "ห้ามเพิ่ม diagnosis นี้จากการเดา หากไม่มีหลักฐานรองรับ",
      });
    }
    if (!foundInCurrent && (h.tier === "confirmed_from_chart" || h.tier === "likely_supported")) {
      addItem({
        id: `dx-more-specific-${target}-${h.target_icd10 || "-"}`,
        type: "more_specific_option",
        source: "chart_hint",
        priority: h.tier === "confirmed_from_chart" ? "high" : "medium",
        title: `อาจมี diagnosis ที่จำเพาะกว่า: ${target}`,
        currentDiagnosis: target,
        whyThisMatters: "ช่วยให้ final diagnosis สะท้อนข้อมูลใน chart ได้ชัดขึ้น",
        whatToReview: [
          "ข้อมูล stage/site/type/cause ที่ทำให้ diagnosis specific ขึ้น",
          "ผลตรวจหรือ physician wording ที่ยืนยันความจำเพาะ",
        ],
        evidenceNeeded: ["chart evidence", "documentation จากแพทย์"],
        exampleWording: h.suggested_order_sheet_wording_th || "",
        caution: "อย่า upgrade diagnosis หากยังไม่มี evidence ใน chart",
      });
    }
  }

  if (
    /\b(hypokalemia|acute respiratory failure|sepsis|malnutrition|hypoglycemia|bacterial pneumonia)\b/i.test(
      joinedDiagnosisLower
    )
  ) {
    addItem({
      id: "dx-needs-evidence-high-risk",
      type: "needs_evidence",
      source: "pattern",
      priority: "medium",
      title: "Diagnosis ที่มีนัยสำคัญต้องมี evidence และ wording ที่ชัดเจน",
      currentDiagnosis: "High-impact diagnoses",
      whyThisMatters: "ลดความเสี่ยงจากการ copy diagnosis ที่ยังไม่ครบหลักฐาน",
      whatToReview: [
        "ค่า lab/imaging ที่สอดคล้อง",
        "clinical relevance ในการดูแลจริง",
        "documentation ของแพทย์ที่ระบุความสัมพันธ์ชัดเจน",
      ],
      evidenceNeeded: ["objective evidence", "physician wording", "การรักษาหรือการติดตาม"],
      exampleWording: "ถ้ามีข้อมูลจริง อาจระบุว่า requiring treatment and monitoring",
      caution: "ไม่ควรใส่ diagnosis เพียงเพื่อเพิ่มคะแนนหรือ RW โดยไม่มีหลักฐาน",
    });
  }

  if (hasAgePattern) {
    addItem({
      id: "dx-guideline-age",
      type: "guideline_review",
      source: "pattern",
      priority: "medium",
      title: "เคส AGE/diarrhea ควรทบทวนภาวะร่วมตามแนวทาง",
      currentDiagnosis: "AGE / Gastroenteritis pattern",
      whyThisMatters: "ช่วยลดการพลาดภาวะร่วมที่มีผลต่อการดูแล",
      whatToReview: [
        "dehydration (ระดับความรุนแรงตามอาการและการรักษา)",
        "electrolyte imbalance",
        "ภาวะทุพโภชนาการในผู้ป่วยกลุ่มเสี่ยง",
      ],
      evidenceNeeded: [
        "สัญญาณชีพและปริมาณสารน้ำที่ให้/ตอบสนอง",
        "lab ที่เกี่ยวข้อง (เช่น electrolytes, BUN/Cr ตามบริบท)",
        "nutrition assessment (น้ำหนัก/BMI/weight loss/intake/clinical assessment)",
      ],
      exampleWording: "",
      caution:
        "อย่าใส่ diagnosis เพียงเพราะเข้า pattern หากยังไม่มีการประเมินรองรับ และไม่ควรระบุความรุนแรงเกินจริง",
    });
  }

  if (hasPneumoniaPattern) {
    addItem({
      id: "dx-guideline-pneumonia",
      type: "guideline_review",
      source: "pattern",
      priority: "medium",
      title: "Pneumonia case: ควรทบทวนภาวะร่วมที่เกี่ยวข้อง",
      currentDiagnosis: "Pneumonia",
      whyThisMatters: "ช่วยแยกภาวะร่วมที่มีผลต่อแผนรักษาและสรุปผล",
      whatToReview: ["oxygenation issue", "ภาวะ respiratory failure", "ความจำเพาะของชนิดเชื้อเมื่อมีข้อมูลยืนยัน"],
      evidenceNeeded: ["SpO2/ABG", "imaging", "culture และ physician wording"],
      exampleWording: "ถ้ามีข้อมูลจริง อาจระบุชนิดเชื้อหรือภาวะ respiratory failure ให้ชัดเจน",
      caution: "ไม่ควรระบุชนิดเชื้อหรือความจำเพาะเกินจริง หากไม่มีหลักฐานใน chart",
    });

    addItem({
      id: "dx-pneumonia-specificity",
      type: "more_specific_option",
      source: "pattern",
      priority: "medium",
      title: "Pneumonia ใช้ได้ แต่มีตัวเลือกที่จำเพาะกว่าเมื่อมีข้อมูลเพิ่ม",
      currentDiagnosis: "Pneumonia",
      whyThisMatters: "ช่วยให้ diagnosis สะท้อนข้อมูลเชื้อ/ตำแหน่ง/ความรุนแรงได้ชัดขึ้น",
      whatToReview: ["ผล culture/organism", "รายละเอียด imaging", "physician wording ที่ชัดเจนขึ้น"],
      evidenceNeeded: ["organism evidence", "clinical documentation"],
      exampleWording: "ถ้ามีข้อมูลจริง อาจระบุ bacterial pneumonia due to specified organism",
      caution: "ไม่ควรระบุชนิดเชื้อหากไม่มีหลักฐานใน chart",
    });
  }

  if (hasSepsisPattern) {
    addItem({
      id: "dx-guideline-sepsis",
      type: "guideline_review",
      source: "pattern",
      priority: "medium",
      title: "Sepsis/infection case: ทบทวน organ dysfunction และ severity",
      currentDiagnosis: "Sepsis / severe infection",
      whyThisMatters: "ความชัดเจนของ severity มีผลต่อคุณภาพ documentation",
      whatToReview: ["organ dysfunction", "hemodynamic status", "trend ของ lactate/urine output ตามข้อมูลที่มี"],
      evidenceNeeded: ["vital trends", "lab trends", "physician assessment"],
      exampleWording: "",
      caution: "documentation ควรสะท้อนหลักฐานจริง ไม่ใส่ severity เกินจริง",
    });

    addItem({
      id: "dx-sepsis-evidence",
      type: "needs_evidence",
      source: "pattern",
      priority: "high",
      title: "Sepsis ลงได้เมื่อมี wording และหลักฐาน organ dysfunction รองรับ",
      currentDiagnosis: "Sepsis/Septic shock",
      whyThisMatters: "ป้องกันการ overcall จาก antibiotic อย่างเดียว",
      whatToReview: ["explicit sepsis wording", "source of infection", "organ dysfunction documentation"],
      evidenceNeeded: ["lactate/vasopressor/hemodynamic context ตามที่มีจริง", "physician diagnosis"],
      exampleWording: "ถ้ามีข้อมูลจริง อาจระบุ sepsis with documented organ dysfunction",
      caution: "ห้ามใส่ sepsis เพราะให้ broad-spectrum antibiotic อย่างเดียว",
    });
  }

  if (hasMalnutritionPattern || hasAgePattern || hasSepsisPattern) {
    addItem({
      id: "dx-guideline-malnutrition",
      type: "guideline_review",
      source: "pattern",
      priority: "medium",
      title: "ทบทวนภาวะทุพโภชนาการ: ลง diagnosis ได้เมื่อมีการประเมินรองรับ",
      currentDiagnosis: "Malnutrition review",
      whyThisMatters: "ภาวะทุพโภชนาการมีผลต่อการดูแลผู้ป่วย แต่ต้องอิงการประเมินจริง",
      whatToReview: [
        "น้ำหนัก/BMI และ recent weight loss",
        "ปริมาณ intake และ functional status",
        "clinical assessment โดยทีมรักษา",
      ],
      evidenceNeeded: [
        "nutrition assessment/documentation ใน chart",
        "physician wording ที่ระบุ diagnosis ชัดเจน",
      ],
      exampleWording:
        "ถ้ามีข้อมูลจริง อาจระบุระดับความรุนแรง (เช่น moderate/severe) ได้ตามเกณฑ์ที่หน่วยงานใช้",
      caution:
        "ไม่ควรระบุ moderate/severe เพียงเพื่อเพิ่มคะแนน หากยังไม่มีหลักฐานและการประเมินที่เพียงพอ",
    });
  }

  if (hasDehydrationPattern || hasAgePattern) {
    addItem({
      id: "dx-guideline-dehydration",
      type: "guideline_review",
      source: "pattern",
      priority: "medium",
      title: "ทบทวน dehydration/hypovolemia ให้สอดคล้องกับหลักฐานทางคลินิก",
      currentDiagnosis: "Dehydration / Hypovolemia review",
      whyThisMatters: "ช่วยลดการ overcall/undercall ภาวะขาดน้ำ",
      whatToReview: [
        "อาการและสัญญาณทางคลินิก",
        "vital trend และ urine output",
        "lab trend และการตอบสนองต่อ fluid therapy",
      ],
      evidenceNeeded: ["objective evidence ใน chart", "การรักษา/monitoring ที่สัมพันธ์", "physician documentation"],
      exampleWording: "ถ้ามีข้อมูลจริง ควรระบุสาเหตุและระดับความรุนแรงตามหลักฐานที่มี",
      caution: "ไม่ควรใส่ dehydration diagnosis จากข้อสันนิษฐานโดยไม่มีข้อมูลสนับสนุน",
    });
  }

  if (hasHypokalemiaPattern) {
    addItem({
      id: "dx-hypokalemia-evidence",
      type: "needs_evidence",
      source: "pattern",
      priority: "high",
      title: "Hypokalemia ลงได้เมื่อมีค่า K ต่ำ + clinical relevance + การดูแลที่สอดคล้อง",
      currentDiagnosis: "Hypokalemia",
      whyThisMatters: "ลดการใส่ diagnosis จากผลแลบที่ไม่มีนัยทางคลินิก",
      whatToReview: ["ค่า potassium และแนวโน้ม", "อาการ/ผลกระทบทางคลินิก", "การ replacement และ monitoring"],
      evidenceNeeded: ["lab trend", "treatment/monitoring", "physician documentation"],
      exampleWording: "ถ้ามีข้อมูลจริง อาจระบุ hypokalemia requiring replacement and monitoring",
      caution: "ไม่ควรเพิ่ม diagnosis นี้หากไม่มีค่า K ต่ำหรือไม่มีการดูแลรองรับ",
    });
  }

  if (
    lowerWarnings.some(
      (w) =>
        w.includes("no explicit") ||
        w.includes("insufficient for") ||
        w.includes("without physician documentation")
    )
  ) {
    addItem({
      id: "dx-needs-provider-wording",
      type: "needs_evidence",
      source: "warning",
      priority: "high",
      title: "พบ diagnosis ที่ยังขาด physician documentation ชัดเจน",
      currentDiagnosis: "Diagnosis บางรายการ",
      whyThisMatters: "ลดความเสี่ยงจากการสรุป diagnosis จากผลตรวจเพียงอย่างเดียว",
      whatToReview: ["provider-documented diagnosis", "ความเชื่อมโยงกับข้อมูลตรวจ", "ความสอดคล้องกับแผนรักษา"],
      evidenceNeeded: ["physician wording", "objective evidence"],
      exampleWording: "",
      caution: "ห้ามเพิ่ม diagnosis ใหม่จาก Lab/Imaging อย่างเดียว",
    });
  }

  for (const rawWarning of warningItems) {
    const match = rawWarning.match(
      /F2 exclusion:\s*SDx\s+([A-Z0-9.]+)\s+\(([^)]+)\)\s+may not increase complexity when PDx is\s+([A-Z0-9.]+)/i
    );
    if (!match) continue;
    const sdxCode = (match[1] || "").toUpperCase();
    const sdxLabel = (match[2] || "").trim();
    const pdxCode = (match[3] || "").toUpperCase();
    addItem({
      id: `dx-f2-exclusion-${sdxCode}-${pdxCode}`,
      type: "guideline_review",
      source: "warning",
      priority: "medium",
      title: `F2 exclusion: ${sdxCode} อาจไม่เพิ่ม complexity เมื่อ PDx เป็น ${pdxCode}`,
      currentDiagnosis: `${sdxLabel} (${sdxCode})`,
      whyThisMatters: "ลดการตีความว่า CC ทุกตัวช่วยเพิ่ม complexity เสมอในทุก principal diagnosis",
      whatToReview: [
        "principal diagnosis ว่าตรงสาเหตุหลักการ admit จริงหรือไม่",
        "secondary diagnosis นี้มี active management ใน admission นี้หรือไม่",
        "คู่ PDx/SDx เข้ากฎ exclusion ตามภาคผนวก F2 หรือไม่",
      ],
      evidenceNeeded: [
        "physician documentation ที่ยืนยันบทบาทของ PDx และ SDx",
        "หลักฐานการรักษา/monitoring ของ SDx ใน admission นี้",
      ],
      exampleWording: "หาก SDx มีความสำคัญทางคลินิก ให้บันทึกเหตุผลทางคลินิกและการดูแลอย่างชัดเจน แม้ไม่เพิ่ม complexity",
      caution: "ไม่ควรใส่ diagnosis เพื่อหวังผลคะแนน หากคู่รหัสเข้า exclusion list",
    });
  }

  const priorityRank: Record<DxCoachPriority, number> = { high: 0, medium: 1, low: 2 };
  let normalized = [...items];

  if (hasDizziness) {
    normalized = normalized.filter((item) => item.id !== "dx-broad-principal-symptom");
  }
  if (normalized.some((item) => item.type === "needs_evidence" && item.id !== "dx-needs-evidence-high-risk")) {
    normalized = normalized.filter((item) => item.id !== "dx-needs-evidence-high-risk");
  }
  if (suppressChartHintItems) {
    normalized = normalized.filter((item) => item.source !== "chart_hint");
  }

  const bySemanticKey = new Map<string, DxCoachItem>();
  for (const item of normalized) {
    const semanticKey = `${item.type}:${item.currentDiagnosis.trim().toLowerCase()}:${item.title
      .toLowerCase()
      .replace(/\s+/g, " ")
      .trim()}`;
    const prev = bySemanticKey.get(semanticKey);
    if (!prev) {
      bySemanticKey.set(semanticKey, item);
      continue;
    }
    if ((priorityRank[item.priority] ?? 9) < (priorityRank[prev.priority] ?? 9)) {
      bySemanticKey.set(semanticKey, item);
    }
  }

  const sorted = [...bySemanticKey.values()].sort((a, b) => {
    const byPriority = priorityRank[a.priority] - priorityRank[b.priority];
    if (byPriority !== 0) return byPriority;
    return a.title.localeCompare(b.title);
  });

  const summary: DxCoachSummary = {
    total_items: sorted.length,
    high_priority: sorted.filter((x) => x.priority === "high").length,
    medium_priority: sorted.filter((x) => x.priority === "medium").length,
    low_priority: sorted.filter((x) => x.priority === "low").length,
    top_points: sorted.slice(0, 3).map((x) => x.title),
  };

  return {
    dx_coach_summary: summary,
    dx_coach_items: sorted,
  };
}
