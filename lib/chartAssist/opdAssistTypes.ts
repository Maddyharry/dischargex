/** Client-only OPD Assist lab types (Phase A chat-first UX). */

export type OpdChatMessage = {
  id: string;
  role: "user" | "assistant";
  body: string;
  createdAt: string;
};

/** Section-level provenance for structured chart (v1). */
export type OpdChartSectionKey =
  | "cc"
  | "pi"
  | "pastHistory"
  | "pe"
  | "assessment"
  | "diagnosis"
  | "differential"
  | "plan"
  | "patientAdvice"
  | "layer1";

export type OpdChartProvenance = "ai" | "user";
