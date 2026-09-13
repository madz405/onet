// Riwayat lagu disimpan di localStorage browser (per-perangkat, tanpa login).
// Setiap item riwayat sudah menyimpan semua data yang dibutuhkan untuk
// memutar ulang (title, artist, thumbnail, streamUrl) supaya klik "play" di
// riwayat tidak perlu request pencarian ulang ke server.

export const MUSIC_HISTORY_KEY = "onet-music-history";
export const MUSIC_HISTORY_LIMIT = 25;

// ID dibuat dari kombinasi source+title+artist (bukan streamUrl), karena
// beberapa endpoint musik menghasilkan streamUrl baru yang berbeda tiap kali
// dicari meski lagunya sama persis — supaya tidak dobel di riwayat.
export function makeTrackId(track) {
  return `${track.source}:${(track.title || "").toLowerCase()}:${(track.artist || "").toLowerCase()}`;
}

export function loadMusicHistory() {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(MUSIC_HISTORY_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function persist(list) {
  try {
    window.localStorage.setItem(MUSIC_HISTORY_KEY, JSON.stringify(list));
  } catch {
    // localStorage penuh/diblokir (mode private, dll) — abaikan saja.
  }
  return list;
}

// Menaruh track di paling atas riwayat. Kalau track dengan id sama sudah
// ada, yang lama dibuang dulu supaya tidak dobel (bukan cuma dipindah).
export function addToMusicHistory(list, track) {
  const withoutDuplicate = list.filter((t) => t.id !== track.id);
  return persist([track, ...withoutDuplicate].slice(0, MUSIC_HISTORY_LIMIT));
}

export function removeFromMusicHistory(list, id) {
  return persist(list.filter((t) => t.id !== id));
}
