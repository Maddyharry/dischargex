import type {
  ClinicalScoreComputed,
  ClinicalScoreDefinition,
  ClinicalScoreEvaluation,
  ClinicalScoreFieldDef,
} from "./types";

function clampInt(n: number, min: number, max: number): number {
  const x = Math.round(Number(n));
  if (Number.isNaN(x)) return min;
  return Math.min(max, Math.max(min, x));
}

function parseFieldValue(
  def: ClinicalScoreFieldDef,
  raw: unknown
): number | boolean | string | undefined {
  if (raw === undefined || raw === null || raw === "") return undefined;
  if (def.kind === "boolean") {
    if (raw === "" || raw === undefined || raw === null) return undefined;
    if (typeof raw === "boolean") return raw;
    if (raw === "true" || raw === true) return true;
    if (raw === "false" || raw === false) return false;
    return undefined;
  }
  if (def.kind === "number") {
    if (raw === "" || raw === undefined || raw === null) return undefined;
    const n = typeof raw === "number" ? raw : Number(raw);
    if (Number.isNaN(n)) return undefined;
    const min = def.min ?? 0;
    const max = def.max ?? 999;
    return clampInt(n, min, max);
  }
  if (def.kind === "select") {
    const s = String(raw);
    const ok = def.options?.some((o) => o.value === s);
    return ok ? s : undefined;
  }
  return undefined;
}

export function parseInputsForScore(
  def: ClinicalScoreDefinition,
  raw: Record<string, unknown>
): Record<string, number | boolean | string> {
  const out: Record<string, number | boolean | string> = {};
  const all = [...def.requiredFields, ...def.optionalFields];
  for (const f of all) {
    const v = parseFieldValue(f, raw[f.id]);
    if (v !== undefined) out[f.id] = v;
  }
  return out;
}

export function getMissingRequiredFieldIds(
  def: ClinicalScoreDefinition,
  raw: Record<string, unknown>
): string[] {
  const missing: string[] = [];
  for (const f of def.requiredFields) {
    const v = parseFieldValue(f, raw[f.id]);
    if (v === undefined) missing.push(f.id);
  }
  return missing;
}

export function fieldLabel(def: ClinicalScoreDefinition, fieldId: string): string {
  const f = [...def.requiredFields, ...def.optionalFields].find((x) => x.id === fieldId);
  return f?.label ?? fieldId;
}

/**
 * `activePackIds` = active symptom pack ids from `problemPackResolution.activeMatches`.
 * `markedNa` = user marked this score as not applicable for this encounter.
 */
export function evaluateClinicalScore(
  def: ClinicalScoreDefinition,
  raw: Record<string, unknown>,
  opts: { activePackIds: Set<string>; markedNa: boolean }
): ClinicalScoreEvaluation {
  const triggered = def.triggerProblems.some((p) => opts.activePackIds.has(p));
  if (!triggered) {
    return { state: "not_applicable", missingFieldIds: [] };
  }
  if (opts.markedNa) {
    return { state: "not_applicable", missingFieldIds: [] };
  }
  const missing = getMissingRequiredFieldIds(def, raw);
  if (missing.length) {
    return { state: "incomplete", missingFieldIds: missing };
  }
  const parsed = parseInputsForScore(def, raw);
  const computed = def.compute(parsed);
  const interpretation = def.interpret(computed);
  return {
    state: "ready",
    missingFieldIds: [],
    computed,
    interpretation,
  };
}

export function isScoreTriggeredByPacks(
  def: ClinicalScoreDefinition,
  activePackIds: Set<string>
): boolean {
  return def.triggerProblems.some((p) => activePackIds.has(p));
}

/** Assign each score to the first active pack in roadmap order (dedupe). */
export function assignScoresToActivePacks(
  defs: readonly ClinicalScoreDefinition[],
  activeMatchesSorted: readonly { packId: string }[]
): { packId: string; scoreIds: string[] }[] {
  const taken = new Set<string>();
  return activeMatchesSorted.map((m) => {
    const scoreIds: string[] = [];
    for (const def of defs) {
      if (taken.has(def.id)) continue;
      if ((def.triggerProblems as readonly string[]).includes(m.packId)) {
        taken.add(def.id);
        scoreIds.push(def.id);
      }
    }
    return { packId: m.packId, scoreIds };
  });
}
