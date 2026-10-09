// Scraper AM Finder — cari link preset Alight Motion di komentar video TikTok.
// Sumber: bintangapi.my.id/api/amfind (dipakai situs starlabs.biz.id).
// Disesuaikan dari skrip bot WhatsApp: axios diganti fetch bawaan Node (sama seperti
// scraper lain di project ini), dan responsnya dinormalisasi supaya UI tidak
// bergantung pada struktur mentah dari sumber.
//
// Catatan: video di hasil ini HANYA untuk preview, bukan untuk diunduh.

const ENDPOINT = "https://bintangapi.my.id/api/amfind/";
const TIMEOUT_MS = 30000;

const HEADERS = {
  Accept: "*/*",
  "Accept-Language": "id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7",
  Connection: "keep-alive",
  Origin: "https://starlabs.biz.id",
  Referer: "https://starlabs.biz.id/",
  "Sec-Fetch-Dest": "empty",
  "Sec-Fetch-Mode": "cors",
  "Sec-Fetch-Site": "cross-site",
  "User-Agent":
    "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Mobile Safari/537.36",
  "sec-ch-ua": '"Chromium";v="139", "Not;A=Brand";v="99"',
  "sec-ch-ua-mobile": "?1",
  "sec-ch-ua-platform": '"Android"',
};

// Hanya terima link TikTok (tiktok.com, vt.tiktok.com, vm.tiktok.com, dst.).
export function isTikTokUrl(input) {
  try {
    const u = new URL(String(input || "").trim());
    if (u.protocol !== "https:" && u.protocol !== "http:") return false;
    return u.hostname === "tiktok.com" || u.hostname.endsWith(".tiktok.com");
  } catch {
    return false;
  }
}

// Hanya link https yang boleh jadi tombol "Buka preset" (cegah javascript:/data: dsb).
function safeHttpsUrl(value) {
  try {
    const u = new URL(String(value || "").trim());
    return u.protocol === "https:" ? u.href : null;
  } catch {
    return null;
  }
}

function num(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

// Hasil: objek hasil yang sudah dinormalisasi. Melempar Error berpesan jelas kalau gagal.
export async function findAlightMotionPreset(url) {
  const target = String(url || "").trim();
  if (!isTikTokUrl(target)) throw new Error("Link TikTok tidak valid.");

  let res;
  try {
    res = await fetch(`${ENDPOINT}?${new URLSearchParams({ url: target }).toString()}`, {
      headers: HEADERS,
      cache: "no-store",
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (err) {
    if (err?.name === "TimeoutError" || err?.name === "AbortError") {
      throw new Error("Server pencari terlalu lama merespons. Coba lagi.");
    }
    throw new Error("Tidak bisa terhubung ke server pencari.");
  }

  const raw = await res.text().catch(() => "");
  let json = null;
  try {
    json = JSON.parse(raw);
  } catch {
    // bukan JSON (mis. halaman blokir Cloudflare) — ditangani di bawah
  }

  // Dua kemungkinan bentuk respons:
  //  - langsung : { success, data: {...} }            (yang dikirim server sumber)
  //  - terbungkus: { ok, data: { success, data: {...} } } (hasil lewat proxy starlabs)
  const inner = json?.data?.data ? json.data : json;
  const d = inner?.data;

  if (!res.ok || json?.ok === false || inner?.success === false || !d || typeof d !== "object") {
    const msg = inner?.message || inner?.error || json?.message || json?.error;
    // Muncul di log server (mis. Vercel Logs) supaya penyebab aslinya kelihatan.
    console.error("[amfinder] gagal", res.status, raw.slice(0, 500));
    const detail = msg || raw.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 120);
    throw new Error(`Gagal mencari preset (HTTP ${res.status})${detail ? `: ${detail}` : "."}`.slice(0, 250));
  }

  const items = (Array.isArray(d.preset?.items) ? d.preset.items : [])
    .map((it) => ({ label: String(it?.label || "Preset").slice(0, 60), url: safeHttpsUrl(it?.url) }))
    .filter((it) => it.url);

  if (!items.length) {
    throw new Error("Link preset Alight Motion tidak ditemukan di komentar video ini.");
  }

  const v = d.video || {};

  return {
    status: true,
    scanned: num(d.total_comments_scanned),
    foundIn: d.found_in || null, // mis. "comment"
    thumbnail: safeHttpsUrl(d.thumbnail),
    video: {
      id: v.id || null,
      caption: v.caption || "",
      // Hanya untuk preview di <video>, bukan tombol download.
      previewUrl: safeHttpsUrl(v.play_url),
      url: safeHttpsUrl(v.url),
      views: num(v.views),
      likes: num(v.likes),
      comments: num(v.comments),
      shares: num(v.shares),
      createdAt: v.created_at || null,
    },
    user: d.user
      ? {
          username: d.user.username || null,
          displayName: d.user.display_name || d.user.username || null,
          avatar: safeHttpsUrl(d.user.avatar),
        }
      : null,
    preset: {
      username: d.preset?.username || null,
      isAuthor: Boolean(d.preset?.is_author),
      likes: num(d.preset?.likes),
      createdAt: d.preset?.created_at || null,
      items,
    },
  };
}
