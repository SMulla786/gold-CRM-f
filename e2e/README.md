# Web E2E (Playwright)

Self-contained end-to-end tests for the web app, kept separate from `frontend/package.json` (tester-owned area). Runs the **real** stack: backend on :4000 (dev DB with the demo seed) + frontend on :5173 with `VITE_USE_MOCK=false`.

## Setup (once)
```
cd frontend/e2e
npm install
npm run install:browsers   # downloads Chromium for Playwright
```

## Run
```
npm test            # starts backend + frontend if not already up, then runs the specs
npm run test:headed # watch it in a browser
npm run report      # open the last HTML report
```
`playwright.config.ts` reuses already-running servers locally, so if a teammate already has `npm run dev` up for backend/frontend it attaches to those.

## Coverage
- `tests/auth.spec.ts` — login → correct area per level (SUPER_ADMIN→/platform, ADMIN→/admin, BRANCH_USER→/app), wrong-password error, auth guard redirect, cross-level guard bounce.

Demo seed credentials: `superadmin` / `demo.owner` / `demo.pune` / `demo.cashier`, password `ChangeMe@123`.
