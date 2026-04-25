# AI Chat Weekly Review Template

Use this template every week before deploying AI chat prompt/routing changes.

---

## 1) Review Meta

- Week: `YYYY-WW`
- Reviewer(s):
- Date:
- Scope: `Fast / Precise / Both`
- Prompt version(s):
- Routing rule version:

---

## 2) Baseline vs Current (7 days)

### Quality

- Helpful rate
  - Baseline:
  - Current:
  - Delta:
- Not-helpful rate
  - Baseline:
  - Current:
  - Delta:
- Top 5 reject reasons
  1.
  2.
  3.
  4.
  5.

### Safety

- High-severity incidents: `count`
- Red-flag miss (golden set): `count / total`
- Contradiction flags (production): `count`
- Cases escalated to human review: `count`

### Cost and Performance

- Token spend THB (specialist chat total):
  - Baseline:
  - Current:
  - Delta:
- Fast vs Precise usage mix:
  - Fast:
  - Precise:
- Latency:
  - p50:
  - p95:

### Business

- Chat-to-purchase rate:
- Chat active users:
- Retention signal (if available):

---

## 3) Findings (Prioritized)

### P0 (Safety-critical)

- Issue:
  - Evidence:
  - Impact:
  - Proposed fix:
  - Owner:
  - ETA:

### P1 (Quality-high impact)

- Issue:
  - Evidence:
  - Impact:
  - Proposed fix:
  - Owner:
  - ETA:

### P2 (Optimization)

- Issue:
  - Evidence:
  - Impact:
  - Proposed fix:
  - Owner:
  - ETA:

---

## 4) Prompt / Routing Change Candidates

For each candidate, include:

- Candidate ID:
- Change summary:
- Why this change:
- Expected effect:
  - quality:
  - safety:
  - cost:
  - latency:
- Risk level: `low / medium / high`
- Requires medical reviewer sign-off: `yes / no`

---

## 5) Golden Set Evaluation

- Golden set version:
- Total cases:
- Candidate tested:
- Safety pass criteria:
- Results:
  - Passed:
  - Failed:
  - High-severity regressions:
- Notes:

Decision:

- `PASS` (eligible for limited rollout)
- `FAIL` (fix and retest)

---

## 6) Rollout Decision

- Decision: `go / no-go`
- Rollout plan:
  - percentage:
  - start time:
  - watch window:
- Rollback trigger(s):
- Rollback owner:

---

## 7) Action Items

1.
2.
3.
4.

---

## 8) Sign-off

- Product owner:
- Clinical reviewer:
- Engineering owner:
- Approved at:
