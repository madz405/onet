// Pengaturan kecepatan putar pemutar musik (slow / fast).
// Dipakai MusicPlayerProvider (menerapkan ke <audio>) dan FullPlayer (panel Kecepatan).
//
// Kecepatan memakai playbackRate bawaan browser, jadi tidak butuh izin CORS dan tidak
// ada beban server. "Nada tetap" (preservesPitch) menjaga nada saat lagu dipercepat
// atau diperlambat; kalau dimatikan hasilnya efek slowed / nightcore.

export const FX_KEY = "koyen-audio-fx";

export const RATE_MIN = 0.5;
export const RATE_MAX = 2;
export const RATE_PRESETS = [0.5, 0.75, 1, 1.25, 1.5, 2];

export const DEFAULT_FX = {
  rate: 1,
  keepPitch: true,
};

export function clampRate(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return 1;
  return Math.round(Math.min(RATE_MAX, Math.max(RATE_MIN, n)) * 100) / 100;
}

// Menjaga data tersimpan tetap valid walau formatnya rusak / berasal dari versi lama
// (versi lama juga menyimpan field equalizer yang sekarang diabaikan).
export function sanitizeFx(raw) {
  return {
    rate: clampRate(raw?.rate ?? 1),
    keepPitch: raw?.keepPitch !== false,
  };
}

export function loadFx() {
  try {
    const raw = localStorage.getItem(FX_KEY);
    return raw ? sanitizeFx(JSON.parse(raw)) : { ...DEFAULT_FX };
  } catch {
    return { ...DEFAULT_FX };
  }
}

export function saveFx(fx) {
  try {
    localStorage.setItem(FX_KEY, JSON.stringify(fx));
  } catch {
    // localStorage tidak tersedia: pengaturan hanya berlaku selama sesi
  }
}

// defaultPlaybackRate ikut diisi karena browser mengembalikan playbackRate ke nilai
// default setiap kali sumber audio dimuat ulang (ganti lagu).
export function applyRate(el, fx) {
  if (!el) return;
  try {
    el.defaultPlaybackRate = fx.rate;
    el.playbackRate = fx.rate;
    el.preservesPitch = fx.keepPitch;
    el.mozPreservesPitch = fx.keepPitch;
    el.webkitPreservesPitch = fx.keepPitch;
  } catch {
    // browser lama: abaikan
  }
}
