// deno test supabase/functions/request-demo/index_test.ts
import { assertEquals } from "jsr:@std/assert@1";
import { handleRequestDemo, validate, LIMITS, type Db } from "./handler.ts";

const ORIGIN = "https://pauloes-btechs.github.io";
const good = { name: "Ada Lovelace", email: "ada@dot.nyc.gov", city: "New York", organization: "NYC DOT", role: "Bike program", laneMiles: "120", message: "Hello" };

function fakeDb(counts = { ip_hash: 0, email_hash: 0 }) {
  const rows: Record<string, unknown>[] = [];
  const db: Db = {
    countSince: (col) => Promise.resolve(counts[col]),
    insert: (row) => {
      rows.push(row);
      return Promise.resolve({});
    },
  };
  return { db, rows };
}
const post = (body: unknown, origin = ORIGIN) =>
  new Request("http://x/request-demo", { method: "POST", headers: { "content-type": "application/json", origin, "x-forwarded-for": "203.0.113.9" }, body: JSON.stringify(body) });

Deno.test("valid request is stored with hashed ip and email, never raw ip", async () => {
  const { db, rows } = fakeDb();
  const res = await handleRequestDemo(post(good), db, "salt");
  assertEquals(res.status, 201);
  assertEquals(rows.length, 1);
  assertEquals(rows[0].email, "ada@dot.nyc.gov");
  assertEquals(rows[0].lane_miles, 120);
  assertEquals(JSON.stringify(rows[0]).includes("203.0.113.9"), false);
});

Deno.test("honeypot filled: 200 but nothing stored", async () => {
  const { db, rows } = fakeDb();
  const res = await handleRequestDemo(post({ ...good, website: "http://spam" }), db, "salt");
  assertEquals(res.status, 200);
  assertEquals(rows.length, 0);
});

Deno.test("bad fields return 422 with per-field messages", async () => {
  const { db } = fakeDb();
  const res = await handleRequestDemo(post({ ...good, email: "nope", laneMiles: "lots" }), db, "salt");
  assertEquals(res.status, 422);
  const body = await res.json();
  assertEquals(Object.keys(body.fields).sort(), ["email", "laneMiles"]);
});

Deno.test("rate limited by ip", async () => {
  const { db, rows } = fakeDb({ ip_hash: LIMITS.perIpHour, email_hash: 0 });
  const res = await handleRequestDemo(post(good), db, "salt");
  assertEquals(res.status, 429);
  assertEquals(rows.length, 0);
});

Deno.test("unknown origin is refused", async () => {
  const { db } = fakeDb();
  const res = await handleRequestDemo(post(good, "https://evil.example"), db, "salt");
  assertEquals(res.status, 403);
});

Deno.test("validate trims and strips control characters", () => {
  const { fields } = validate({ ...good, name: "  Ada\u0007 Lovelace  " });
  assertEquals(fields!.name, "Ada  Lovelace");
});
