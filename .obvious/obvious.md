# Lanekeeper — Agent Guidance

Robot-sweeper concept project for NYC bike lanes. **No traditional app server.** The "app" is a set of self-contained static HTML pages, a hosted Supabase backend (PostGIS + Deno edge functions), a Python cost-model CLI, and a Playwright-based prototype renderer.

## Stack

| Layer | Tech | Runs where |
| --- | --- | --- |
| Presentation | Static HTML + three.js 0.170 (from jsdelivr CDN, importmap) | Browser only, no build step |
| Run report | Static HTML (`web/run-report.html`) | Browser only |
| Data platform | Supabase (Postgres + PostGIS), project `fvvxmvtoozpxmdkdumrx` us-east-1 | Hosted — not run locally in this sandbox (no Docker) |
| Edge functions | Deno/TS (`supabase/functions/verify-glass`, `sms-glass`) | Deployed via Supabase CLI (CLI not installed in sandbox) |
| Cost model | Python 3.13, stdlib only | `python3 analysis/cost_model.py` |
| Prototype renders | Node 20, Playwright 1.56 + Chromium, three 0.170 | `cd prototype && npm install && npm run drawings && npm run render` |

## Commands

```sh
# Cost model CLI (fast, no deps)
python3 analysis/cost_model.py

# Serve the web pages (any static server from repo root; port is whatever you pass)
python3 -m http.server 8000
# open http://127.0.0.1:8000/web/index.html

# Re-render prototype images into docs/prototype/ (writes tracked JPGs — expect a dirty tree)
cd prototype && npm install && npm run drawings && npm run render
```

There is no lint, typecheck, or test suite. Use `python3 -m py_compile analysis/cost_model.py prototype/drawings.py` and `node --check prototype/shoot.mjs` as sanity checks.

## Supabase (hosted)

```sh
supabase link --project-ref <your-project-ref>
supabase db push
supabase functions deploy verify-glass
supabase functions deploy sms-glass --no-verify-jwt
supabase secrets set --env-file .env
```

Env vars used by edge functions (set via `supabase secrets set`): `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `GEMINI_API_KEY`, `GEMINI_MODEL` (optional, defaults to `gemini-robotics-er-2-preview`), `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `SMS_WEBHOOK_URL` (optional), `REPORTER_SALT`. Note: README references `.env.example` but the file is not in the repo — TODO(confirm).

`sms-glass` has JWT checks off (Twilio can't send one); it verifies `X-Twilio-Signature` instead.

## Known sandbox limits

- No Docker, no Supabase CLI, no Deno in the sandbox: the DB and edge functions cannot run locally. Do not attempt `supabase db push` against the live project without explicit instruction — one migration (`20261010200000_hazard_includes_rider_reports.sql`) is written but intentionally not yet applied live.
- Web pages load three.js from jsdelivr; they need network in the browser to render the 3D scenes.

## Codebase map

See [codebase-map.md](codebase-map.md).

## Local verification

Primary flows, verified 2026-10-30:

1. **Cost model CLI**: `python3 analysis/cost_model.py` — prints low/base/high scenarios; base case robot $18.28 vs staffed $44.34 per lane-mile (matches README's ~$18 vs ~$44).
2. **Presentation page**: serve repo root statically, open `/web/index.html` in Chromium — renders title "Lanekeeper" with 3 live three.js canvases, 15.7k chars of body text, zero console errors.
3. **Run report**: `/web/run-report.html` renders with zero console errors.

## Snapshot

Sandbox snapshot captured after a verified local-dev run: `czeepa1tvupy60dixdjy:default` at `2026-10-30T15:31:35Z`.
