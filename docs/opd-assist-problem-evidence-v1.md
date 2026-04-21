# Per-problem evidence / uncertainty v1 (OPD Assist hybrid)

## Target TypeScript types

Defined in `lib/chartAssist/problemEvidenceV1.ts` and wired on `OpdAiProblemJson` in `opdAssistAiTypes.ts`:

| Field | Type |
|-------|------|
| `confidenceLevel?` | `high \| medium \| low \| unknown` |
| `uncertaintyReasons?` | `string[]` (max 12, ~400 chars each) |
| `evidenceSupport?` | `EvidenceSupportItemV1[]` (max 24) |

`EvidenceSupportItemV1`:

- `type`: `history | exam | investigation`
- `text`: short human-readable line
- `relation`: `supports | against | missing`
- `refId?`: optional; links to `investigations[].investigationId` or `clinicalProblemId` (no span offsets)

## Files modified

| File | Change |
|------|--------|
| `lib/chartAssist/problemEvidenceV1.ts` | **New** — types + normalize + `summarizeProblemEvidenceForLog` |
| `lib/chartAssist/opdAssistAiTypes.ts` | Extend `OpdAiProblemJson`; re-export evidence types |
| `lib/chartAssist/opdAssistAiPostCheck.ts` | `normalizeProblem` — parse + clamp new fields |
| `lib/chartAssist/opdAssistAi.ts` | System + user prompts; `OpdAssistHybridResult.aiProblems`; `finalizeHybrid`; `console.info` problemEvidenceStats |
| `lib/chartAssist/opdNoteLayout.ts` | `formatProblemEvidenceOverlayLines` inside `formatProblemSection` (after Assessment) |
| `components/chartAssist/OpdAssistLabClient.tsx` | `AnalyzeOk.aiProblems`; per–problem-block UI |
| `tests/problemEvidenceV1.test.ts` | **New** |
| `docs/opd-assist-problem-evidence-v1.md` | **New** (this file) |

## Prompt changes

- **System (OPD + all modes that list problems[])**: optional bullet describing `confidenceLevel`, `uncertaintyReasons`, `evidenceSupport` and `refId` semantics.
- **User payload**: `PROBLEM_EVIDENCE_V1` block after `INVESTIGATIONS_SCHEMA_V1`, linking evidence lines to investigations / problem ids.

## Post-check behavior

- Invalid `confidenceLevel` → omitted + warning.
- `uncertaintyReasons` / `evidenceSupport` non-array → omitted + warning.
- `evidenceSupport` rows without `text` → skipped + warning.
- Unknown `type` → coerced to `history` + warning.
- Unknown `relation` → coerced to `supports` + warning.
- Strings truncated; arrays capped.

## Formatter / UI

- **Export note**: After each problem’s **Assessment**, optional blocks **Confidence**, **Uncertainty**, **Evidence** (formatted lines).
- **Lab UI**: Violet panel “Confidence / evidence (AI)” per `ProblemBlock`, matched by `clinicalProblemId === block.id` or index fallback when lengths match.

## Backward compatibility

- All fields optional; legacy model output unchanged.
- Post-check omits keys when empty after normalization.

## Fallback behavior

- Model omits fields → no `confidenceLevel` / empty arrays treated as absent.
- Invalid values dropped (not synthesized from narrative).

## Tests

- `tests/problemEvidenceV1.test.ts` — normalize + format + summarize.

## Rollout order

1. Types + normalization (`problemEvidenceV1.ts`, `opdAssistAiTypes`, post-check).
2. Formatter (`opdNoteLayout`).
3. Prompts + merge (`aiProblems` + logging).
4. UI (`OpdAssistLabClient`).
5. Tests + doc.

## Rollout note

Enable gradually via model behavior (prompts already describe schema); no separate feature flag for v1 fields.
