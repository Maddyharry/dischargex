# AI Chat Improvement Plan (2 Weeks, Safety-First)

## Goal

Improve `AI Chat` quality in production without unsafe self-learning.

This plan uses the loop:

1. Observe
2. Review
3. Improve
4. Evaluate
5. Deploy

No automatic model retraining from raw user text.

---

## Success Criteria (end of week 2)

- Helpful rate improves by at least 10 percent from current baseline.
- Not-helpful rate due to "clinical risk / wrong direction" drops by at least 20 percent.
- Median response latency in Fast mode does not worsen by more than 15 percent.
- Token cost per useful answer stays within target budget.
- Zero high-severity safety regressions on golden test set.

---

## Scope (what to improve now)

- Prompt and routing quality (`fast` vs `precise`).
- Safer answer structure and guardrails.
- Better use of trusted knowledge references.
- Human review loop for low-confidence and rejected answers.
- Release gating with fixed evaluation cases.

Out of scope for this phase:

- Fine-tuning model weights.
- Fully automatic "self-learning" from all user chats.

---

## Operating Principles

- AI can suggest, but production behavior changes only after review.
- Medical-risk categories require stricter review before rollout.
- Prefer deterministic rules + references for coding and critical constraints.
- Measure both quality and cost before enabling changes for all users.

---

## Week 1 — Instrumentation and Safety Baseline

### Day 1: Baseline snapshot

- Export current 7-day metrics from telemetry dashboard:
  - helpful / not-helpful
  - top reject reasons
  - token cost by source and by mode
  - conversion impact for chat users
- Save a baseline record in internal notes for week-over-week comparison.

### Day 2: Golden set creation (minimum 50 cases)

- Build a fixed test set covering:
  - common internal medicine cases
  - ambiguous cases needing differential diagnosis
  - high-risk red-flag scenarios
  - coding-heavy discharge summary cases
- For each case, define:
  - expected safe direction
  - must-include checklist
  - must-not-do statements
  - expected ICD behavior (when relevant)

### Day 3: Guardrail prompt hardening

- Enforce a stable answer structure in specialist chat:
  1. Clinical summary
  2. Differential / reasoning
  3. Red flags
  4. Next actions
  5. Coding hints (if applicable)
- Add strict "do not over-claim" rules for uncertain evidence.
- Add clear fallback behavior when information is insufficient.

### Day 4: Routing policy tuning

- Keep `Fast` for low-risk/simple Q&A.
- Auto-escalate to `Precise` when signals indicate risk, for example:
  - severe symptoms
  - unstable vitals
  - multiple comorbidities
  - unclear diagnosis with high uncertainty
- Log escalation decisions for audit and cost tracking.

### Day 5: Review queue workflow

- Define clear review criteria for cases to inspect daily:
  - all "not helpful" with safety reasons
  - confidence/consistency anomalies
  - high token-cost but low helpful value
- Assign owner and SLA:
  - triage within 24h
  - approved fixes into next patch batch

---

## Week 2 — Improve, Evaluate, Roll Out

### Day 6: Prompt revision batch A

- Implement top 3 prompt improvements from week-1 review findings.
- Keep changes minimal and traceable per prompt version.

### Day 7: Knowledge and coding reliability pass

- Verify response grounding against trusted knowledge entries.
- Tighten fallback for missing specificity:
  - use safe default wording
  - avoid fabricated coding detail

### Day 8: Offline evaluation gate

- Run all golden cases against current and candidate prompt versions.
- Compare:
  - safety pass rate
  - checklist completeness
  - hallucination rate
  - token cost and latency
- Reject candidate if any high-severity safety regression appears.

### Day 9: Limited rollout (10-20 percent)

- Release candidate to a small traffic slice.
- Monitor 24 hours:
  - helpful / not-helpful trend
  - reject reason mix
  - token cost drift
  - incident signals

### Day 10: Full rollout decision

- Go full rollout only if:
  - no safety regressions
  - quality target met or trending positive
  - cost within budget bounds
- Otherwise rollback and prepare revision batch B.

---

## Metrics to Track Weekly

- Quality
  - helpful rate
  - not-helpful by reason
  - correction frequency after AI suggestion
- Safety
  - red-flag miss rate on golden set
  - contradiction count
  - human-escalation count
- Cost and performance
  - token THB per response
  - fast/precise mix
  - p50 and p95 latency
- Business impact
  - chat-to-purchase rate
  - retained active users after chat usage

---

## Go / No-Go Rules

- No-Go if:
  - any high-severity safety regression on golden set
  - not-helpful safety reasons increase materially
  - cost jumps without quality gain
- Go if:
  - safety stable
  - quality up
  - cost predictable

---

## Practical Next Actions for This Repo

1. Add and maintain a versioned prompt change log.
2. Store a curated golden set in internal test fixtures (not public PHI).
3. Add weekly review note template under `docs/`.
4. Run weekly "telemetry + review queue + golden set" release check before deploying prompt changes.

---

## Recommendation

You should improve AI Chat continuously, but not by uncontrolled self-learning.
Use supervised iteration with telemetry, review queue, and fixed evaluation gates.
That gives better quality while staying safe, stable, and profitable.
