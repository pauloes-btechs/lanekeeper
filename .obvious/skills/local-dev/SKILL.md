---
name: local-dev
---

# Local Dev — Lanekeeper

Recorded from onboarding, 2026-10-30. Snapshot: `czeepa1tvupy60dixdjy:default`.

## What local dev means here

There is no app server. A healthy local environment is:

1. Node 20 + npm available (`node --version`).
2. Python 3.13 available.
3. `prototype/node_modules` installed (`cd prototype && npm install`).
4. Playwright Chromium installed and launchable:
   ```sh
   cd prototype && npx playwright install chromium
   sudo npx playwright install-deps chromium   # sandbox was missing libnss3 etc.
   ```
5. `web/node_modules` installed (`cd web && npm ci`); `npm run dev` serves the website at http://localhost:5173/lanekeeper/.

## Verified flows (evidence from 2026-10-30)

- **Cost model CLI** — `python3 analysis/cost_model.py` prints three scenarios; base case robot $18.28/mi vs staffed $44.34/mi.
- **Web presentation** — headless Chromium against a static server: `/web/index.html` → title "Lanekeeper", 3 canvases rendering, zero console errors; `/web/run-report.html` → zero console errors. Screenshots captured during onboarding.
- **Syntax checks** — `python3 -m py_compile analysis/cost_model.py prototype/drawings.py` and `node --check prototype/shoot.mjs` both pass.

## Gotchas

- **No Docker / no supabase CLI / no deno in the sandbox.** The Supabase backend cannot run locally; do not try. Edge functions were not type-checked locally.
- **Never `supabase db push` casually** — it targets the live hosted project. `20261010200000_hazard_includes_rider_reports.sql` is deliberately not yet applied.
- **`npm run render` overwrites tracked JPGs** in `docs/prototype/` — expect a dirty tree afterwards; restore if you didn't mean to re-render.
- **The presentation page fetches three.js from jsdelivr** — headless verification needs network access. The website bundles three.js; its 3D stages get a `ready` class (or `no-webgl`) when loaded, so wait on `#hero-stage.ready` rather than a fixed delay.
- **`window.__done` is only set by `prototype/*.html` pages**, not by `web/` pages — `shoot.mjs` works only inside `prototype/`.
- **City data can't be fetched from the sandbox.** Change `web/scripts/cities.json` on a branch and let the `City lane data` workflow fetch and commit it; its probe step logs each source's real fields and values.
- `npm install` in `prototype/` creates an untracked `package-lock.json` (no lockfile is committed). Leave it out of PRs unless asked.

## Quick verification recipe

```sh
python3 analysis/cost_model.py | head -3
cd prototype && npm install && npx playwright install chromium
cd ../web && npm ci && npm run lint && npm test && npm run build && npm run preview &
# then headless-check http://127.0.0.1:4173/lanekeeper/ (and /presentation/, /run-report/) for console errors at 380 px and 1440 px
```
