# Maintenance and date rules — 2026-09-09

Owner requested temporary closure before release. Production `main` has a dedicated maintenance middleware; the development branch also retains a production-only gate. Do not reopen by overwriting this gate incidentally during a merge.

## Closure verification

- Home, login, app, checkout and summarization must return HTTP 503 with `Cache-Control: no-store` and `Retry-After`.
- Stripe's signed webhook remains reachable to reconcile earlier payments; GET should return 405, not the maintenance page. Never test with fabricated payment events on production.
- Existing browser tabs or offline service-worker caches may still display old UI. The server APIs are blocked; existing in-flight requests cannot be cancelled by middleware deployment.
- Historical deployment URLs are separate deployments; production closure does not disable historical previews. Review Vercel deployment protection before external testing.

## Reopening

1. Finish review and preview tests, including billing/auth regression and date edge cases.
2. Preserve the complete auth middleware from the development branch, not the temporary standalone production gate.
3. Remove `PRODUCTION_MAINTENANCE` only in the approved reopening release.
4. Deploy via GitHub; verify home/login and authorized synthetic workflows, then verify monitoring.
5. Do not activate proposed prices without the owner's selection.

## Date extraction

- Explicit admission/discharge labels take precedence.
- Missing labeled dates can fall back to earliest/latest chart-entry dates, sorted chronologically. This assumes a complete single-admission chart, as specified by the owner.
- Only leading chart timestamps qualify for fallback; dates embedded in prose are not blindly collected.
- F/U, FU, follow up, follow-up and นัด dates are excluded, including date-first appointments and standalone next-line values.
- Conflicting labels or one unlabeled chart day remain unresolved instead of silently inventing both dates.
- A warning accompanies boundary-derived dates: confirm the chart covers the complete admission before clinical use.
- If one date remains missing, preserve the known date and use the existing manual-entry/leave-that-field-empty workflow. Date-only recovery does not charge a new generation.

Current verification: 287 automated tests pass across 40 files; TypeScript check also passes after the maintenance wrapper addition. Production deployment `4c8601a5d661a0c9e19264af9f074b42314e6e2a` is READY. Direct HTTP checks confirm 503 for home, login, app, checkout and summarize. Stripe webhook GET remains 405. Real HOSxP end-to-end testing is still required. Date and UI changes remain in the local development branch, not production.
