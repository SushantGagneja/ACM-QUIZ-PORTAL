import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  // This will show up loudly in the browser console instead of every
  // query failing later with a confusing, unrelated-looking error.
  console.error(
    "Missing Supabase env vars. Check NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY " +
      "are set — on Netlify, this means Site settings → Environment variables, not just .env.local."
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);