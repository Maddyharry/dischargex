# Investigations schema v1 (OPD Assist hybrid)

## 1) TypeScript — `investigations[]` v1

Defined in `lib/chartAssist/clinicalInvestigationV1.ts`:

- `ClinicalInvestigationKindV1`: `lab | imaging | ecg | ultrasound | ct | xray | bedside`
- `ClinicalInvestigationV1`: required `investigationId`, `kind`, `label`; optional `status`, `priority`, `problemRefId`, narrative/result fields, imaging `bodyPart`, `keyFindings`, ECG `rate` / `rhythm` / `sttSummary`
- `OpdAiClinicalNoteJson.investigations?: ClinicalInvestigationV1[]` in `opdAssistAiTypes.ts`
- `OpdAssistInvestigationsStatsV1`: logging/stats (`returned`, `count`, `completeCount`, `withProblemRefCount`, `byKind`)

## 2) Minimum fields by modality

| Modality | Required (v1) | Strongly recommended when applicable |
|----------|-----------------|--------------------------------------|
| **Lab** | `investigationId`, `kind: "lab"`, `label` | `summary` or `keyFindings` when results exist; `status` |
| **Imaging** (incl. `xray`, `ct`, `ultrasound`, or generic `imaging`) | `investigationId`, `kind`, `label` | `bodyPart`; for results: `impression` or `summary` or `keyFindings` |
| **ECG** | `investigationId`, `kind: "ecg"`, `label` | `rate`, `rhythm`, `sttSummary` (or `summary`) |

Post-check does not hard-fail if “recommended” fields are missing; stats track `completeCount` via presence of detail fields.

## 3) Pipeline touchpoints

| Layer | Location |
|-------|----------|
| **AI types** | `OpdAiClinicalNoteJson.investigations` in `opdAssistAiTypes.ts` |
| **Prompt — system** | `buildOpdClinicalSystemPrompt` and mode-specific prompts (`buildErClinicalSystemPrompt`, …) — optional `investigations[]` |
| **Prompt — user** | `buildClinicalUserPayload` — `INVESTIGATIONS_SCHEMA_V1` block |
| **Coerce** | `coerceToClinicalNoteJson` — passes through `investigations` when present (including `[]`) |
| **Post-check** | `postCheckOpdAiClinicalNote` — `normalizeClinicalInvestigationsV1` |
| **Formatter** | `formatInvestigationsSectionLines` in `opdNoteLayout.ts`; inserted after PE (or equivalent) in OPD, ER, Trauma, Psych, LABOR_ROOM/GYNE layouts |
| **API response** | `mergeOpdAssistAiPhase1` → `OpdAssistHybridResult`: `investigations`, `investigationsStats` |
| **UI** | `OpdAssistLabClient` — structured panel + `promptStats` line extended with inv counts; order sync badge |

## 4) Backward compatibility

- Older models omit `investigations` → post-check yields no key on output JSON; layout unchanged aside from optional section.
- Empty array from model → normalized to `[]` → key omitted (same as omit).
- Rule-only / no-AI path: no `investigations` on result; `formattedClinicalNote` from `formatOpdClinicalNoteFromRule` unchanged.
- Export/copy: investigations appear inside `formattedClinicalNote` when AI path populated structured rows.

## 5) Logging

- Server: `console.info("[opd-assist] investigationsStats", JSON.stringify(...))` after successful post-check.
- Response: `investigationsStats` on hybrid result; lab UI shows compact line next to prompt stats.

## 6) Fallback when AI omits or invalidates schema

- Missing or non-array `investigations` → treat as **no structured investigations** (empty after normalize); optional post-check warnings for malformed input.
- Invalid rows dropped; unknown `kind` coerced to `lab` with warning.
- No automatic extraction from free text in this v1 (future: rule-assisted suggestions).

## 7) Minimum test cases (see `tests/clinicalInvestigationsV1.test.ts`)

- CXR (`xray` + chest + impression)
- ECG (`ecg` + rate/rhythm/sttSummary)
- CT brain (`ct` + bodyPart)
- U/S abdomen (`ultrasound` + keyFindings)
- Lab summary (`lab` + summary)

## 8) UI — problem order dirty state

When local `problemBlocks` order (by `id`) differs from last `appliedProblemOrder` from the server, a badge **「ลำดับประเด็น unsync」** is shown until the user re-analyzes with **「ใช้ลำดับนี้แล้ววิเคราะห์ใหม่」** or runs a fresh analyze that resets state from the response.
