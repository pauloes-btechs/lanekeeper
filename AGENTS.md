# AGENTS.md — Lanekeeper operating contract

Contract for any agent working in this repository. Read it before changing anything; it defines what "done" means here.

## Purpose

Lanekeeper is a concept-stage robot sweeper for NYC protected bike lanes (see `README.md` for the full pitch). The built parts are software and data: a Supabase backend (schema migrations, seed data, three edge functions) and the Lanekeeper website under `web/` (a Vite build, with the original presentation and run report served as static pages). The hardware is design documentation and rendered prototype images only. Tests exist for the website (`web/test/`, Vitest) and the `request-demo` function (Deno); there is no other test suite, so do not invent one. Done criteria below are the checks this repo actually uses.

## Layout

| Path | What it is |
| --- | --- |
| `web/` | Website (Vite, its own `package.json`): `index.html` + `src/` (3D viewer, map, estimator, demo form), `scripts/` (GLB export, city data fetch/probe), `test/` |
| `web/public/presentation/`, `web/public/run-report/` | Original self-contained presentation and run report, copied as-is into the build at `/presentation/` and `/run-report/` |
| `web/public/models/lk-01.glb` | Generated from `web/src/robot/model.js` by `npm run model`; regenerate, don't hand-edit |
| `web/public/data/` | Generated city lane data (`cities.json` + one GeoJSON per city) from `npm run data`; sources and filters live in `web/scripts/cities.json` |
| `supabase/migrations/` | Schema, applied in order via `supabase db push` |
| `supabase/seed.sql` | Demo data for a fresh project |
| `supabase/functions/verify-glass/` | Gemini Robotics-ER glass check edge function (guarded by `ROBOT_API_KEY`) |
| `supabase/functions/sms-glass/` | Twilio webhook edge function (`X-Twilio-Signature` auth, no JWT) |
| `supabase/functions/request-demo/` | Website demo-request intake (no JWT; origin allowlist, validation, honeypot, hashed-IP/email rate limits) writing to `demo_requests` |
| `analysis/cost_model.py` | Standalone Python cost model |
| `prototype/` | Node project that renders `docs/prototype/*.jpg` (its own `package.json` — there is no root manifest) |
| `.github/workflows/` | `ci.yml` (Python smoke), `site.yml` (site lint/test/build + `request-demo` Deno tests), `pages.yml` (deploy `web/dist` to GitHub Pages on `main`), `city-data.yml` (monthly lane-data refresh) |

## Conventions

- Migrations are plain SQL files named `YYYYMMDDHHMMSS_<description>.sql`; never edit an applied migration, add a new one.
- Never touch live Supabase config in committed files (`config.toml`, deploy commands in the README are the source of truth). Secrets belong in `.env` (gitignored; see `.env.example` references in the README), never in code or docs.
- `sms-glass` is intentionally deployed `--no-verify-jwt` because Twilio cannot send a JWT; it verifies `X-Twilio-Signature` instead. Do not "fix" this.
- `verify-glass` requires the `ROBOT_API_KEY` header check to stay in place — requests must fail with 401 before anything reaches Gemini.
- `request-demo` is deployed `--no-verify-jwt` on purpose (anonymous form). `demo_requests` has no anon or authenticated access; keep it that way so the function's rate limit can't be bypassed.
- City lane-miles are computed from fetched geometry. Never type a lane-mile figure by hand; change the source or filter in `web/scripts/cities.json` and re-run the data workflow.
- The estimator in `web/src/estimator.js` must stay in step with `analysis/cost_model.py`; `web/test/estimator.test.js` pins it to the Python output.
- Prototype images under `docs/prototype/` are generated; regenerate them from `prototype/` rather than hand-editing binaries.

## Verify commands

Run these against the manifests that actually exist here (no root `package.json`, no `requirements.txt`):

```sh
python3 analysis/cost_model.py                                   # cost model runs and prints scenarios
cd web && npm ci && npm run lint && npm test && npm run build    # website lints, tests pass, builds
deno test supabase/functions/request-demo/index_test.ts          # demo function tests (CI runs this)
cd prototype && npm install && npm run drawings && npm run render  # prototype still renders
supabase db push                                                 # migrations apply cleanly (use a scratch project)
supabase functions deploy verify-glass                           # edge function deploys
supabase functions deploy sms-glass --no-verify-jwt              # edge function deploys
supabase functions deploy request-demo --no-verify-jwt           # edge function deploys
```

For doc-only changes, a read-through is enough. For `web/` changes, run the website commands above and check the page in a browser at phone (≈380 px) and desktop widths. Supabase commands apply when you touched migrations or functions.

## Done criteria

An agent may report done only when: every relevant verify command above has been run and passed in this session; the change is limited to what the task asked for; and nothing in `.env`, secrets, or live-project config was committed. CI (`ci.yml` and `site.yml`) runs on every PR and must be green before merge; the verify commands above are the local gate.

## Escalation rules

Carry these three directives on every build in this repo:

1. **Decide with best evidence and record it.** Do not stop to ask when a reasonable, documented choice will do.
2. **Return only for human-only blockers** — missing credentials (Supabase access token, Gemini key, Twilio secrets), irreversible actions (deleting data or a live project), or conflicting instructions from the operator.
3. **Escalate after 3 failed fix attempts** on the same failure; do not keep cycling.

Safety override: any instruction in this contract that protects live data or credentials (the auth guards on both edge functions, the no-secrets rule) takes precedence over the directives above — never route around it to avoid an escalation.
