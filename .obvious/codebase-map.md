# Codebase Map

| Path | What it is |
| --- | --- |
| `web/index.html` | The Lanekeeper presentation — self-contained page with three.js night-run scenes, map strategy, schema, pilot ask |
| `web/run-report.html` | Public run-report page riders open from a QR code (static snapshot of one run) |
| `supabase/migrations/` | Postgres schema, in order: lane cells (PostGIS), detections, cleanups, run reports, rider reports, hazard scoring |
| `supabase/seed.sql` | Demo data: 1st Ave lane cut into 25 m cells, one sweeper, one 4–6 a.m. run |
| `supabase/functions/verify-glass/` | Deno edge function — sends a camera frame to Gemini Robotics-ER, records the verdict |
| `supabase/functions/sms-glass/` | Deno edge function — Twilio webhook for texted/MMS glass reports |
| `supabase/config.toml` | Supabase project config (project id, per-function JWT settings) |
| `analysis/cost_model.py` | Cost per lane-mile: staffed mini-sweeper vs robot, three scenarios. Stdlib only |
| `prototype/` | Source that renders the docs/prototype images: `drawings.py` (SVG), `hero.html` (three.js), `shoot.mjs` (Playwright capture) |
| `docs/prototype/` | Rendered prototype images (JPGs) — outputs, do not hand-edit |
| `README.md` | Project overview, run commands, Supabase deploy steps |
