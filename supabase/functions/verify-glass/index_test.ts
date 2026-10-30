// Deno tests for the verify-glass handler: `deno test --allow-env supabase/functions/verify-glass/`
import { assertEquals } from "jsr:@std/assert@1";

// The handler module reads Supabase env at import time, so set dummies first.
Deno.env.set("SUPABASE_URL", "https://dummy.supabase.co");
Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "dummy-service-role-key");
Deno.env.set("GEMINI_API_KEY", "dummy-gemini-key");
Deno.env.set("ROBOT_API_KEY", "test-robot-key");
// Low cap so the spend-limit test can hit it quickly.
Deno.env.set("VERIFY_MAX_PER_HOUR", "2");

const { handleVerifyGlass, resetSpendLimiter } = await import("./handler.ts");
type Pt = import("./handler.ts").Pt;

let geminiCalls = 0;
const mockGemini = (): Promise<Pt[]> => {
  geminiCalls++;
  return Promise.resolve([{ point: [500, 500], label: "broken_glass", shards: 3 }]);
};

const post = (body: unknown, key?: string) =>
  new Request("https://fvvxmvtoozpxmdkdumrx.supabase.co/functions/v1/verify-glass", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(key ? { "ROBOT_API_KEY": key } : {}),
    },
    body: JSON.stringify(body),
  });

Deno.test("non-POST is rejected", async () => {
  const res = await handleVerifyGlass(new Request("https://x.test", { method: "GET" }), mockGemini);
  assertEquals(res.status, 405);
});

Deno.test("missing key is rejected with 401 before any Gemini call", async () => {
  resetSpendLimiter();
  geminiCalls = 0;
  const res = await handleVerifyGlass(post({ frameB64: "abc" }), mockGemini);
  assertEquals(res.status, 401);
  assertEquals(geminiCalls, 0);
});

Deno.test("wrong key is rejected with 401 before any Gemini call", async () => {
  resetSpendLimiter();
  geminiCalls = 0;
  const res = await handleVerifyGlass(post({ frameB64: "abc" }, "wrong-key"), mockGemini);
  assertEquals(res.status, 401);
  assertEquals(geminiCalls, 0);
});

Deno.test("unset ROBOT_API_KEY secret fails closed with 401", async () => {
  resetSpendLimiter();
  geminiCalls = 0;
  const saved = Deno.env.get("ROBOT_API_KEY")!;
  Deno.env.delete("ROBOT_API_KEY");
  try {
    const res = await handleVerifyGlass(post({ frameB64: "abc" }, "test-robot-key"), mockGemini);
    assertEquals(res.status, 401);
    assertEquals(geminiCalls, 0);
  } finally {
    Deno.env.set("ROBOT_API_KEY", saved);
  }
});

Deno.test("valid key proceeds and returns the Gemini verdict", async () => {
  resetSpendLimiter();
  geminiCalls = 0;
  const res = await handleVerifyGlass(post({ frameB64: "abc" }, "test-robot-key"), mockGemini);
  assertEquals(res.status, 200);
  assertEquals(await res.json(), { model: "gemini-robotics-er-2-preview", verdict: "glass", shards: 3, points: [{ point: [500, 500], label: "broken_glass", shards: 3 }] });
  assertEquals(geminiCalls, 1);
});

Deno.test("spend cap returns 429 once the hourly window is exhausted", async () => {
  resetSpendLimiter();
  const frame = { frameB64: "abc" };
  assertEquals((await handleVerifyGlass(post(frame, "test-robot-key"), mockGemini)).status, 200);
  assertEquals((await handleVerifyGlass(post(frame, "test-robot-key"), mockGemini)).status, 200);
  const res = await handleVerifyGlass(post(frame, "test-robot-key"), mockGemini);
  assertEquals(res.status, 429);
});
