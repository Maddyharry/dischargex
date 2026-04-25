# AI Chat Prompt Release Checklist

Use this checklist before releasing any prompt/routing/model changes for `AI Chat`.

---

## A. Change Definition

- [ ] Prompt change is documented with version ID.
- [ ] Routing change (`fast` / `precise`) is documented with rule diff.
- [ ] Expected impact is stated (quality/safety/cost/latency).
- [ ] Rollback plan is prepared.

---

## B. Safety Gates (Must Pass)

- [ ] No high-severity regression on golden set.
- [ ] No new unsafe recommendation pattern detected.
- [ ] Uncertainty handling remains explicit when evidence is insufficient.
- [ ] Red-flag section appears consistently for high-risk scenarios.
- [ ] Clinical reviewer approved safety-sensitive changes.

---

## C. Quality Gates

- [ ] Helpful rate trend is stable or improving in test/limited rollout.
- [ ] Not-helpful reasons for "wrong direction" do not worsen.
- [ ] Answer structure remains consistent:
  - [ ] clinical summary
  - [ ] reasoning/differential
  - [ ] red flags
  - [ ] next actions
  - [ ] coding notes when applicable

---

## D. Cost and Latency Gates

- [ ] Token spend per useful answer is within budget.
- [ ] Fast mode latency p50/p95 remains within SLO.
- [ ] Precise mode usage is not unintentionally over-triggered.
- [ ] Estimated margin remains acceptable after change.

---

## E. Telemetry and Observability

- [ ] Prompt/routing version tag is visible in logs or payload.
- [ ] Helpful/not-helpful and reject reasons are flowing.
- [ ] Model used and mode are captured per response.
- [ ] Alerting/monitoring checks pass for last 24h.

---

## F. Review Queue and Human-in-the-Loop

- [ ] Daily review owner assigned.
- [ ] SLA for safety-tagged rejected cases is active.
- [ ] New issues are mapped to actionable fixes (prompt/rule/UI).

---

## G. Deployment Plan

- [ ] Limited rollout configured (10-20 percent).
- [ ] Watch window defined (at least 24h).
- [ ] Rollback criteria defined:
  - [ ] safety regression
  - [ ] reject reason spike
  - [ ] cost spike without quality gain
  - [ ] unacceptable latency increase
- [ ] On-call/owner notified.

---

## H. Post-Deploy Verification

- [ ] Verify telemetry digest after rollout window.
- [ ] Compare baseline vs current (quality/safety/cost/latency).
- [ ] Decide `scale up` or `rollback`.
- [ ] Log final decision in weekly review template.

---

## Sign-off

- Product owner: __________________
- Clinical reviewer: ______________
- Engineering owner: ______________
- Release date/time: ______________
