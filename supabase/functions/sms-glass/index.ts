// Twilio webhook for texted glass reports (SMS/MMS and WhatsApp).
// Auth: every request must carry a valid X-Twilio-Signature (verify_jwt is off because Twilio cannot send a JWT).
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { GoogleGenAI } from "npm:@google/genai@1";
import { createClient } from "npm:@supabase/supabase-js@2";
import exifr from "npm:exifr@7";

const PUBLIC_URL = Deno.env.get("SMS_WEBHOOK_URL") ?? "https://fvvxmvtoozpxmdkdumrx.supabase.co/functions/v1/sms-glass";
const MODEL = Deno.env.get("GEMINI_MODEL") ?? "gemini-robotics-er-2-preview";
const MAX_PER_HOUR = 10;
const NYC = { s: 40.49, n: 40.92, w: -74.27, e: -73.68 };

const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

const xml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const twiml = (msg?: string) => new Response(
  `<?xml version="1.0" encoding="UTF-8"?><Response>${msg ? `<Message>${xml(msg)}</Message>` : ""}</Response>`,
  { headers: { "Content-Type": "text/xml" } },
);
const inNyc = (lat: number, lng: number) => lat > NYC.s && lat < NYC.n && lng > NYC.w && lng < NYC.e;

async function hmacB64(key: string, data: string, algo: "SHA-1" | "SHA-256") {
  const k = await crypto.subtle.importKey("raw", new TextEncoder().encode(key), { name: "HMAC", hash: algo }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", k, new TextEncoder().encode(data));
  return btoa(String.fromCharCode(...new Uint8Array(sig)));
}
function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let r = 0; for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

// Twilio signature: HMAC-SHA1(authToken, url + each POST param name+value sorted by name)
async function validTwilio(sig: string | null, params: URLSearchParams, token: string) {
  if (!sig) return false;
  const keys = [...new Set(params.keys())].sort();
  let data = PUBLIC_URL;
  for (const k of keys) for (const v of params.getAll(k)) data += k + v;
  return safeEqual(await hmacB64(token, data, "SHA-1"), sig);
}

type Analysis = { verdict: "glass" | "not_glass" | "unsure"; shards: number; severity: "low" | "medium" | "high" | null; on_bike_lane: boolean | null; points: unknown[] };

async function analyze(b64: string, mime: string): Promise<Analysis> {
  const ai = new GoogleGenAI({ apiKey: Deno.env.get("GEMINI_API_KEY")! });
  const res = await ai.models.generateContent({
    model: MODEL,
    contents: [{ role: "user", parts: [
      { inlineData: { mimeType: mime, data: b64 } },
      { text: `A cyclist photographed this street surface to report broken glass.
Point to each cluster of broken glass. Ignore ice, clear plastic, paper, cups, reflectors and wet leaves.
Answer with one JSON object:
{"verdict": "glass" | "not_glass" | "unsure",
 "shards": <estimated total pieces>,
 "severity": "low" | "medium" | "high",
 "on_bike_lane": true | false | null,
 "points": [{"point": [y, x], "label": "broken_glass", "shards": n}]}
Points are [y, x] normalized to 0-1000. on_bike_lane is true when green lane paint, a bike symbol or lane lines are visible next to the glass.` },
    ] }],
    config: { responseMimeType: "application/json" },
  });
  const j = JSON.parse(res.text ?? "{}");
  const points = Array.isArray(j.points) ? j.points : [];
  const verdict = ["glass", "not_glass", "unsure"].includes(j.verdict) ? j.verdict : (points.length ? "glass" : "unsure");
  return {
    verdict,
    shards: Number.isFinite(+j.shards) ? Math.max(0, Math.round(+j.shards)) : points.length,
    severity: ["low", "medium", "high"].includes(j.severity) ? j.severity : null,
    on_bike_lane: typeof j.on_bike_lane === "boolean" ? j.on_bike_lane : null,
    points,
  };
}

// NYC Planning GeoSearch: free address/place search for the five boroughs
async function geocode(text: string) {
  const u = new URL("https://geosearch.planninglabs.nyc/v2/search");
  u.searchParams.set("text", text.replace(/\s*&\s*/g, " and ").slice(0, 120));
  u.searchParams.set("size", "1");
  const r = await fetch(u);
  if (!r.ok) return null;
  const f = (await r.json())?.features?.[0];
  if (!f) return null;
  const [lng, lat] = f.geometry.coordinates;
  return inNyc(lat, lng) ? { lat, lng, label: f.properties?.label ?? text } : null;
}

async function saveReport(reporter: string, channel: string, d: Record<string, unknown>, lat: number, lng: number, source: string, place: string | null) {
  const { data, error } = await db.from("rider_reports").insert({
    channel, reporter_hash: reporter,
    location: `SRID=4326;POINT(${lng} ${lat})`,
    location_source: source, place_text: place,
    taken_at: d.taken_at ?? null, photo_path: d.photo_path,
    verdict: d.verdict, shards: d.shards, severity: d.severity, on_bike_lane: d.on_bike_lane,
    points: d.points, model: MODEL,
  }).select("id, cell_id, status").single();
  if (error) throw error;
  return data;
}

function confirmText(r: { id: string; cell_id: string | null; status: string }, d: Record<string, unknown>, place: string) {
  const ref = r.id.slice(0, 6).toUpperCase();
  if (d.verdict !== "glass") {
    return `Thanks. Gemini didn't spot broken glass in that photo near ${place}. If it's there, send a closer shot from about 1 meter away. Ref ${ref}`;
  }
  const sev = d.severity ? `, ${d.severity}` : "";
  const where = r.cell_id ? ` (lane cell ${r.cell_id})` : "";
  const when = r.status === "queued" ? "It's queued for the next 4-6 a.m. sweep." : "Our team will review it.";
  return `Got it: broken glass, about ${d.shards} pieces${sev}, near ${place}${where}. ${when} Thanks for keeping the lane safe. Ref ${ref}`;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("Use POST", { status: 405 });
  const token = Deno.env.get("TWILIO_AUTH_TOKEN");
  const sid = Deno.env.get("TWILIO_ACCOUNT_SID");
  const salt = Deno.env.get("REPORTER_SALT");
  if (!token || !sid || !salt) return new Response("TWILIO_AUTH_TOKEN, TWILIO_ACCOUNT_SID and REPORTER_SALT secrets are required", { status: 500 });

  const params = new URLSearchParams(await req.text());
  if (!(await validTwilio(req.headers.get("X-Twilio-Signature"), params, token))) {
    return new Response("Invalid signature", { status: 403 });
  }

  const from = params.get("From") ?? "";
  const channel = from.startsWith("whatsapp:") ? "whatsapp" : "mms";
  const reporter = await hmacB64(salt, from.replace(/^whatsapp:/, ""), "SHA-256");
  const body = (params.get("Body") ?? "").trim();
  const numMedia = parseInt(params.get("NumMedia") ?? "0", 10);
  const pinLat = parseFloat(params.get("Latitude") ?? "");
  const pinLng = parseFloat(params.get("Longitude") ?? "");

  if (/^(help|info)$/i.test(body)) {
    return twiml("Lanekeeper: text a photo of broken glass in a NYC bike lane. We map it and queue it for the night sweep. Reply STOP to opt out. Msg & data rates may apply.");
  }

  // rate limit per sender
  const hourAgo = new Date(Date.now() - 3600_000).toISOString();
  const { count } = await db.from("rider_reports").select("id", { count: "exact", head: true })
    .eq("reporter_hash", reporter).gte("created_at", hourAgo);
  if ((count ?? 0) >= MAX_PER_HOUR) return twiml("Thanks, we've got plenty from you this hour. Try again a bit later.");

  try {
    // 1) a photo arrived
    if (numMedia > 0) {
      const mediaUrl = params.get("MediaUrl0")!;
      const mime = (params.get("MediaContentType0") ?? "image/jpeg").split(";")[0];
      if (!mime.startsWith("image/")) return twiml("Please send a photo (JPEG or PNG) of the glass.");
      const media = await fetch(mediaUrl, { headers: { Authorization: "Basic " + btoa(`${sid}:${token}`) } });
      if (!media.ok) throw new Error(`media fetch ${media.status}`);
      const buf = new Uint8Array(await media.arrayBuffer());
      if (buf.byteLength > 5_000_000) return twiml("That photo is too large. Please send a smaller one.");

      let gps: { latitude?: number; longitude?: number } | undefined;
      let takenAt: string | null = null;
      try {
        gps = await exifr.gps(buf);
        const meta = await exifr.parse(buf, ["DateTimeOriginal"]);
        if (meta?.DateTimeOriginal instanceof Date) takenAt = meta.DateTimeOriginal.toISOString();
      } catch { /* no EXIF */ }

      let b64 = ""; for (let i = 0; i < buf.length; i += 0x8000) b64 += String.fromCharCode(...buf.subarray(i, i + 0x8000));
      const analysis = await analyze(btoa(b64), mime);

      const path = `${new Date().toISOString().slice(0, 10)}/${crypto.randomUUID()}.${mime === "image/png" ? "png" : "jpg"}`;
      await db.storage.from("rider-photos").upload(path, buf, { contentType: mime === "image/png" ? "image/jpeg" : mime, upsert: false }).catch(() => null);
      const draft = { ...analysis, photo_path: path, taken_at: takenAt };

      const lat = gps?.latitude, lng = gps?.longitude;
      if (typeof lat === "number" && typeof lng === "number" && inNyc(lat, lng)) {
        const r = await saveReport(reporter, channel, draft, lat, lng, "exif", null);
        return twiml(confirmText(r, draft, "the photo's location"));
      }
      if (Number.isFinite(pinLat) && Number.isFinite(pinLng) && inNyc(pinLat, pinLng)) {
        const r = await saveReport(reporter, channel, draft, pinLat, pinLng, "pin", null);
        return twiml(confirmText(r, draft, "your pin"));
      }

      await db.from("text_sessions").upsert({ reporter_hash: reporter, channel, draft,
        created_at: new Date().toISOString(), expires_at: new Date(Date.now() + 30 * 60_000).toISOString() });
      const seen = analysis.verdict === "glass" ? `Gemini sees broken glass (about ${analysis.shards} pieces). ` : "";
      return twiml(channel === "whatsapp"
        ? `${seen}Where is it? Share your location (📎 > Location) or reply with the nearest cross streets, e.g. "1st Ave & E 111th St".`
        : `${seen}Where is it? Reply with the nearest address or cross streets, e.g. "1st Ave & E 111th St, Manhattan".`);
    }

    // 2) a location for a waiting photo
    const { data: session } = await db.from("text_sessions").select("draft, expires_at").eq("reporter_hash", reporter).maybeSingle();
    if (session && new Date(session.expires_at) > new Date()) {
      let loc: { lat: number; lng: number; label: string } | null = null; let source = "pin";
      if (Number.isFinite(pinLat) && Number.isFinite(pinLng) && inNyc(pinLat, pinLng)) loc = { lat: pinLat, lng: pinLng, label: "your pin" };
      else if (body) { loc = await geocode(body); source = "cross_streets"; }
      if (!loc) return twiml(`Couldn't find "${body.slice(0, 60)}" in NYC. Try a street address, e.g. "2100 1st Ave, Manhattan".`);
      const r = await saveReport(reporter, channel, session.draft, loc.lat, loc.lng, source, source === "pin" ? null : loc.label);
      await db.from("text_sessions").delete().eq("reporter_hash", reporter);
      return twiml(confirmText(r, session.draft, loc.label));
    }

    return twiml("Lanekeeper: text a photo of broken glass in a NYC bike lane and we'll map it for the night sweep. Reply HELP for help, STOP to opt out.");
  } catch (e) {
    console.error("sms-glass error", e);
    return twiml("Sorry, something went wrong saving your report. Please try sending the photo again.");
  }
});
