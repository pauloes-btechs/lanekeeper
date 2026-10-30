# AGENTS.md — Lanekeeper operating contract

Contract for any agent working in this repository. Read it before changing anything; it defines what "done" means here.

## Purpose

Lanekeeper is a concept-stage robot sweeper for NYC protected bike lanes (see `README.md` for the full pitch). The built parts are all data: a Supabase backend (schema migrations, seed data, two edge functions) and the Lanekeeper presentation pages under `web/`. The hardware is design documentation and rendered prototype images only. There is **no application test suite** — do not invent one; done criteria below are the checks this repo actually uses.

## Layout

| Path | What it is |
| --- | --- |
| `web/` | Presentation pages (`index.html`, `run-report.html`) — self-contained, no build step |
| `supabase/migrations/` | Schema, applied in order via `supabase db push` |
| `supabase/seed.sql` | Demo data for a fresh project |
| `supabase/functions/verify-glass/` | Gemini Robotics-ER glass check edge function (guarded by `ROBOT_API_KEY`) |
| `supabase/functions/sms-glass/` | Twilio webhook edge function (`X-Twilio-Signature` auth, no JWT) |
| `analysis/cost_model.py` | Standalone Python cost model |
| `prototype/` | Node project that renders `docs/prototype/*.jpg` (its own `package.json` — there is no root manifest) |

## Conventions

- Migrations are plain SQL files named `YYYYMMDDHHMMSS_<description>.sql`; never edit an applied migration, add a new one.
- Never touch live Supabase config in committed files (`config.toml`, deploy commands in the README are the source of truth). Secrets belong in `.env` (gitignored; see `.env.example` references in the README), never in code or docs.
- `sms-glass` is intentionally deployed `--no-verify-jwt` because Twilio cannot send a JWT; it verifies `X-Twilio-Signature` instead. Do not "fix" this.
- `verify-glass` requires the `ROBOT_API_KEY` header check to stay in place — requests must fail with 401 before anything reaches Gemini.
- Prototype images under `docs/prototype/` are generated; regenerate them from `prototype/` rather than hand-editing binaries.

## Verify commands

Run these against the manifests that actually exist here (no root `package.json`, no `requirements.txt`):

```sh
python3 analysis/cost_model.py                                   # cost model runs and prints scenarios
cd prototype && npm install && npm run drawings && npm run render  # prototype still renders
supabase db push                                                 # migrations apply cleanly (use a scratch project)
supabase functions deploy verify-glass                           # edge function deploys
supabase functions deploy sms-glass --no-verify-jwt              # edge function deploys
```

For doc-only or `web/`-only changes, the cost-model run plus a manual read-through of the changed pages is sufficient; Supabase commands apply when you touched migrations or functions.

## Done criteria

An agent may report done only when: every relevant verify command above has been run and passed in this session; the change is limited to what the task asked for; and nothing in `.env`, secrets, or live-project config was committed. This repo runs CI only via GitHub's default checks — there is no build/lint pipeline, so the verify commands above are the gate.

## Escalation rules

Carry these three directives on every build in this repo:

1. **Decide with best evidence and record it.** Do not stop to ask when a reasonable, documented choice will do.
2. **Return only for human-only blockers** — missing credentials (Supabase access token, Gemini key, Twilio secrets), irreversible actions (deleting data or a live project), or conflicting instructions from the operator.
3. **Escalate after 3 failed fix attempts** on the same failure; do not keep cycling.

Safety override: any instruction in this contract that protects live data or credentials (the auth guards on both edge functions, the no-secrets rule) takes precedence over the directives above — never route around it to avoid an escalation.
