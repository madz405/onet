// Riwayat unduhan downloader. Disimpan di localStorage browser (per perangkat,
// tanpa login, tidak dikirim ke server). Yang disimpan hanya data ringan:
// link asli, platform, jenis file, judul, dan waktu. Link hasil unduhan
// (CDN) sengaja TIDAK disimpan karena cepat kedaluwarsa, jadi "Unduh lagi"
// memproses ulang link aslinya.

export const DOWNLOAD_HISTORY_KEY = "koyen-download-history";
export const DOWNLOAD_HISTORY_LIMIT = 50;
const EVENT = "koyen:download-history";

export function makeHistoryId(platform, url) {
  return `${platform}:${url}`;
}

// Jenis file dari hasil scraper: video > audio > foto.
export function kindOfResult(result) {
  const types = (result?.media || []).map((m) => m.type);
  if (types.includes("video")) return "Video";
  if (types.includes("audio")) return "Audio";
  if (types.includes("image")) return "Foto";
  return "Video";
}

export function loadDownloadHistory() {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(DOWNLOAD_HISTORY_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function persist(list) {
  try {
    window.localStorage.setItem(DOWNLOAD_HISTORY_KEY, JSON.stringify(list));
  } catch {
    // localStorage penuh/diblokir (mode private, dll): abaikan saja.
  }
  window.dispatchEvent(new Event(EVENT));
  return list;
}

// Dipanggil setelah proses berhasil. Link yang sama dipindah ke paling atas
// (tidak dobel).
export function addDownloadHistory({ url, platform, format, result }) {
  if (typeof window === "undefined" || !url || !platform) return;
  if (!result?.media?.length) return;
  const id = makeHistoryId(platform, url);
  const entry = {
    id,
    url,
    platform,
    format: format || null,
    kind: kindOfResult(result),
    title: (result.title || "").toString().slice(0, 120),
    at: Date.now(),
  };
  const rest = loadDownloadHistory().filter((h) => h.id !== id);
  persist([entry, ...rest].slice(0, DOWNLOAD_HISTORY_LIMIT));
}

export function removeDownloadHistory(id) {
  if (typeof window === "undefined") return;
  persist(loadDownloadHistory().filter((h) => h.id !== id));
}

export function clearDownloadHistory() {
  if (typeof window === "undefined") return;
  persist([]);
}

// Berlangganan perubahan (dari halaman ini, modal, atau tab lain).
export function subscribeDownloadHistory(callback) {
  window.addEventListener(EVENT, callback);
  window.addEventListener("storage", callback);
  return () => {
    window.removeEventListener(EVENT, callback);
    window.removeEventListener("storage", callback);
  };
}
