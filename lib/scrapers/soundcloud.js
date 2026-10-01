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

// Track punya beberapa "transcoding" (format berbeda). Diambil versi MP3
// progressive karena bisa langsung diputar/diunduh tanpa perlu parsing
// playlist HLS. Link hasilnya (CDN sndcdn) sudah bertanda tangan sendiri,
// jadi bisa diputar langsung di browser maupun lewat proxy tanpa header khusus.
async function resolveStreamUrl(track, clientId) {
  const transcodings = track.media?.transcodings || [];
  const progressive =
    transcodings.find(
      (t) => t.format?.protocol === "progressive" && /mp3/i.test(t.format?.mime_type || "")
    ) || transcodings.find((t) => t.format?.protocol === "progressive");
  if (!progressive?.url) return null;

  // Sebagian track mewajibkan track_authorization agar link stream diberikan.
  const auth = track.track_authorization
    ? `&track_authorization=${encodeURIComponent(track.track_authorization)}`
    : "";
  const res = await fetch(`${progressive.url}?client_id=${clientId}${auth}`, {
    headers: { "User-Agent": CHROME_UA, Accept: "application/json" },
    signal: AbortSignal.timeout(10000),
  });
  const data = await res.json().catch(() => null);
  return data?.url || null;
}

// Sampul resolusi kecil (-large, 100px) dinaikkan ke 500px.
const bigArtwork = (u) => (u ? u.replace("-large.", "-t500x500.") : null);

// Ambil info + link stream MP3 dari URL track SoundCloud langsung (dipakai
// downloader SoundCloud dan pemutar musik). Jalur utama; Klickaud hanya
// cadangan karena link unduhannya menolak diakses dari server (butuh sesi).
export async function resolveSoundCloudUrl(rawUrl) {
  let url = String(rawUrl || "").match(/https?:\/\/[^\s]+/i)?.[0];
  if (!url) throw new Error("Link SoundCloud tidak valid.");

  // Link pendek (on.soundcloud.com / soundcloud.app.goo.gl): ikuti redirect.
  if (/on\.soundcloud\.com|app\.goo\.gl/i.test(url)) {
    const r = await fetch(url, {
      headers: { "User-Agent": CHROME_UA },
      redirect: "follow",
      signal: AbortSignal.timeout(10000),
    });
    if (r.url) url = r.url;
  }
  url = url.split("?")[0];

  let track = null;
  for (let attempt = 0; attempt < 2 && !track; attempt++) {
    const clientId = await fetchClientId();
    const res = await fetch(
      `https://api-v2.soundcloud.com/resolve?url=${encodeURIComponent(url)}&client_id=${clientId}`,
      {
        headers: { "User-Agent": CHROME_UA, Accept: "application/json" },
        signal: AbortSignal.timeout(10000),
      }
    );
    // client_id yang tersimpan mungkin sudah dirotasi SoundCloud: buang cache, ulangi sekali.
    if ((res.status === 401 || res.status === 403) && attempt === 0) {
      cachedClientId = null;
      continue;
    }
    if (!res.ok) throw new Error(`SoundCloud menolak permintaan (status ${res.status}).`);
    track = await res.json().catch(() => null);
  }
  if (!track) throw new Error("Gagal membaca data track SoundCloud.");
  if (track.kind !== "track") {
    throw new Error("Link ini bukan track tunggal (playlist/album belum didukung).");
  }

  const clientId = await fetchClientId();
  const streamUrl = await resolveStreamUrl(track, clientId);
  if (!streamUrl) throw new Error("Track ini tidak menyediakan link stream MP3.");

  return {
    title: track.title || null,
    artist: track.user?.username || null,
    duration: typeof track.duration === "number" ? Math.round(track.duration / 1000) : null,
    thumbnail: bigArtwork(track.artwork_url || track.user?.avatar_url),
    streamUrl,
  };
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
    thumbnail: bigArtwork(track.artwork_url || track.user?.avatar_url),
    streamUrl,
  };
}
