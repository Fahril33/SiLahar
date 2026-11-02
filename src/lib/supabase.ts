import { createClient, type SupabaseClient } from "@supabase/supabase-js";

function sanitizeSupabaseUrl(url?: string): string | undefined {
  if (!url) return undefined;
  return url.trim().replace(/\/rest\/v1\/?$/i, "").replace(/\/+$/, "");
}

// 1. Primary / New Supabase Account (Target for all writes, creates, uploads, auth)
// Supports either:
// - VITE_SUPABASE_URL (new account) + VITE_SUPABASE_LEGACY_URL (old account)
// - VITE_SUPABASE_URL (old account) + VITE_SUPABASE_NEW_URL (new account)
const rawNewUrl = import.meta.env.VITE_SUPABASE_NEW_URL || import.meta.env.VITE_SUPABASE_URL;
const rawNewAnonKey =
  import.meta.env.VITE_SUPABASE_NEW_ANON_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY;

// 2. Legacy / Historical Supabase Account (For reading historical reports & proof images)
const rawLegacyUrl = import.meta.env.VITE_SUPABASE_NEW_URL
  ? import.meta.env.VITE_SUPABASE_URL
  : import.meta.env.VITE_SUPABASE_LEGACY_URL;
const rawLegacyAnonKey = import.meta.env.VITE_SUPABASE_NEW_URL
  ? import.meta.env.VITE_SUPABASE_ANON_KEY
  : import.meta.env.VITE_SUPABASE_LEGACY_ANON_KEY;

export const supabaseUrl = sanitizeSupabaseUrl(rawNewUrl);
export const supabaseAnonKey = rawNewAnonKey?.trim();

export const legacySupabaseUrl = sanitizeSupabaseUrl(rawLegacyUrl);
export const legacySupabaseAnonKey = rawLegacyAnonKey?.trim();

/** Active primary client for all writes (creates, updates, uploads, auth). */
export const supabase =
  supabaseUrl && supabaseAnonKey ? createClient(supabaseUrl, supabaseAnonKey) : null;

/** Legacy client for reading historical data from the old storage-exhausted account. */
export const legacySupabase =
  legacySupabaseUrl &&
  legacySupabaseAnonKey &&
  legacySupabaseUrl !== supabaseUrl
    ? createClient(legacySupabaseUrl, legacySupabaseAnonKey)
    : null;

/** Returns list of all configured Supabase clients for unified reading (primary first, then legacy). */
export function getReadSupabaseClients(): SupabaseClient[] {
  const clients: SupabaseClient[] = [];
  if (supabase) clients.push(supabase);
  if (legacySupabase) clients.push(legacySupabase);
  return clients;
}

/** Resolves appropriate SupabaseClient based on a storage URL or file path. */
export function getClientForUrl(url?: string): SupabaseClient | null {
  if (!url) return supabase;
  if (legacySupabase && legacySupabaseUrl && url.includes(legacySupabaseUrl)) {
    return legacySupabase;
  }
  return supabase;
}

/** Verify a sensitive operation without replacing the administrator's main session. */
export function createIsolatedSupabaseClient() {
  if (!supabaseUrl || !supabaseAnonKey) throw new Error("Supabase belum dikonfigurasi.");
  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
      storageKey: `silahar-media-${crypto.randomUUID()}`,
    },
  });
}

