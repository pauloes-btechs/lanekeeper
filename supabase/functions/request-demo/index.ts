import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { handleRequestDemo, type Db } from "./handler.ts";

const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
  auth: { persistSession: false },
});

const db: Db = {
  async countSince(column, value, sinceIso) {
    const { count, error } = await supabase
      .from("demo_requests")
      .select("id", { count: "exact", head: true })
      .eq(column, value)
      .gte("created_at", sinceIso);
    if (error) throw error;
    return count ?? 0;
  },
  async insert(row) {
    const { error } = await supabase.from("demo_requests").insert(row);
    return { error: error?.message };
  },
};

// DEMO_SALT keeps hashed IPs and emails unlinkable across projects; set it as an edge secret.
const salt = Deno.env.get("DEMO_SALT") ?? Deno.env.get("REPORTER_SALT") ?? "lanekeeper-demo";
const extraOrigins = (Deno.env.get("DEMO_ALLOWED_ORIGINS") ?? "").split(",").map((s) => s.trim()).filter(Boolean);

Deno.serve((req) => handleRequestDemo(req, db, salt, extraOrigins));
