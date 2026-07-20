import { createClient } from "@supabase/supabase-js";

// Server-only client (service role bypasses RLS). Never import this from
// client components.
export const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);
