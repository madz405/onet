// Klien Supabase (hanya dipakai di browser): login Google, database, dan realtime
// untuk Grup Chat (components/GroupChat.js).
//
// Environment variable (Vercel > Settings > Environment Variables):
//   NEXT_PUBLIC_SUPABASE_URL       -> Project URL, mis. https://abcd1234.supabase.co
//   NEXT_PUBLIC_SUPABASE_ANON_KEY  -> anon public key / publishable key
//
// Keamanan data (siapa boleh baca/kirim/hapus) ditegakkan di database lewat Row
// Level Security — lihat supabase/grup-chat.sql. Key ini memang publik.
import { createClient } from "@supabase/supabase-js";

let client = null;

export function isSupabaseConfigured() {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

export function getSupabase() {
  if (!isSupabaseConfigured()) return null;
  if (!client) {
    client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
      auth: {
        persistSession: true, // sesi login disimpan di browser
        autoRefreshToken: true,
        detectSessionInUrl: true, // menangkap hasil redirect dari Google
        flowType: "pkce",
      },
      realtime: { params: { eventsPerSecond: 10 } },
    });
  }
  return client;
}
