/***
  @ Base: https://www.facebook.com/
  @ Note: Ambil link video langsung dari HTML halaman video Facebook itu
    sendiri — tanpa API pihak ketiga, tanpa headless browser. Facebook
    (beda dari fdown.net) tidak di belakang Cloudflare, dan untuk video
    publik biasanya masih menaruh link videonya mentah-mentah di dalam
    HTML/script halaman itu (field semacam hd_src_no_ratelimit /
    browser_native_hd_url), jadi cukup di-fetch lalu di-regex.

    Ini teknik lama yang dipakai banyak library serupa (xaviabot/fb-downloader
    dkk) dan masih dipakai/di-maintain sampai sekarang, tapi tetap ada
    batasannya:
    - Cuma untuk video PUBLIK; video privat/butuh login tidak akan ketemu.
    - Live video umumnya tidak didukung.
    - Facebook sewaktu-waktu bisa mengubah markup-nya, sehingga pattern di
      bawah bisa perlu diperbarui lagi nanti (sama seperti scraper lain).
***/

const DESKTOP_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36";

// Beberapa kemungkinan nama field yang dipakai Facebook untuk menaruh link
// video mentah di HTML-nya (berubah-ubah tergantung versi halaman/jenis
// posting: video biasa vs reels vs video lama).
const HD_PATTERNS = [
  /"browser_native_hd_url":"([^"]+)"/,
  /hd_src_no_ratelimit:"([^"]+)"/,
  /"playable_url_quality_hd":"([^"]+)"/,
];
const SD_PATTERNS = [
  /"browser_native_sd_url":"([^"]+)"/,
  /sd_src_no_ratelimit:"([^"]+)"/,
  /"playable_url":"([^"]+)"/,
];

// Field-field di atas ditulis dengan escaping ala JSON (slash jadi \/, dst),
// jadi tinggal dibungkus tanda kutip lalu di-JSON.parse buat unescape-nya,
// tanpa perlu nulis replace() manual satu-satu.
function extractUrl(html, patterns) {
  for (const re of patterns) {
    const m = html.match(re);
    if (m) {
      try {
        const decoded = JSON.parse(`"${m[1]}"`);
        if (decoded.startsWith("http")) return decoded;
      } catch {
        // lanjut coba pattern berikutnya kalau hasil match-nya bukan string JSON yang valid
      }
    }
  }
  return null;
}

function extractMeta(html, property) {
  const re = new RegExp(`<meta property="${property}" content="([^"]*)"`, "i");
  const m = html.match(re);
  if (!m) return null;
  return m[1]
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

export async function scrapeFacebook(url) {
  if (!url || typeof url !== "string") throw new Error("Link Facebook tidak valid.");

  // redirect: "follow" (default) supaya link pendek semacam fb.watch/... ikut
  // diarahkan ke halaman videonya oleh fetch sendiri.
  const res = await fetch(url, {
    headers: {
      "User-Agent": DESKTOP_UA,
      "Accept-Language": "en-US,en;q=0.9",
    },
    signal: AbortSignal.timeout(15000),
  });
  const html = await res.text();

  const hd = extractUrl(html, HD_PATTERNS);
  const sd = extractUrl(html, SD_PATTERNS);

  if (!hd && !sd) {
    throw new Error(
      "Tidak menemukan link video di halaman Facebook (kemungkinan video privat/live, atau markup Facebook berubah)."
    );
  }

  const media = [];
  if (hd) media.push({ type: "video", label: "HD", url: hd });
  if (sd) media.push({ type: "video", label: "SD", url: sd });

  return {
    title: extractMeta(html, "og:title") || "Facebook Video",
    author: null,
    thumbnail: extractMeta(html, "og:image"),
    media,
  };
}
