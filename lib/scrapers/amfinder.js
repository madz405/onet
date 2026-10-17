// AM Finder — cari link preset Alight Motion di komentar video TikTok.
// Sumber utama : webapi-fawn.vercel.app/download/amfinderv2 (bisa menemukan beberapa
//                link sekaligus, mis. preset 5MB Alight Motion + XML Google Drive).
// Cadangan     : scraper bintangapi.my.id/api/amfind (dipakai situs starlabs.biz.id).
// Disesuaikan dari skrip bot WhatsApp: axios diganti fetch bawaan Node (sama seperti
// scraper lain di project ini), dan responsnya dinormalisasi supaya UI tidak
// bergantung pada struktur mentah dari sumber.
//
// Catatan: video di hasil ini HANYA untuk preview, bukan untuk diunduh.

import { isTtSiteUrl, resolveTikTokUrl } from "@/lib/resolveTikTokUrl";

const ENDPOINT = "https://bintangapi.my.id/api/amfind/";
const TIMEOUT_MS = 30000;
const V2_ENDPOINT = "https://webapi-fawn.vercel.app/download/amfinderv2";
const V2_TIMEOUT_MS = 25000; // + cadangan 30 dtk masih di bawah maxDuration route (60 dtk)
const MAX_ITEMS = 10;

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
    return u.hostname === "tiktok.com" || u.hostname.endsWith(".tiktok.com") || isTtSiteUrl(input);
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
// Urutan: endpoint amfinderv2 dulu, kalau gagal / tidak menemukan preset -> scraper.
export async function findAlightMotionPreset(url) {
  if (!isTikTokUrl(String(url || "").trim())) throw new Error("Link TikTok tidak valid.");
  // tt.site (link pendek baru TikTok) diikuti dulu ke link tiktok.com aslinya.
  const target = await resolveTikTokUrl(url);

  try {
    return await findViaV2(target);
  } catch (err) {
    console.error("[amfinder] amfinderv2 gagal, pakai scraper:", err.message);
  }
  return findViaScraper(target);
}

// --- Sumber utama: amfinderv2 --------------------------------------------------
async function findViaV2(target) {
  const res = await fetch(`${V2_ENDPOINT}?${new URLSearchParams({ url: target }).toString()}`, {
    headers: { Accept: "application/json", "User-Agent": HEADERS["User-Agent"] },
    cache: "no-store",
    signal: AbortSignal.timeout(V2_TIMEOUT_MS),
  });
  const json = await res.json().catch(() => null);
  const d = json?.data;
  if (!res.ok || !json?.status || !d || typeof d !== "object") {
    throw new Error(`HTTP ${res.status}${json?.message ? `: ${json.message}` : ""}`);
  }

  // Semua link preset (5MB Alight Motion, XML di Google Drive, dst.), tanpa duplikat.
  const seen = new Set();
  const items = [];
  for (const it of [...(Array.isArray(d.presets) ? d.presets : []), ...(Array.isArray(d.commentPresets) ? d.commentPresets : [])]) {
    const link = safeHttpsUrl(it?.url);
    if (!link || seen.has(link)) continue;
    seen.add(link);
    items.push({
      label: String(it?.name || "Preset").slice(0, 60),
      format: it?.format ? String(it.format).slice(0, 40) : null,
      url: link,
    });
    if (items.length >= MAX_ITEMS) break;
  }
  if (!items.length) throw new Error("tidak ada preset");

  const stats = d.stats || {};
  const author = d.author || null;
  const preview = d.preview || {};

  return {
    status: true,
    scanned: num(d.scanned?.comments) + num(d.scanned?.replies),
    foundIn: "comment",
    thumbnail: safeHttpsUrl(d.thumbnail || preview.cover),
    video: {
      id: d.videoId || null,
      caption: d.caption || d.title || "",
      // Hanya untuk preview di <video>, bukan tombol download.
      previewUrl: preview.playable === false ? null : safeHttpsUrl(preview.src),
      url: safeHttpsUrl(d.sourceUrl),
      views: num(stats.views),
      likes: num(stats.likes),
      comments: num(stats.comments),
      shares: num(stats.shares),
      createdAt: stats.createTime || null,
    },
    user: author
      ? {
          username: author.uniqueId || null,
          displayName: author.nickname || author.uniqueId || null,
          avatar: safeHttpsUrl(author.avatar),
        }
      : null,
    preset: {
      username: author?.uniqueId || null,
      isAuthor: (d.presets || []).some((p) => p?.byAuthor),
      likes: 0,
      createdAt: null,
      items,
    },
  };
}

// --- Cadangan: scraper bintangapi ---------------------------------------------
async function findViaScraper(target) {
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
