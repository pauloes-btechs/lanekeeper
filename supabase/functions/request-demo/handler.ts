// Demo-request intake for the marketing site.
// Public endpoint (verify_jwt = false): the form is anonymous, so a JWT would add nothing.
// Protection instead: origin allowlist, field validation, honeypot, and rate limits on a
// salted hash of the caller's IP and email. Raw IPs are never stored.

export type Db = {
  countSince(column: "ip_hash" | "email_hash", value: string, sinceIso: string): Promise<number>;
  insert(row: Record<string, unknown>): Promise<{ error?: string }>;
};

export const LIMITS = { perIpHour: 5, perEmailDay: 3 };

const ALLOWED_ORIGINS = [
  "https://pauloes-btechs.github.io",
  "http://localhost:5173",
  "http://localhost:4173",
  "http://127.0.0.1:5173",
  "http://127.0.0.1:4173",
];

export function cors(origin: string | null, extra: string[] = []) {
  const ok = origin && [...ALLOWED_ORIGINS, ...extra].includes(origin);
  return {
    "Access-Control-Allow-Origin": ok ? origin! : ALLOWED_ORIGINS[0],
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "content-type, apikey, authorization, x-client-info",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

const EMAIL = /^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i;
const clean = (v: unknown, max: number) => (typeof v === "string" ? v.replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, max) : "");

export type Fields = { name: string; email: string; city: string; organization: string; role: string; laneMiles: number | null; message: string; page: string };

export function validate(body: Record<string, unknown>): { fields?: Fields; errors?: Record<string, string> } {
  const f: Fields = {
    name: clean(body.name, 120),
    email: clean(body.email, 254).toLowerCase(),
    city: clean(body.city, 80),
    organization: clean(body.organization, 160),
    role: clean(body.role, 120),
    laneMiles: null,
    message: typeof body.message === "string" ? body.message.trim().slice(0, 2000) : "",
    page: clean(body.page, 200),
  };
  const errors: Record<string, string> = {};
  if (f.name.length < 2) errors.name = "Enter your name.";
  if (!EMAIL.test(f.email)) errors.email = "Enter a valid work email.";
  if (f.city.length < 2) errors.city = "Choose or enter a city.";
  if (f.organization.length < 2) errors.organization = "Enter your agency or organization.";
  if (body.laneMiles !== undefined && body.laneMiles !== null && body.laneMiles !== "") {
    const n = Number(body.laneMiles);
    if (!Number.isFinite(n) || n < 0 || n > 100000) errors.laneMiles = "Enter lane miles as a number, or leave it blank.";
    else f.laneMiles = Math.round(n * 10) / 10;
  }
  return Object.keys(errors).length ? { errors } : { fields: f };
}

async function sha256(text: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, "0")).join("");
}

export async function handleRequestDemo(req: Request, db: Db, salt: string, extraOrigins: string[] = []): Promise<Response> {
  const origin = req.headers.get("origin");
  const headers = { ...cors(origin, extraOrigins), "Content-Type": "application/json" };
  const reply = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers });

  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers });
  if (req.method !== "POST") return reply(405, { error: "Use POST." });
  if (origin && ![...ALLOWED_ORIGINS, ...extraOrigins].includes(origin)) return reply(403, { error: "Origin not allowed." });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return reply(400, { error: "Body must be JSON." });
  }

  // Honeypot: a field people never see. Bots fill it; pretend success and store nothing.
  if (typeof body.website === "string" && body.website.trim() !== "") return reply(200, { ok: true });

  const { fields, errors } = validate(body);
  if (errors) return reply(422, { error: "Some fields need attention.", fields: errors });

  const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || req.headers.get("cf-connecting-ip") || "unknown";
  const ipHash = await sha256(`${salt}:ip:${ip}`);
  const emailHash = await sha256(`${salt}:email:${fields!.email}`);

  const hourAgo = new Date(Date.now() - 3600_000).toISOString();
  const dayAgo = new Date(Date.now() - 86_400_000).toISOString();
  if ((await db.countSince("ip_hash", ipHash, hourAgo)) >= LIMITS.perIpHour) {
    return reply(429, { error: "Too many requests from this network. Try again in an hour." });
  }
  if ((await db.countSince("email_hash", emailHash, dayAgo)) >= LIMITS.perEmailDay) {
    return reply(429, { error: "We already have your request. We'll be in touch." });
  }

  const { error } = await db.insert({
    name: fields!.name,
    email: fields!.email,
    city: fields!.city,
    organization: fields!.organization,
    role: fields!.role || null,
    lane_miles: fields!.laneMiles,
    message: fields!.message || null,
    page: fields!.page || null,
    ip_hash: ipHash,
    email_hash: emailHash,
  });
  if (error) {
    console.error("demo_requests insert failed", error);
    return reply(500, { error: "We couldn't save your request. Please try again." });
  }
  return reply(201, { ok: true });
}
