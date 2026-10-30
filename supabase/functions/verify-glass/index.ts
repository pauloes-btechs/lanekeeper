import "jsr:@supabase/functions-js@2/edge-runtime.d.ts";
import { handleVerifyGlass } from "./handler.ts";

Deno.serve((req) => handleVerifyGlass(req));
