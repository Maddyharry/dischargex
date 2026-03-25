import type { AssistMode } from "./cardTypes";
import type { SafetySweep } from "./cardTypes";
import { hasAny } from "./cardTypes";

/** Keyword-light ABCD/ABCDE sweep for documentation vs prompts. */
export function buildSafetySweep(
  normalizedText: string,
  mode: AssistMode
): SafetySweep {
  const t = normalizedText;
  const trauma = mode === "TRAUMA";
  const framework = trauma ? ("ABCDE" as const) : ("ABCD" as const);

  const docAir = hasAny(t, ["airway", "ทางเดินหายใจ", "patent", "speak", "พูดได้"]);
  const docBreath = hasAny(t, ["rr", "resp", "spo2", "o2", "หอบ", "wheeze", "crackles"]);
  const docCirc = hasAny(t, ["bp", "ความดัน", "hr", "pulse", "crt", "perfusion", "bleed", "เลือด"]);
  const docDis = hasAny(t, ["gcs", "avpu", "pupil", "รูม่านตา", "ชัก", "seizure", "ซึม"]);
  const docExp = hasAny(t, [
    "exposure",
    "temperature",
    "อุณหภูมิ",
    "แผล",
    "abdomen",
    "ท้อง",
    "mechanism",
  ]);

  const items = [
    {
      label: "A",
      documented: docAir ? ["Airway / patency noted"] : [],
      missing: docAir ? [] : ["Airway patency / speech / obstruction / aspiration risk"],
      checkNext: [
        "Airway patent?",
        "Speaking/crying?",
        "Obstruction / blood / vomit?",
        trauma ? "C-spine risk if trauma" : "Consider aspiration risk",
      ],
      redFlags: hasAny(t, ["obstruction", "stridor", "unable to speak"]) ? ["Airway compromise"] : [],
    },
    {
      label: "B",
      documented: docBreath ? ["Breathing / SpO2 / RR"] : [],
      missing: docBreath ? [] : ["RR", "SpO2", "work of breathing", "breath sounds"],
      checkNext: ["RR", "SpO2", "work of breathing", "breath sounds equal / focal signs"],
      redFlags: hasAny(t, ["hypox", "spo2 8", "spo2 9", "o2 sat 8"]) ? ["Hypoxia concern"] : [],
    },
    {
      label: "C",
      documented: docCirc ? ["Circulation / perfusion"] : [],
      missing: docCirc ? [] : ["HR", "BP", "CRT / perfusion", "bleeding / dehydration"],
      checkNext: ["HR", "BP", "cap refill", "perfusion", "active bleeding", "shock signs"],
      redFlags: hasAny(t, ["shock", "hypotension", "bp ต่ำ"]) ? ["Shock / perfusion concern"] : [],
    },
    {
      label: "D",
      documented: docDis ? ["Disability / neuro"] : [],
      missing: docDis ? [] : ["GCS/AVPU", "pupils", "focal deficit", "seizure", "pain score"],
      checkNext: ["GCS/AVPU", "pupils", "focal neuro", "seizure", "altered behavior"],
      redFlags: hasAny(t, ["gcs", "ซึม", "ชัก"]) ? ["Altered neuro status"] : [],
    },
  ];

  if (trauma) {
    items.push({
      label: "E",
      documented: docExp ? ["Exposure / focused exam"] : [],
      missing: docExp ? [] : ["Head/scalp", "abdomen", "skin", "temp", "mechanism-related exam"],
      checkNext: [
        "Head wound / scalp",
        "Abdomen tenderness / distension",
        "rash / petechiae",
        "temperature",
        "mechanism-related exam",
      ],
      redFlags: [],
    });
  }

  return { framework, items };
}
