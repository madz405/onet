// Efek suara pemutar musik: equalizer 5 pita + kecepatan putar (slow / fast).
// Dipakai MusicPlayerProvider (mesin audio) dan FullPlayer (panel pengaturan).
//
// Catatan penting soal equalizer: Web Audio API hanya boleh memproses audio dari
// link yang mengizinkan CORS (atau same-origin). Kalau tidak, suaranya hilang total.
// Makanya MusicPlayerProvider mencoba memuat langsung dengan crossOrigin dulu, dan
// kalau sumbernya menolak, memutarnya lewat /api/fetch-media (same-origin).
// Kecepatan putar tidak butuh CORS.

export const FX_KEY = "koyen-audio-fx";

export const EQ_MIN_DB = -12;
export const EQ_MAX_DB = 12;
export const RATE_MIN = 0.5;
export const RATE_MAX = 2;
export const RATE_PRESETS = [0.5, 0.75, 1, 1.25, 1.5, 2];

export const EQ_BANDS = [
  { id: "bass", label: "Bass", freq: 60, type: "lowshelf" },
  { id: "lowmid", label: "Low-mid", freq: 230, type: "peaking", q: 1 },
  { id: "mid", label: "Mid", freq: 910, type: "peaking", q: 1 },
  { id: "highmid", label: "High-mid", freq: 3600, type: "peaking", q: 1 },
  { id: "treble", label: "Treble", freq: 14000, type: "highshelf" },
];

export const EQ_PRESETS = [
  { id: "flat", label: "Flat", gains: [0, 0, 0, 0, 0] },
  { id: "bass", label: "Bass Boost", gains: [8, 5, 1, 0, -1] },
  { id: "treble", label: "Treble Boost", gains: [-1, 0, 1, 5, 8] },
  { id: "vocal", label: "Vokal", gains: [-2, -1, 4, 4, 1] },
  { id: "pop", label: "Pop", gains: [3, 1, -1, 2, 4] },
  { id: "rock", label: "Rock", gains: [5, 3, -2, 3, 5] },
];

export const DEFAULT_FX = {
  eqOn: false,
  gains: [0, 0, 0, 0, 0],
  rate: 1,
  keepPitch: true, // true = nada tetap saat dipercepat/diperlambat; false = efek slowed / nightcore
};

export const clamp = (v, min, max) => Math.min(max, Math.max(min, v));

export function clampRate(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return 1;
  return Math.round(clamp(n, RATE_MIN, RATE_MAX) * 100) / 100;
}

export function clampGain(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return 0;
  return Math.round(clamp(n, EQ_MIN_DB, EQ_MAX_DB));
}

// Menjaga data tersimpan tetap valid walau formatnya rusak / berubah.
export function sanitizeFx(raw) {
  const gains = Array.isArray(raw?.gains) ? raw.gains : [];
  return {
    eqOn: raw?.eqOn === true,
    gains: EQ_BANDS.map((_, i) => clampGain(gains[i] ?? 0)),
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
    // localStorage tidak tersedia — pengaturan hanya berlaku selama sesi
  }
}

// Penurun volume otomatis saat ada pita yang dinaikkan, supaya suara tidak pecah (clipping).
export function headroom(gains) {
  const maxBoost = Math.max(0, ...gains);
  return 10 ** (-(maxBoost * 0.6) / 20);
}

export function sameGains(a, b) {
  return a.length === b.length && a.every((v, i) => v === b[i]);
}

// Memasang rantai: <audio> -> filter pita 1..5 -> pengatur volume -> speaker.
// createMediaElementSource hanya boleh dipanggil SEKALI per elemen <audio>, jadi hasilnya
// disimpan di elemen itu sendiri.
export function wireEq(ctx, el, fx) {
  if (el.__koyenGraph) return el.__koyenGraph;
  const source = ctx.createMediaElementSource(el);
  const filters = EQ_BANDS.map((band, i) => {
    const f = ctx.createBiquadFilter();
    f.type = band.type;
    f.frequency.value = band.freq;
    if (band.q) f.Q.value = band.q;
    f.gain.value = fx.eqOn ? fx.gains[i] : 0;
    return f;
  });
  const preamp = ctx.createGain();
  preamp.gain.value = fx.eqOn ? headroom(fx.gains) : 1;
  source.connect(filters[0]);
  filters.forEach((f, i) => f.connect(filters[i + 1] || preamp));
  preamp.connect(ctx.destination);
  el.__koyenGraph = { filters, preamp };
  return el.__koyenGraph;
}

export function applyEqGains(ctx, graph, fx) {
  if (!ctx || !graph) return;
  const t = ctx.currentTime;
  graph.filters.forEach((f, i) => f.gain.setTargetAtTime(fx.eqOn ? fx.gains[i] : 0, t, 0.03));
  graph.preamp.gain.setTargetAtTime(fx.eqOn ? headroom(fx.gains) : 1, t, 0.03);
}

// Kecepatan + nada. defaultPlaybackRate ikut diisi karena browser mengembalikan
// playbackRate ke nilai default setiap kali sumber audio dimuat ulang.
export function applyRate(el, fx) {
  if (!el) return;
  try {
    el.defaultPlaybackRate = fx.rate;
    el.playbackRate = fx.rate;
    el.preservesPitch = fx.keepPitch;
    el.mozPreservesPitch = fx.keepPitch;
    el.webkitPreservesPitch = fx.keepPitch;
  } catch {
    // browser lama — abaikan
  }
}

// Perantara audio untuk lagu yang tidak mengizinkan CORS. Kalau NEXT_PUBLIC_AUDIO_PROXY
// diisi (alamat Cloudflare Worker, lihat cloudflare/audio-proxy-worker.js) dipakai itu,
// sehingga bandwidth Vercel tidak terpakai. Kalau kosong, jatuh ke /api/fetch-media di Vercel.
// Catatan: variabel NEXT_PUBLIC_* ditanam saat build, jadi perlu redeploy setelah mengubahnya.
export function audioProxyBase() {
  return (process.env.NEXT_PUBLIC_AUDIO_PROXY || "").trim().replace(/\/+$/, "");
}

export function proxiedAudioUrl(streamUrl) {
  const base = audioProxyBase();
  if (base) return `${base}/?url=${encodeURIComponent(streamUrl)}`;
  return `/api/fetch-media?url=${encodeURIComponent(streamUrl)}&inline=1&type=audio`;
}
