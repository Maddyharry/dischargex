/**
 * Short assistant bubbles for chat UI — deterministic from AnalyzeOk + helpers.
 * Does NOT include full formattedClinicalNote.
 */
import type { StructuredOpdNote } from "./structuredNote";
import type { ProblemBlock } from "./opdRecordFramework";
import type { MissingDataStrip } from "./opdAssistMissingStrip";

type AnalysisLite = {
  assistantBundle?: {
    provisionalAssessment?: string;
    nextStepSuggestions?: string[];
  };
  investigations?: unknown[];
  investigationsStats?: { count?: number; completeCount?: number };
};

export type AssistantReplyUiState = {
  problemOrderOutOfSync: boolean;
  /** Optional score summary from clinical score layer */
  scoreLine?: string | null;
};

function firstLine(s: string, maxLen: number): string {
  const t = s.trim().split(/\n/)[0] ?? "";
  if (t.length <= maxLen) return t;
  return `${t.slice(0, maxLen - 1)}…`;
}

/**
 * Three conceptual parts (2–4 short lines):
 * 1) top impression
 * 2) missing / next questions
 * 3) status
 */
export function buildAssistantDisplayReply(
  analysis: AnalysisLite | null | undefined,
  note: StructuredOpdNote | null | undefined,
  problemBlocks: ProblemBlock[],
  missingStrip: MissingDataStrip,
  ui: AssistantReplyUiState
): string {
  const lines: string[] = [];

  let impression = "";
  if (note?.assessment?.trim()) {
    impression = firstLine(note.assessment, 140);
  } else if (problemBlocks[0]?.summaryLine?.trim()) {
    impression = firstLine(problemBlocks[0].summaryLine, 140);
  } else if (analysis?.assistantBundle?.provisionalAssessment?.trim()) {
    impression = firstLine(analysis.assistantBundle.provisionalAssessment, 140);
  } else if (note?.cc?.trim()) {
    impression = firstLine(note.cc, 120);
  } else {
    impression = "สรุปเบื้องต้น: เติมประวัติ/ประเด็นเพิ่มเพื่อให้การประเมินชัดขึ้น";
  }
  lines.push(impression);

  const ask =
    missingStrip.askNext.slice(0, 2).length > 0
      ? missingStrip.askNext.slice(0, 2)
      : (analysis?.assistantBundle?.nextStepSuggestions ?? []).slice(0, 2);
  if (ask.length) {
    lines.push(`ถามต่อ: ${ask.join(" · ")}`);
  } else if (missingStrip.missing.slice(0, 2).length) {
    lines.push(`ยังขาด: ${missingStrip.missing.slice(0, 2).join(" · ")}`);
  }

  const statusBits: string[] = ["อัปเดต draft ในชาร์ตแล้ว"];
  if (analysis?.investigations?.length) {
    const st = analysis.investigationsStats;
    statusBits.push(
      st ? `Investigations ${st.completeCount ?? 0}/${st.count ?? analysis.investigations.length}` : "Investigations อัปเดต"
    );
  }
  if (ui.problemOrderOutOfSync) {
    statusBits.push("ลำดับประเด็นเปลี่ยนในเครื่อง — ยังไม่ sync กับรอบวิเคราะห์");
  }
  if (ui.scoreLine?.trim()) {
    statusBits.push(ui.scoreLine.trim());
  }
  lines.push(statusBits.join(" · "));

  return lines.filter(Boolean).join("\n");
}
