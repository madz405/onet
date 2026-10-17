// TikTok kini membagikan link pendek dengan domain tt.site (selain vt.tiktok.com /
// vm.tiktok.com). API downloader di hulu belum tentu mengenali tt.site, jadi link
// itu diikuti dulu pengalihannya sampai ketemu link tiktok.com asli
// (https://www.tiktok.com/@user/video/ID atau /photo/ID), baru diproses.
//
// Aman dari SSRF: hanya host tt.site / tiktok.com yang pernah diakses, termasuk
// di setiap langkah pengalihan. Kalau gagal, link aslinya dikembalikan apa adanya.

const UA =
  "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Mobile Safari/537.36";
const MAX_HOPS = 6;

const isShortHost = (h) => h === "tt.site" || h.endsWith(".tt.site");
const isTikTokHost = (h) => h === "tiktok.com" || h.endsWith(".tiktok.com");
const allowedHost = (h) => isShortHost(h) || isTikTokHost(h);

// Link TikTok yang sudah "final" (menunjuk ke video/slide tertentu).
function canonicalOf(href) {
  try {
    const u = new URL(href);
    const h = u.hostname.toLowerCase();
    if (!isTikTokHost(h) || /^(vt|vm)\./.test(h)) return null;
    if (!/\/(video|photo)\/\d+/.test(u.pathname)) return null;
    return `https://www.tiktok.com${u.pathname.replace(/\/+$/, "")}`; // buang parameter pelacak
  } catch {
    return null;
  }
}

export function isTtSiteUrl(input) {
  try {
    return isShortHost(new URL(String(input || "").trim()).hostname.toLowerCase());
  } catch {
    return false;
  }
}

export async function resolveTikTokUrl(input) {
  const original = String(input || "").trim();
  if (!isTtSiteUrl(original)) return original; // vt/vm.tiktok.com dll tetap seperti sebelumnya

  let current = new URL(original).href;
  try {
    for (let hop = 0; hop < MAX_HOPS; hop++) {
      const host = new URL(current).hostname.toLowerCase();
      if (!allowedHost(host)) break;
      const done = canonicalOf(current);
      if (done) return done;

      const res = await fetch(current, {
        redirect: "manual",
        headers: { "User-Agent": UA, "Accept-Language": "en-US,en;q=0.9" },
        signal: AbortSignal.timeout(8000),
        cache: "no-store",
      });

      const loc = res.headers.get("location");
      if (loc) {
        current = new URL(loc, current).href;
        continue;
      }

      // Tanpa pengalihan HTTP (mis. halaman perantara dengan meta refresh / JS):
      // cari link TikTok di isinya.
      const body = (await res.text()).slice(0, 300000).replace(/\\u002F/gi, "/").replace(/\\\//g, "/");
      const m =
        body.match(/https?:\/\/(?:www\.|m\.)?tiktok\.com\/@?[^\s"'<>\\?]*\/(?:video|photo)\/\d+/i) ||
        body.match(/https?:\/\/(?:vt|vm)\.tiktok\.com\/[\w-]+\/?/i);
      if (!m) break;
      current = m[0];
    }
  } catch (err) {
    console.error("[tiktok] gagal mengikuti link tt.site:", err.message);
  }

  // Tidak ketemu link final: pakai hasil terakhir kalau itu masih link TikTok, kalau tidak, aslinya.
  try {
    const h = new URL(current).hostname.toLowerCase();
    if (isTikTokHost(h)) return canonicalOf(current) || current;
  } catch {
    // abaikan
  }
  return original;
}
