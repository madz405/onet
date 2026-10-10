// Klien Supabase untuk fitur realtime (Ruang Virtual). Hanya dipakai di browser.
// Butuh dua environment variable (Vercel > Settings > Environment Variables):
//   NEXT_PUBLIC_SUPABASE_URL       -> Project URL, mis. https://abcd1234.supabase.co
//   NEXT_PUBLIC_SUPABASE_ANON_KEY  -> anon public key
// Yang dipakai hanya Realtime (Broadcast + Presence), jadi TIDAK perlu membuat tabel.
import { createClient } from "@supabase/supabase-js";

let client = null;

export function isSupabaseConfigured() {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

export function getSupabase() {
  if (!isSupabaseConfigured()) return null;
  if (!client) {
    client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
      realtime: { params: { eventsPerSecond: 20 } },
    });
  }
  return client;
}
