import type { ReferenceTopic } from "./referenceCatalog";
import { referenceCatalog } from "./referenceCatalog";
import type { GuidelineHintV1 } from "./types";

const HINTS: Partial<
  Record<ReferenceTopic, { id: string; text: string; sourceIds: string[] }>
> = {
  uri: {
    id: "hint-uri-viral-lean",
    text: "URI ส่วนใหญ่เป็นไวรัส — ยาปฏิชีวนะไม่ใช่เริ่มต้น; ประเมิน work of breathing + hydration.",
    sourceIds: ["thai-peds-respiratory-infections-2019", "thai-rdu-hospital-manual"],
  },
  "bloody-diarrhea": {
    id: "hint-bloody-stool-eval",
    text: "ถ่ายเป็นเลือด — แยก invasive bacterial vs anal fissure; เก็บประวัติระบบ/ปริมาณ/อาการเตือน.",
    sourceIds: ["thai-peds-acute-diarrhea", "idsa-infectious-diarrhea-2017"],
  },
  "head-injury": {
    id: "hint-head-injury-watch",
    text: "Head injury — บันทึก mechanism, LOC, อาเจียน, GCS/behavior; disposition ตาม red flags ท้องถิ่น.",
    sourceIds: ["thai-head-injury-traumatic-patients", "nice-head-injury-ct-1h"],
  },
  trauma: {
    id: "hint-trauma-survey",
    text: "Trauma — primary survey A–E ก่อน narrative ยาว; mechanism + time.",
    sourceIds: ["thai-trauma-abcde"],
  },
  respiratory: {
    id: "hint-resp-triage",
    text: "ระบบหายใจ — RR, SpO₂, work of breathing ก่อนสรุป diagnosis ใสๆ.",
    sourceIds: ["thai-peds-respiratory-infections-2019"],
  },
  diarrhea: {
    id: "hint-ors-dehydration",
    text: "ท้องเสีย — ประเมิน dehydration; ORS first-line ตามชี้.",
    sourceIds: ["thai-peds-acute-diarrhea"],
  },
};

export function guidelineHintsForTopics(topics: ReferenceTopic[]): GuidelineHintV1[] {
  const seen = new Set<string>();
  const out: GuidelineHintV1[] = [];
  for (const topic of topics) {
    const h = HINTS[topic];
    if (!h || seen.has(h.id)) continue;
    seen.add(h.id);
    const validIds = h.sourceIds.filter((id) => referenceCatalog.some((r) => r.id === id));
    out.push({
      id: h.id,
      text: h.text,
      sourceIds: validIds.length ? validIds : h.sourceIds,
      topic,
    });
  }
  return out;
}
