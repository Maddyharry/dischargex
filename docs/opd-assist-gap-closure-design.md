# OPD Assist — Gap closure design (implementation-ready)

**Status:** Architecture decisions for incremental rollout. Does not replace the hybrid pipeline (rules → AI → post-check).

---

## 1. Executive summary

Five gaps are closed with **one recommended path each**, favoring:

- **Incremental changes** to `OpdAiClinicalNoteJson`, `analyzeCase`, `opdAssistAi`, `opdAssistAiPostCheck`, and the lab client.
- **Backward compatibility:** new fields optional; old clients/API payloads unchanged.
- **Clinical safety:** post-check remains authoritative for empty-note rejection, medication guards, and contradiction surfacing.
- **Physician speed:** correction loop v1 reuses full analyze with an optional order hint (no new micro-service); slim prompt v1 is feature-flagged logging before aggressive truncation.

---

## 2. Recommended decisions table

| Gap | Recommended approach |
|-----|---------------------|
| **A Investigations** | Versioned **flat** `investigations[]` on clinical JSON; status enum; `kind: lab \| imaging \| ecg \| other`; link via optional `problemRefId`; AI primary author, rules optional enricher; free text retained in `plan` until migration complete. |
| **B Primary problem** | **Single source:** `orderedClinicalProblemIds: string[]` (stable `ProblemBlock.id`). Primary = `ids[0]`. Post-check **reorders** `problems[]` and sets `role` from index. Optional `primaryProblemId` redundant with `ids[0]` — use **only** ordered array to avoid drift. |
| **C Confidence** | **Minimal v1:** per-problem `confidenceLevel` + `uncertaintyReasons[]` + `evidenceBullets[]` (human-readable, no span offsets). |
| **D Prompt slim** | **Phase 1:** log size + overlay counts (no behavior change). **Phase 2:** `PROMPT_COMPACT=1` env drops inactive overlay bodies to one-line; never drop RAW_TEXT or contradiction/red-flag lines. |
| **E Correction loop** | **V1:** extend `POST /api/opd-assist/analyze` with optional `orderedProblemIds?: string[]` — server reorders `opdFramework.layer2` before building AI payload. UI: after drag, **“Apply order & re-analyze”** (full pipeline). **V2:** optional `regenerateScope` + partial AI call (later). |

---

## 3. Detailed design per gap

### A) Investigations schema

**Current state**

- Labs/ECG/imaging appear in **free text** (`plan`, `erImmediateManagement`, `traumaImagingProcedure`, per-problem plan).
- `OpdAiClinicalNoteJson` has no investigation array (`lib/chartAssist/opdAssistAiTypes.ts`).

**Target design**

- Add **`investigationsSchemaVersion: 1`** (literal) and **`investigations?: InvestigationItemV1[]`** at top level of `OpdAiClinicalNoteJson`.
- **Flat array** (simpler queries, easier JSON schema validation later). Nested grouping by problem is via `problemRefId`, not nested trees.
- **Status:** `ordered | pending | done | cancelled | unknown` — covers “สั่งแล้ว / รอผล / ทำแล้ว”.
- **Raw vs structured:** each item may include `verbatimLine?: string` (paste from EMR) and `summaryLine?: string` (AI/rule one-liner). Display prefers `summaryLine` ?? `verbatimLine`.
- **ECG vs imaging:** `kind: 'ecg'` is separate; `kind: 'imaging'` with `modality?: 'xr' | 'ct' | 'us' | 'mri' | 'other'`.
- **Urgent:** `priority?: 'routine' | 'urgent' | 'stat'`.
- **Link to problems:** `problemRefId?: string` — matches `ProblemBlock.id` when known; optional `problemTitleMatch?: string` fallback when ID not stable in AI output.

**Source of truth**

- **AI is primary** for populating `investigations[]` from clinical narrative (aligned with AI-first policy).
- **Rules optional pass (v2):** lightweight extractor from `plan`/`erImmediateManagement` could append rows with `source: 'rule_extract'` — must not duplicate if AI already listed same test (fuzzy match TBD).

**Pipeline placement**

- **Parse:** not required for v1 if AI fills structured fields; post-check **validates** shape and clamps lengths.
- **Formatter:** `opdNoteLayout.ts` — new section “การสั่งตรวจ / ผลที่เกี่ยวข้อง” when `investigations?.length`.
- **UI:** `OpdAssistLabClient` — table or compact list under Layer 2 / export preview.

**Tradeoffs**

- Flat array vs nested by problem: flat is faster to ship; linking via `problemRefId` is enough for v1.
- Full ontology (LOINC/SNOMED) deferred — use free `label` string v1.

**Backward compatibility**

- Omit `investigations` → render as today (text-only). Post-check passes.

**Fallback**

- If AI omits array, investigations remain in legacy text; optional future rule to suggest empty array vs extract.

**Testing**

- Unit: normalize investigation lines; post-check clamp; formatter smoke.
- Fixture: JSON with 3 investigations across 2 problems.

**Open risks**

- Duplicate listing (text + structured) until UI merges display logic.

---

### B) Primary problem source of truth

**Current state**

- Rules: `ProblemBlock.id` + `applyProblemOrder` — **first in ordered list = primary** (`opdRecordFramework.ts`).
- AI: `problems[].role` (`opdAssistAiPostCheck.ts` `normalizeProblem`).
- No merge when UI order and AI disagree.

**Target design**

- **Canonical order:** `orderedClinicalProblemIds: string[]` — every id is a `ClinicalProblemId` from rule-generated `ProblemBlock`s.
- **Primary** = `orderedClinicalProblemIds[0]` (explicit, debuggable).
- **Do not** rely on AI `role` alone for canonical primary; post-check **overwrites** `role`: after sorting `problems[]` by best match to `orderedClinicalProblemIds`, index `0` → `primary`, else `secondary`. Problems with no id match append at end as secondary.
- **Matching AI rows to blocks:** extend `OpdAiProblemJson` with optional **`clinicalProblemId?: string`** (must match `ProblemBlock.id` when present). AI prompted to copy ids from `RULE_PROBLEM_BLOCKS` section in user payload (new block listing `id | system | summary`).

**UI reorder**

- On drag, update local `problemBlocks` order (already).
- **“Apply order & re-analyze”** sends `orderedProblemIds: string[]` matching current drag order to API.
- Server: before `mergeOpdAssistAiPhase1`, **`applyProblemOrder(layer2, orderedProblemIds)`** so payload and CC/PI emphasis align with user intent.

**Post-check reconciliation**

- If `orderedClinicalProblemIds` provided in response metadata — actually ids come from **request**, not AI. Store **echo** in response: `appliedProblemOrder: string[]` for client confirmation.
- Mismatch warning if AI emits problems that don’t map to any id (warning string).

**Tradeoffs**

- Requires listing problem ids in AI user message (slim table) — small prompt cost, large clarity win.

**Backward compatibility**

- No `orderedProblemIds` in request → current rule order only (unchanged).

**Fallback**

- If client sends invalid id, ignore invalid entries and warn; fall back to rule order.

**Testing**

- Unit: `reconcileProblemRoles(ids, problems)`.
- Integration: analyze with `orderedProblemIds` reverses primary in output.

**Open risks**

- AI invents new problem titles without ids — keep as secondary with warning.

---

### C) Confidence / uncertainty / evidence

**Current state**

- Provisional phrasing in prompts; no structured fields.

**Target design**

- On **`OpdAiProblemJson`** add optional:

```ts
confidenceLevel?: 'low' | 'medium' | 'high';
uncertaintyReasons?: string[]; // max 5 in post-check
evidenceSupport?: { category: 'history' | 'exam' | 'investigation' | 'course'; note: string }[];
```

- **No span offsets in v1** (complexity vs value). Revisit if product needs audit trail to raw text.
- **Prompt:** one short paragraph in `buildOpdClinicalSystemPrompt` requiring `confidenceLevel` when `problems[]` non-empty; evidence from **documented** facts only.
- **Post-check:** clamp array lengths; strip empty; do not fail note if missing (optional fields).
- **UI:** badge or one line under each problem in lab.

**Tradeoffs**

- Per-problem only (not per-diagnosis line) for v1.

**Backward compatibility**

- Omitted → no UI block.

**Fallback**

- Default `confidenceLevel: 'medium'` only if product wants — **recommended default: omit**, don’t fabricate.

**Testing**

- Post-check preserves optional fields; prompt snapshot test optional.

**Open risks**

- AI over-claims “high” — add rule: if `evidenceSupport` empty and level high → warning in post-check (optional v2).

---

### D) Prompt slimming / evaluation

**Current state**

- Large `buildClinicalUserPayload` string (`opdAssistAi.ts`).

**Target design — Phase 1 (safe)**

- Add **`logOpdAssistPromptStats`** in server route or `mergeOpdAssistAiPhase1`:
  - `payloadCharCount`, `approxTokenEstimate = chars/4`, `activeOverlayCount`, `mode`.
- Log to stdout or existing lab log table if schema allows (extend `insertOpdAssistLabLog` columns optional).

**Phase 2 (behavior)**

- Env **`OPD_ASSIST_PROMPT_COMPACT=true`**: replace inactive overlay blocks with `(inactive)` one-liner; cap `RULE_BASELINE_DRAFT` to N chars; **never** truncate `RAW_CLINICAL_TEXT` or contradiction block.

**Evaluation harness (offline)**

- New script or vitest: `tests/opdAssistPromptGolden.test.ts` — fixed `rawText` + fixed rule snapshot → assert payload contains critical substrings and length &lt; threshold when compact on.

**Two-stage prompting**

- **Deferred** (extra latency, more failure modes). Revisit only if compact mode insufficient.

**Metrics**

- Payload size, model latency (if returned from API), post-check fail rate (already inferable from logs).

**Tradeoffs**

- Logging only first = zero clinical risk.

---

### E) Correction loop after reorder

**Current state**

- Reorder local state; full re-analyze only when user triggers analyze with same raw text — **order not sent** to server.

**Target design — V1 (recommended)**

- **Extend analyze request body** with optional `orderedProblemIds?: string[]`.
- In `analyze` route, pass through to `analyzeOpdCase` **or** apply reorder immediately after `buildOpdFramework` inside `analyzeOpdCase` when provided (cleaner: new optional param `clientProblemOrder?: string[]`).

Implementation sketch:

- `analyzeOpdCase(rawText, modeOverride, { orderedProblemIds })`  
- After `buildOpdFramework`, if `orderedProblemIds?.length`, `layer2 = applyProblemOrder(opdFramework.layer2, orderedProblemIds)` (filter to valid ids).

- **UI:** after drag, show secondary button **“Apply order & re-analyze”** calling analyze with `rawText`, `modeOverride`, `orderedProblemIds` from current `problemBlocks.map(b => b.id)`.

**V2 (later)**

- `POST /api/opd-assist/regenerate` with `scope: 'problems_only' | 'full'`, `cachedRuleAnalysisId` — requires server-side cache of rule results; **out of scope for v1**.

**Conflict resolution**

- User edits Layer 1/2 text manually then re-analyzes: **rawText** is still source for AI; if product later syncs edited note back to `rawText`, document separately. V1: re-analyze uses original paste field only.

**Tradeoffs**

- Full pipeline on reorder = higher cost than partial regen — acceptable for v1 frequency (low).

**Testing**

- API test: same text, different order → first problem in AI output aligns with `orderedProblemIds[0]` after post-check reconcile.

---

## 4. Proposed TypeScript types (consolidated)

Place in `lib/chartAssist/opdAssistAiTypes.ts` (or `opdAssistInvestigations.ts` + re-export).

```ts
/** Investigations schema v1 — flat, versioned at note root */
export type InvestigationKindV1 = "lab" | "imaging" | "ecg" | "other";

export type InvestigationStatusV1 =
  | "ordered"
  | "pending"
  | "done"
  | "cancelled"
  | "unknown";

export type InvestigationPriorityV1 = "routine" | "urgent" | "stat";

export type InvestigationItemV1 = {
  id: string; // uuid or client-generated stable id for this row
  kind: InvestigationKindV1;
  /** Display label e.g. "CBC", "CXR", "ECG" */
  label: string;
  status: InvestigationStatusV1;
  priority?: InvestigationPriorityV1;
  modality?: "xr" | "ct" | "us" | "mri" | "other"; // when kind === 'imaging'
  /** Link to ProblemBlock.id */
  problemRefId?: string;
  /** Short structured one-liner for chart */
  summaryLine?: string;
  /** Verbatim from EMR / dictation */
  verbatimLine?: string;
  /** If urgent finding / critical result — physician-facing flag */
  criticalConcern?: boolean;
};

/** Add to OpdAiClinicalNoteJson */
export type OpdAiClinicalNoteJsonV1Extensions = {
  investigationsSchemaVersion?: 1;
  investigations?: InvestigationItemV1[];
};

/** Add to OpdAiProblemJson */
export type OpdAiProblemJsonV1Extensions = {
  clinicalProblemId?: string;
  confidenceLevel?: "low" | "medium" | "high";
  uncertaintyReasons?: string[];
  evidenceSupport?: {
    category: "history" | "exam" | "investigation" | "course";
    note: string;
  }[];
};
```

**Analyze request extension** (`app/api/opd-assist/analyze/route.ts` body schema):

```ts
orderedProblemIds?: string[]; // optional, max ~12 ids
promptCompact?: boolean; // optional future
```

**Analyze response extension** (optional echo):

```ts
appliedProblemOrder?: string[];
```

---

## 5. Proposed file-level change list

| File | Action |
|------|--------|
| `lib/chartAssist/opdAssistAiTypes.ts` | Add types; extend `OpdAiClinicalNoteJson` / `OpdAiProblemJson` |
| `lib/chartAssist/opdAssistAi.ts` | Payload: problem id table for AI; prompt lines for investigations + confidence; `mergeOpdAssistAiPhase1` logging; optional compact builder |
| `lib/chartAssist/opdAssistAiPostCheck.ts` | Validate new fields; **reconcileProblemOrderAndRoles**; clamp investigations |
| `lib/chartAssist/opdNoteLayout.ts` | Render investigations section |
| `lib/chartAssist/analyzeCase.ts` | Optional `clientProblemOrder` → reorder layer2 |
| `app/api/opd-assist/analyze/route.ts` | Parse `orderedProblemIds`; pass to analyze; optional logging |
| `components/chartAssist/OpdAssistLabClient.tsx` | Button + pass order; optional confidence/investigation display |
| `docs/opd-assist-gap-closure-design.md` | This document |
| `tests/opdAssistAiPostCheck.test.ts` | Extend for role reconciliation |
| `tests/opdAssistInvestigations.test.ts` | **New** — formatter + types |
| `tests/opdAssistAnalyzeOrder.test.ts` | **New** — order echo behavior |

---

## 6. API changes

- **`POST /api/opd-assist/analyze`**
  - Request: optional **`orderedProblemIds?: string[]`**
  - Response: optional **`appliedProblemOrder?: string[]`**, optional **`promptStats?: { charCount: number; approxTokens: number }`**
- **No breaking change** — existing clients omit new fields.

---

## 7. UI changes

- After problem drag: **“Apply order & re-analyze”** (Thai label acceptable) — calls analyze with current order.
- Optional: show **investigations** table when present in response (if AI returns structured note to client — may need to expose `phase1` parsed JSON or formatted note already includes section — prefer **formattedClinicalNote** update in layout).

---

## 8. Testing plan

| Area | Tests |
|------|--------|
| Order reconciliation | Unit: given ids + messy AI problems → ordered roles + primary |
| Investigations | Unit: post-check rejects absurd length; preserves valid rows |
| API | Integration: analyze + `orderedProblemIds` changes layer2 order in exported framework |
| Prompt | Golden: compact flag reduces size by X% on fixture |
| Regression | Existing vitest suites still pass |

---

## 9. Rollout order

1. **Logging only** (prompt stats) — zero behavior change.
2. **`orderedProblemIds` + server reorder + post-check role reconciliation** — highest user value, low schema risk.
3. **Investigations array + formatter** — UI can trail API by one sprint.
4. **Confidence fields** — optional UI, prompt requirement soft-launched.
5. **Prompt compact env** — after baseline metrics collected.

---

## 10. Risks / unresolved questions

| Risk | Mitigation |
|------|------------|
| AI ignores `clinicalProblemId` | Stronger prompt + post-check sort by title fuzzy match (v2) |
| Duplicate investigations text vs array | Single renderer prefers structured when present |
| Payload still large | Compact mode + monitor |
| Partial regen deferred | Document V2; avoid half-baked cache |
| LOINC coding | Out of scope v1 |

**Unresolved:** whether lab log DB schema can store `promptStats` — may use JSON column or stdout-only initially.

---

*End of design document.*
