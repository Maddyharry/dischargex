import type { DischargeEnginePayload, DiagnosisEngineItem, ProcedureEngineItem, EvidenceRef } from "./types";

export type NormalizedBlock = {
  key: string;
  title: string;
  order: number;
  content: string;
  icd10: string;
};

function splitComma(s: string) {
  return (s || "")
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
}

function mapDx(text: string, icd: string, role: DiagnosisEngineItem["role"]): DiagnosisEngineItem {
  return {
    text,
    icd10: icd || undefined,
    role,
    confidence: "likely_supported",
    evidence: [],
    trust_label: "supported_by_chart",
  };
}

function mapProcLine(line: string): ProcedureEngineItem {
  return {
    text: line,
    category: "unknown",
    confidence: "likely_supported",
    evidence: [],
    trust_label: "supported_by_chart",
  };
}

export function synthesizeEngineFromBlocks(blocks: NormalizedBlock[]): DischargeEnginePayload {
  const m = new Map(blocks.map((b) => [b.key, b]));
  const principal = m.get("principal_dx")?.content?.trim() || "";
  const principalIcd = m.get("principal_dx")?.icd10?.trim() || "";
  const com = splitComma(m.get("comorbidity")?.content || "");
  const comp = splitComma(m.get("complication")?.content || "");
  const other = splitComma(m.get("other_diag")?.content || "");
  const ext = splitComma(m.get("external_cause")?.content || "");
  const icd9Raw = (m.get("icd9")?.content || "").split(/\r?\n/).map((x) => x.trim()).filter(Boolean);

  const principal_diagnosis: DiagnosisEngineItem = {
    text: principal || "",
    icd10: principalIcd || undefined,
    confidence: principal ? "likely_supported" : "suggest_if_documented",
    evidence: [],
    trust_label: principal ? "supported_by_chart" : "missing_documentation",
  };

  return {
    summary_text: "",
    principal_diagnosis,
    comorbidities: com.map((t) => mapDx(t, "", "comorbidity")),
    complications: comp.map((t) => mapDx(t, "", "complication")),
    other_diagnoses: other.map((t) => mapDx(t, "", "other")),
    external_causes: ext.map((t) => mapDx(t, "", "external_cause")),
    procedures_icd9: icd9Raw.map(mapProcLine),
    drg_estimation: {
      status: "estimated",
      disclaimer_th:
        "การประมาณการ DRG/AdjRW จากข้อมูลในระบบนี้ไม่ใช่ผลจาก grouper จริง แพทย์/coder ควรทบทวนก่อนใช้งาน",
      drivers: [],
      possible_complexity_adders: [],
      audit_warnings: [],
    },
    documentation_gaps: [],
    coder_notes: [],
    why_this_principal_diagnosis: "",
    chart_capture_hints: [],
  };
}

/** บังคับให้ principal ใน engine ตรงกับบล็อก principal_dx — บล็อกคือชุดข้อความที่คัดลอกได้ (canonical) */
export function alignPrincipalEngineToPrincipalBlock(
  engine: DischargeEnginePayload,
  blocks: NormalizedBlock[]
): DischargeEnginePayload {
  const pb = blocks.find((b) => b.key === "principal_dx");
  if (!pb) return engine;
  const text = (pb.content || "").trim();
  const icd = (pb.icd10 || "").trim();
  return {
    ...engine,
    principal_diagnosis: {
      ...engine.principal_diagnosis,
      text: text || engine.principal_diagnosis.text,
      icd10: icd || engine.principal_diagnosis.icd10 || undefined,
    },
  };
}

export function mergePartialEngine(
  base: DischargeEnginePayload,
  partial: Partial<DischargeEnginePayload> | null | undefined
): DischargeEnginePayload {
  if (!partial) return base;
  return {
    ...base,
    ...partial,
    principal_diagnosis: partial.principal_diagnosis || base.principal_diagnosis,
    comorbidities: partial.comorbidities?.length ? partial.comorbidities : base.comorbidities,
    complications: partial.complications?.length ? partial.complications : base.complications,
    other_diagnoses: partial.other_diagnoses?.length ? partial.other_diagnoses : base.other_diagnoses,
    external_causes: partial.external_causes?.length ? partial.external_causes : base.external_causes,
    procedures_icd9: partial.procedures_icd9?.length ? partial.procedures_icd9 : base.procedures_icd9,
    drg_estimation: {
      ...base.drg_estimation,
      ...(partial.drg_estimation || {}),
      status: "estimated",
      drivers: partial.drg_estimation?.drivers?.length
        ? partial.drg_estimation.drivers
        : base.drg_estimation.drivers,
      possible_complexity_adders:
        partial.drg_estimation?.possible_complexity_adders?.length
          ? partial.drg_estimation.possible_complexity_adders
          : base.drg_estimation.possible_complexity_adders,
      audit_warnings: [
        ...(base.drg_estimation.audit_warnings || []),
        ...(partial.drg_estimation?.audit_warnings || []),
      ],
    },
    extraction: partial.extraction || base.extraction,
    case_graph: partial.case_graph || base.case_graph,
    concepts: partial.concepts?.length ? partial.concepts : base.concepts,
    linkage: partial.linkage?.length ? partial.linkage : base.linkage,
    classification: partial.classification || base.classification,
    complex_case: partial.complex_case || base.complex_case,
    active_pattern_packs: partial.active_pattern_packs?.length
      ? partial.active_pattern_packs
      : base.active_pattern_packs,
    chart_capture_hints:
      partial.chart_capture_hints !== undefined
        ? partial.chart_capture_hints
        : base.chart_capture_hints,
  };
}

export function attachEvidenceSnippets(
  engine: DischargeEnginePayload,
  sectionSnippets: Record<string, string>
): DischargeEnginePayload {
  const fill = (refs: EvidenceRef[] | undefined) => {
    if (!refs?.length) return refs;
    return refs.map((r) => ({
      ...r,
      snippet: r.snippet || sectionSnippets[String(r.section || r.source)] || r.snippet,
    }));
  };

  return {
    ...engine,
    principal_diagnosis: {
      ...engine.principal_diagnosis,
      evidence: fill(engine.principal_diagnosis.evidence) || engine.principal_diagnosis.evidence,
    },
  };
}
