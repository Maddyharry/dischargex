# AGENTS.md

## Cursor Cloud specific instructions

### Product overview
DischargeX is a Thai hospital discharge summary AI assistant (Next.js 16 App Router, React 19, Prisma 7, PostgreSQL, Tailwind CSS 4). Single service — no monorepo, no Docker, no microservices.

### Running services
- **Dev server**: `npm run dev` (port 3000)
- **Database**: PostgreSQL 16 on localhost:5432 (database `dischargex`, user `dischargex`, password `dischargex`)

### Environment variables
A `.env` file must exist in the repo root. Required variables:
| Variable | Dev value |
|---|---|
| `DATABASE_URL` | `postgresql://dischargex:dischargex@localhost:5432/dischargex?sslmode=disable` |
| `AUTH_SECRET` | any non-empty string |
| `NEXTAUTH_URL` | `http://localhost:3000` |
| `OPENAI_API_KEY` | placeholder OK for non-AI flows; real key needed for summarize/AI features |

The `?sslmode=disable` suffix is **required** for local PostgreSQL — the Prisma client in `lib/prisma.ts` auto-promotes `sslmode` to `verify-full` otherwise, which breaks local connections.

### Key commands
| Task | Command |
|---|---|
| Install deps | `npm install` (runs `prisma generate` via postinstall) |
| Apply migrations | `npx prisma migrate deploy` |
| Lint | `npm run lint` |
| Tests | `npm run test` (vitest, 3 pure-logic test files in `tests/`) |
| Dev server | `npm run dev` |

### Gotchas
- The `postinstall` script runs `prisma generate`, which requires `DATABASE_URL` to be set. Create `.env` **before** running `npm install`.
- Lint has 1 pre-existing error (`react-hooks/set-state-in-effect` in `WorkspaceTutorialOverlay.tsx`) and ~9 warnings. These are not regressions.
- Unit tests (`vitest run`) are pure logic tests (billing rules, charge mentor, F2 parser) — they don't need the database or external services.
- To start PostgreSQL: `sudo pg_ctlcluster 16 main start`
- Registration without `RESEND_API_KEY` returns the email verification URL in the response body — useful for dev/testing.
