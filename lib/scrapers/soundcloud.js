/***
  @ Base: https://api-v2.soundcloud.com/
  @ Note: Cari & putar lagu SoundCloud lewat API v2 internal yang dipakai
    soundcloud.com sendiri di browser (tanpa API key resmi, tanpa akun).
    Teknik ini sama dengan yang dipakai library open-source lain
    (yt-dlp, soundcloud.ts, soundcloud_explode_dart, dkk): ambil
    "client_id" publik dari bundle JS yang dimuat halaman soundcloud.com,
    lalu pakai buat panggil endpoint search & resolve stream.

    Dibuat sebagai pengganti utama endpoint pihak ketiga (api-faa.my.id)
    yang sering diblokir firewall/Wordfence saat dipanggil dari IP server
    (Vercel) walau berhasil kalau dites manual dari browser.
***/

import { CHROME_UA } from "./scraperUtils.js";

// client_id dicache di memori proses (bertahan selama function/serverless
// instance masih hidup) supaya tidak perlu scrape ulang bundle JS di
// setiap pencarian. SoundCloud kadang merotasi nilainya, makanya ada TTL
// dan bukan di-hardcode permanen.
let cachedClientId = null;
let cachedAt = 0;
const CLIENT_ID_TTL = 6 * 60 * 60 * 1000; // 6 jam

async function fetchClientId() {
  if (cachedClientId && Date.now() - cachedAt < CLIENT_ID_TTL) return cachedClientId;

  const homeRes = await fetch("https://soundcloud.com/", {
    headers: { "User-Agent": CHROME_UA, Accept: "text/html" },
    signal: AbortSignal.timeout(10000),
  });
  const homeHtml = await homeRes.text();

  const scriptUrls = [
    ...homeHtml.matchAll(/<script[^>]+src="(https:\/\/a-v2\.sndcdn\.com\/assets\/[^"]+\.js)"/gi),
  ].map((m) => m[1]);
  if (!scriptUrls.length) {
    throw new Error("Tidak menemukan bundle JS SoundCloud untuk ambil client_id.");
  }

  // client_id biasanya nempel di salah satu bundle utama/vendor — dicoba
  // dari yang paling akhir dimuat karena biasanya itu bundle utamanya.
  for (const scriptUrl of [...scriptUrls].reverse()) {
    try {
      const jsRes = await fetch(scriptUrl, {
        headers: { "User-Agent": CHROME_UA },
        signal: AbortSignal.timeout(10000),
      });
      const js = await jsRes.text();
      const match =
        js.match(/client_id\s*:\s*"([a-zA-Z0-9]{32})"/) ||
        js.match(/client_id=([a-zA-Z0-9]{32})/);
      if (match) {
        cachedClientId = match[1];
        cachedAt = Date.now();
        return cachedClientId;
      }
    } catch {
      // coba bundle berikutnya
    }
  }

  throw new Error("Tidak menemukan client_id di bundle JS SoundCloud.");
}

// Track dari hasil search punya beberapa "transcoding" (format berbeda).
// Diambil versi MP3 progressive karena bisa langsung diputar tanpa perlu
// parsing playlist HLS.
async function resolveStreamUrl(track, clientId) {
  const transcodings = track.media?.transcodings || [];
  const progressive =
    transcodings.find(
      (t) => t.format?.protocol === "progressive" && /mp3/i.test(t.format?.mime_type || "")
    ) || transcodings.find((t) => t.format?.protocol === "progressive");
  if (!progressive?.url) return null;

  const res = await fetch(`${progressive.url}?client_id=${clientId}`, {
    headers: { "User-Agent": CHROME_UA, Accept: "application/json" },
    signal: AbortSignal.timeout(10000),
  });
  const data = await res.json();
  return data?.url || null;
}

export async function searchSoundCloud(query) {
  const clientId = await fetchClientId();

  const searchUrl = `https://api-v2.soundcloud.com/search/tracks?q=${encodeURIComponent(
    query
  )}&client_id=${clientId}&limit=1`;
  const res = await fetch(searchUrl, {
    headers: { "User-Agent": CHROME_UA, Accept: "application/json" },
    signal: AbortSignal.timeout(10000),
  });
  const data = await res.json();
  const track = data?.collection?.[0];
  if (!track) throw new Error("Scraper SoundCloud tidak menemukan lagunya.");

  const streamUrl = await resolveStreamUrl(track, clientId);
  if (!streamUrl) throw new Error("Scraper SoundCloud tidak menemukan link stream-nya.");

  return {
    title: track.title || null,
    artist: track.user?.username || null,
    duration: typeof track.duration === "number" ? Math.round(track.duration / 1000) : null,
    thumbnail: track.artwork_url || track.user?.avatar_url || null,
    streamUrl,
  };
}
