import { createClient } from "@supabase/supabase-js";

function sanitizeSupabaseUrl(url?: string): string | undefined {
  if (!url) return undefined;
  return url.trim().replace(/\/rest\/v1\/?$/i, "").replace(/\/+$/, "");
}

const rawSupabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseUrl = sanitizeSupabaseUrl(rawSupabaseUrl);
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim();

export const supabase =
  supabaseUrl && supabaseAnonKey ? createClient(supabaseUrl, supabaseAnonKey) : null;
