// verify-glass: sends a robot camera frame to Gemini Robotics-ER and records the verdict.
// Auth: every request must carry a ROBOT_API_KEY header, timing-safe compared against the
// ROBOT_API_KEY edge secret, before anything touches Gemini. Fail closed: if the secret is
// unset, every request is rejected.
import { GoogleGenAI } from "npm:@google/genai@1";
import { createClient } from "npm:@supabase/supabase-js@2";

const MODEL = Deno.env.get("GEMINI_MODEL") ?? "gemini-robotics-er-2-preview";

// Simple per-caller spend cap: at most MAX_PER_HOUR Gemini calls per hour window, counted
// in memory on each edge-function instance. Known limits: each instance keeps its own
// counter (the real ceiling is roughly MAX_PER_HOUR x instance count), counters reset on
// cold start or redeploy, and a fixed window admits short bursts at its edges. This bounds
// worst-case spend; a durable org-wide limiter is a separate deferred item — do not build
// it here.
const MAX_PER_HOUR = Number(Deno.env.get("VERIFY_MAX_PER_HOUR") ?? 60);
const HOUR_MS = 3_600_000;
const spend = new Map<string, { start: number; count: number }>();

function spendCapReached(key: string) {
  const now = Date.now();
  const w = spend.get(key);
  if (!w || now - w.start >= HOUR_MS) {
    spend.set(key, { start: now, count: 0 });
    return false;
  }
  return w.count >= MAX_PER_HOUR;
}

/** Test hook: clear the in-memory spend window. */
export function resetSpendLimiter() {
  spend.clear();
}

function recordSpend(key: string) {
  const w = spend.get(key)!; // window exists: spendCapReached ran earlier in the request
  w.count++;
}

function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

const db = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

const PROMPT = `Ground-level frame from a bike-lane sweeper.
Point to every piece or patch of broken glass. Ignore ice, clear plastic,
paper, cups, road reflectors and wet leaves. Answer as JSON:
[{"point": [y, x], "label": "broken_glass", "shards": n}]
One entry per distinct cluster; "shards" is your estimate of pieces in it.
Points are [y, x] normalized to 0-1000. Return [] if there is no glass.`;

export type Pt = { point?: [number, number]; label?: string; shards?: number };

export type GeminiCaller = (frameB64: string, mimeType: string) => Promise<Pt[]>;

async function callGemini(frameB64: string, mimeType: string): Promise<Pt[]> {
  const apiKey = Deno.env.get("GEMINI_API_KEY");
  if (!apiKey) throw new Error("GEMINI_API_KEY secret is not set for this project");
  const ai = new GoogleGenAI({ apiKey });
  const res = await ai.models.generateContent({
    model: MODEL,
    contents: [{ role: "user", parts: [
      { inlineData: { mimeType, data: frameB64 } },
      { text: PROMPT },
    ] }],
    config: { responseMimeType: "application/json" },
  });
  const parsed = JSON.parse(res.text ?? "[]");
  return Array.isArray(parsed) ? parsed : [];
}

export async function handleVerifyGlass(
  req: Request,
  runGemini: GeminiCaller = callGemini,
): Promise<Response> {
  if (req.method !== "POST") return Response.json({ error: "Use POST" }, { status: 405 });

  // Auth first, before anything that spends or writes. A missing or empty header and an
  // unset secret both fail closed here.
  const robotKey = Deno.env.get("ROBOT_API_KEY");
  const provided = req.headers.get("ROBOT_API_KEY") ?? "";
  if (!robotKey || !safeEqual(provided, robotKey)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (spendCapReached(robotKey)) {
    return Response.json({ error: "Hourly verify cap reached" }, { status: 429 });
  }

  if (!Deno.env.get("GEMINI_API_KEY")) {
    return Response.json({ error: "GEMINI_API_KEY secret is not set for this project" }, { status: 500 });
  }

  let body: { detectionId?: string; frameB64?: string; mimeType?: string };
  try { body = await req.json(); } catch { return Response.json({ error: "Body must be JSON" }, { status: 400 }); }
  const { detectionId, frameB64, mimeType = "image/jpeg" } = body;
  if (!frameB64) return Response.json({ error: "frameB64 is required" }, { status: 400 });

  let pts: Pt[] = [];
  try {
    recordSpend(robotKey); // count the attempt: failed calls still cost
    pts = await runGemini(frameB64, mimeType);
  } catch (e) {
    if (detectionId) await db.from("detections").update({ er_verdict: "unsure" }).eq("id", detectionId);
    return Response.json({ error: "Gemini call failed", model: MODEL, detail: String(e) }, { status: 502 });
  }

  const verdict = pts.length ? "glass" : "not_glass";
  const shards = pts.reduce((n, p) => n + (p.shards ?? 1), 0);

  // detectionId is optional: without it this is a dry run that writes nothing
  if (detectionId) {
    const { error } = await db.from("detections").update({
      er_verdict: verdict,
      er_point: pts[0]?.point ?? null,
      est_shards: shards,
    }).eq("id", detectionId);
    if (error) return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({ model: MODEL, verdict, shards, points: pts });
}
