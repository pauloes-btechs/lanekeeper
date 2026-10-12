import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { GoogleGenAI } from "npm:@google/genai@1";
import { createClient } from "npm:@supabase/supabase-js@2";

const MODEL = Deno.env.get("GEMINI_MODEL") ?? "gemini-robotics-er-2-preview";

const PROMPT = `Ground-level frame from a bike-lane sweeper.
Point to every piece or patch of broken glass. Ignore ice, clear plastic,
paper, cups, road reflectors and wet leaves. Answer as JSON:
[{"point": [y, x], "label": "broken_glass", "shards": n}]
One entry per distinct cluster; "shards" is your estimate of pieces in it.
Points are [y, x] normalized to 0-1000. Return [] if there is no glass.`;

const db = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

type Pt = { point?: [number, number]; label?: string; shards?: number };

Deno.serve(async (req) => {
  if (req.method !== "POST") return Response.json({ error: "Use POST" }, { status: 405 });

  const apiKey = Deno.env.get("GEMINI_API_KEY");
  if (!apiKey) {
    return Response.json({ error: "GEMINI_API_KEY secret is not set for this project" }, { status: 500 });
  }

  let body: { detectionId?: string; frameB64?: string; mimeType?: string };
  try { body = await req.json(); } catch { return Response.json({ error: "Body must be JSON" }, { status: 400 }); }
  const { detectionId, frameB64, mimeType = "image/jpeg" } = body;
  if (!frameB64) return Response.json({ error: "frameB64 is required" }, { status: 400 });

  const ai = new GoogleGenAI({ apiKey });
  let pts: Pt[] = [];
  try {
    const res = await ai.models.generateContent({
      model: MODEL,
      contents: [{ role: "user", parts: [
        { inlineData: { mimeType, data: frameB64 } },
        { text: PROMPT },
      ] }],
      config: { responseMimeType: "application/json" },
    });
    const parsed = JSON.parse(res.text ?? "[]");
    pts = Array.isArray(parsed) ? parsed : [];
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
});
