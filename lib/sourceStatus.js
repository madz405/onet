// Status sumber per platform, dihitung dari hasil unduhan asli beberapa menit
// terakhir. Disimpan di memori server (tanpa database), jadi:
// - hilang saat server restart/deploy, lalu terisi lagi sendiri dari pemakaian;
// - di hosting serverless, tiap instance punya catatan sendiri (hasilnya perkiraan).
const WINDOW_MS = 15 * 60 * 1000; // hanya hitung 15 menit terakhir
const MIN_ATTEMPTS = 3; // data kurang dari ini dianggap normal
const MAX_EVENTS = 30;
const DOWN_RATE = 0.8; // 80%+ gagal -> gangguan
const UNSTABLE_RATE = 0.5; // 50%+ gagal -> tidak stabil

const store = globalThis.__sourceStatus || (globalThis.__sourceStatus = new Map());

export function recordResult(platform, ok) {
  if (!platform) return;
  const list = store.get(platform) || [];
  list.push({ t: Date.now(), ok: Boolean(ok) });
  if (list.length > MAX_EVENTS) list.shift();
  store.set(platform, list);
}

// Hanya mengembalikan platform yang bermasalah: { instagram: "down", facebook: "unstable" }.
// Platform yang tidak muncul berarti normal atau belum cukup data.
export function getProblemPlatforms() {
  const since = Date.now() - WINDOW_MS;
  const out = {};
  for (const [platform, list] of store) {
    const recent = list.filter((e) => e.t >= since);
    if (recent.length < MIN_ATTEMPTS) continue;
    const failRate = recent.filter((e) => !e.ok).length / recent.length;
    if (failRate >= DOWN_RATE) out[platform] = "down";
    else if (failRate >= UNSTABLE_RATE) out[platform] = "unstable";
  }
  return out;
}
