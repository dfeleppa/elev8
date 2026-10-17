import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error(
    "Missing Supabase server environment variables (SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL, and SUPABASE_SERVICE_ROLE_KEY)."
  );
}

export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
});

// Password authentication must never replace the shared admin client's session:
// PostgREST would then run subsequent requests as the last signed-in user.
export function createPasswordAuthClient() {
  return createClient(supabaseUrl!, supabaseServiceKey!, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}
