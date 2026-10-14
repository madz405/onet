// Helper murni (tanpa React/Supabase) untuk Grup Chat: format waktu, pengelompokan
// pesan ala WhatsApp, dan alasan kenapa seseorang tidak bisa mengirim pesan.

export const REACTIONS = ["👍", "❤️", "😂", "😮", "🙏", "😢"];
export const MAX_MESSAGE = 1000;
export const MAX_NAME = 20;
export const PAGE_SIZE = 50;
const GROUP_GAP_MS = 5 * 60 * 1000; // pesan beruntun dari orang yang sama dalam 5 menit digabung

export function formatClock(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", hour12: false }).replace(":", ".");
}

function dayKey(iso) {
  const d = new Date(iso);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

export function dayLabel(iso, now = new Date()) {
  const d = new Date(iso);
  if (dayKey(iso) === dayKey(now.toISOString())) return "Hari ini";
  const y = new Date(now);
  y.setDate(y.getDate() - 1);
  if (dayKey(iso) === dayKey(y.toISOString())) return "Kemarin";
  return d.toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
}

// Ubah daftar pesan (urut lama -> baru) jadi item tampilan: pemisah tanggal +
// pesan dengan penanda "pertama/terakhir dalam kelompok".
export function groupMessages(messages, now = new Date()) {
  const items = [];
  let prev = null;
  for (let i = 0; i < messages.length; i++) {
    const m = messages[i];
    const newDay = !prev || dayKey(prev.created_at) !== dayKey(m.created_at);
    if (newDay) items.push({ type: "day", key: `day-${dayKey(m.created_at)}`, label: dayLabel(m.created_at, now) });
    const sameGroup =
      !newDay &&
      prev.user_id === m.user_id &&
      new Date(m.created_at) - new Date(prev.created_at) < GROUP_GAP_MS;
    const next = messages[i + 1];
    const nextSame =
      next &&
      dayKey(next.created_at) === dayKey(m.created_at) &&
      next.user_id === m.user_id &&
      new Date(next.created_at) - new Date(m.created_at) < GROUP_GAP_MS;
    items.push({ type: "msg", key: m.id, msg: m, first: !sameGroup, last: !nextSame });
    prev = m;
  }
  return items;
}

// Alasan (teks) kenapa user tidak bisa mengirim sekarang, atau null kalau boleh.
// Server tetap yang memutuskan; ini hanya untuk memberi tahu user lebih awal.
export function sendBlockReason(profile, settings, now = Date.now()) {
  if (!profile) return "Memuat profil...";
  if (profile.banned) return "Akunmu diblokir dari grup ini.";
  if (profile.role === "admin") return null;
  if (profile.muted_until && new Date(profile.muted_until).getTime() > now) {
    return `Kamu sedang dibisukan sampai ${new Date(profile.muted_until).toLocaleString("id-ID", {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    })}.`;
  }
  if (settings?.only_admin_can_send) return "Hanya admin yang bisa mengirim pesan di grup ini.";
  return null;
}

export function snippet(text, max = 80) {
  const s = String(text || "").replace(/\s+/g, " ").trim();
  return s.length > max ? `${s.slice(0, max)}…` : s;
}

export const MUTE_OPTIONS = [
  { label: "1 jam", ms: 60 * 60 * 1000 },
  { label: "1 hari", ms: 24 * 60 * 60 * 1000 },
  { label: "7 hari", ms: 7 * 24 * 60 * 60 * 1000 },
];

export const SLOW_MODE_OPTIONS = [
  { label: "Mati", value: 0 },
  { label: "5 detik", value: 5 },
  { label: "15 detik", value: 15 },
  { label: "30 detik", value: 30 },
  { label: "1 menit", value: 60 },
  { label: "5 menit", value: 300 },
];

export function httpsOrNull(v) {
  try {
    const u = new URL(String(v || "").trim());
    return u.protocol === "https:" ? u.href : null;
  } catch {
    return null;
  }
}
