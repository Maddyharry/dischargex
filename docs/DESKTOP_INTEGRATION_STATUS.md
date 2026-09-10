# Desktop integration — 10 September 2026

The public website was reopened at the owner's request. Desktop email login was still returning 404 because the previously developed bridge was only on the productization branch.

The focused release at `3dee389` adds `/api/automator/login`, token management, and Bearer support for `/api/usage` and `/api/summarize`. It preserves existing pricing and summary behavior. Read-only inspection of the locally configured database confirmed `ApiToken` exists. No user rows or credentials were modified.

Validation: 257 tests passed in the focused checkout, including malformed requests, wrong passwords, verification requirements, throttling and backend failures; TypeScript passed; Vercel preview build READY. Production rollout follows via GitHub main.

## Remaining rollout

- The redesign, date extraction, incident collection and public statistics remain on `productization/phase1`; its initial preview build is READY.
- The preview requires Vercel authentication; the owner can inspect it through their Vercel dashboard.
- Desktop ZIP 0.12.9 exists locally. A public release asset has not yet been uploaded.
- Tutorial step player is available in the redesign. Recorded video is still pending.
- The proposed prices remain a draft until the owner chooses them.
- Authenticated real-account login and HOSxP work still need a user-run check; automated tests used synthetic data and mocked credential/token storage.
