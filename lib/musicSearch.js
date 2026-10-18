// Pencarian & pengambilan link lagu untuk halaman Musik (alur dua langkah):
//   1) searchMusic()  -> daftar hasil (judul, artis, durasi, sampul, URL)
//   2) resolveMusic() -> link stream untuk SATU lagu yang dipilih user
//
// Sumber pencarian:
//   - YouTube    : module "yt-search" (lib/scrapers/youtubeSearch.js)
//   - Spotify    : endpoint nexray  /search/spotify?q=
//   - SoundCloud : endpoint nexray  /search/soundcloud?q=
//
// Pengambilan link (urutan = utama -> cadangan). Yang memakai endpoint API
// hanya menerima judul, jadi dikirim judul (+artis); scraper memakai URL.
//   - YouTube    : endpoint azbry (judul) -> endpoint webapi "play" (judul)
//                  -> scraper Savetube (URL)
//   - Spotify    : endpoint nexray spotifyplay (judul) -> endpoint webapi
//                  "spotplay" (judul) -> scraper Spotimate (URL)
// Endpoint berbasis judul menerima "judul + artis/author" supaya yang diambil
// benar-benar lagu yang dipilih (lihat withArtist()).
//   - SoundCloud : scraper langsung (URL) -> Klickaud (URL) -> endpoint faa (judul)

import { parseDurationToSeconds } from "./scrapers/scraperUtils.js";
import { searchYouTubeVideos } from "./scrapers/youtubeSearch.js";
import { scrapeSavetube } from "./scrapers/youtubeSavetube.js";
import { searchSoundCloudTracks, scrapeSoundCloudUrl } from "./scrapers/soundcloudUrl.js";
import { resolveSoundCloudUrl } from "./scrapers/soundcloud.js";
import { scrapeSpotimate } from "./scrapers/spotimate.js";

const UA =
  "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Mobile Safari/537.36";
const MAX_RESULTS = 15;
const API_TIMEOUT_MS = 12000;

export const MUSIC_SOURCES = ["youtube", "spotify", "soundcloud"];

export async function getJson(url) {
  const res = await fetch(url, {
    headers: {
      "User-Agent": UA,
      Accept: "application/json, text/plain, */*",
      // Beberapa endpoint API komunitas memfilter request tanpa Referer yang wajar.
      Referer: new URL(url).origin + "/",
    },
    signal: AbortSignal.timeout(API_TIMEOUT_MS),
  });
  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    // Detail asli ke log server: biasanya IP datacenter diblokir proteksi bot endpoint.
    console.error(`[music] non-JSON dari ${url} — status ${res.status}, cuplikan: ${text.slice(0, 300)}`);
    throw new Error(`Sumber musik mengembalikan respons tidak valid (status ${res.status}).`);
  }
  if (!res.ok || data?.status === false) {
    throw new Error(data?.message || "Lagu tidak ditemukan.");
  }
  return data;
}

// ---------- util ----------
const clip = (v, n) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, n) : "");

function httpsOrNull(v) {
  try {
    const u = new URL(String(v || ""));
    return u.protocol === "https:" ? u.href : null;
  } catch {
    return null;
  }
}

// Hanya URL dari situs sumber yang sesuai yang boleh diproses scraper.
const ALLOWED_HOSTS = {
  youtube: /^(www\.|m\.|music\.)?youtube\.com$|^youtu\.be$/i,
  spotify: /^open\.spotify\.com$/i,
  soundcloud: /^(www\.|m\.)?soundcloud\.com$|^on\.soundcloud\.com$/i,
};

export function isAllowedSourceUrl(source, value) {
  try {
    const u = new URL(String(value || ""));
    return u.protocol === "https:" && Boolean(ALLOWED_HOSTS[source]?.test(u.hostname));
  } catch {
    return false;
  }
}

// ---------- 1) PENCARIAN ----------
async function searchSpotify(query) {
  const data = await getJson(`https://api.nexray.eu.cc/search/spotify?q=${encodeURIComponent(query)}`);
  const list = (Array.isArray(data.result) ? data.result : []).filter((r) => r?.url && r?.title);
  if (!list.length) throw new Error("Lagu tidak ditemukan di Spotify.");

  return list.slice(0, MAX_RESULTS).map((r) => {
    const artist = clip(r.artist, 120) || null;
    const full = clip(r.title, 200);
    // Judul dari endpoint berbentuk "Artis - Judul"; di daftar cukup "Judul".
    const display =
      artist && full.toLowerCase().startsWith(`${artist.toLowerCase()} - `) ? full.slice(artist.length + 3) : full;
    return {
      title: display,
      artist,
      album: clip(r.album, 120) || null,
      duration: parseDurationToSeconds(r.duration),
      thumbnail: httpsOrNull(r.thumbnail),
      url: r.url,
      // Kata kunci untuk endpoint pengambil link: JUDUL dulu, baru artis ("Judul Artis"),
      // supaya pencarian tidak meleset (bukan "Artis - Judul" seperti dari endpoint pencarian).
      query: clip(artist ? `${display} ${artist}` : full, 250),
    };
  });
}

async function searchYouTube(query) {
  const list = await searchYouTubeVideos(query, MAX_RESULTS);
  return list.map((v) => ({
    title: clip(v.title, 200),
    artist: clip(v.author, 120) || null,
    album: null,
    duration: v.seconds || null,
    thumbnail: httpsOrNull(v.thumbnail),
    url: v.url,
    query: clip(v.title, 200),
  }));
}

async function searchSoundCloud(query) {
  const list = await searchSoundCloudTracks(query, MAX_RESULTS);
  return list.map((t) => ({
    title: clip(t.title, 200),
    artist: clip(t.author, 120) || null,
    album: null,
    duration: t.duration || null,
    thumbnail: httpsOrNull(t.thumbnail),
    url: t.url,
    query: [clip(t.title, 200), clip(t.author, 120)].filter(Boolean).join(" "),
  }));
}

export async function searchMusic(source, query) {
  const q = String(query || "").trim();
  const results =
    source === "spotify" ? await searchSpotify(q) : source === "soundcloud" ? await searchSoundCloud(q) : await searchYouTube(q);

  // Buang duplikat (URL sama) dan item tanpa judul.
  const seen = new Set();
  return results.filter((r) => {
    if (!r.title || !r.url || seen.has(r.url)) return false;
    seen.add(r.url);
    return true;
  });
}

// ---------- 2) PENGAMBILAN LINK (satu lagu yang dipilih) ----------
// Judul saja sering ambigu (banyak cover/remix dengan judul sama), jadi endpoint
// berbasis judul diberi "judul + artis/author". Kalau judul sudah memuat nama
// artisnya (mis. "Artis - Judul"), tidak ditambah lagi.
function withArtist(query, artist) {
  let q = (query || "").trim();
  const a = (artist || "").trim();
  if (!a) return q.slice(0, 250);
  // Format lama "Artis - Judul" (mis. riwayat / playlist yang tersimpan dari versi sebelumnya)
  // diubah jadi "Judul Artis": judul dulu, baru artis, supaya pencarian tidak gagal.
  const m = /^(.+?)\s+[-–]\s+(.+)$/.exec(q);
  if (m && a.toLowerCase().includes(m[1].trim().toLowerCase())) {
    return `${m[2].trim()} ${m[1].trim()}`.slice(0, 250);
  }
  if (q.toLowerCase().includes(a.toLowerCase())) return q.slice(0, 250);
  return `${q} ${a}`.slice(0, 250);
}

// Panjang lagu (detik) dari berbagai format endpoint: 299, "4:59", atau milidetik (299000).
function toSeconds(v) {
  if (typeof v === "number" && Number.isFinite(v) && v > 0) return Math.round(v > 10000 ? v / 1000 : v);
  if (typeof v === "string") return parseDurationToSeconds(v.trim()) || null;
  return null;
}

// Coba tiap sumber berurutan (utama -> cadangan); yang pertama berhasil dipakai.
async function firstSuccess(label, attempts, failMessage) {
  for (let i = 0; i < attempts.length; i++) {
    const [name, run] = attempts[i];
    try {
      return await run();
    } catch (err) {
      const next = attempts[i + 1]?.[0];
      console.error(`[music] ${label}: ${name} gagal${next ? `, coba ${next}` : ""}:`, err.message);
    }
  }
  throw new Error(failMessage);
}

async function resolveYouTube({ url, query, artist }) {
  const q = withArtist(query, artist);
  return firstSuccess(
    "YouTube",
    [
      // Utama: endpoint azbry (hanya judul).
      [
        "endpoint azbry",
        async () => {
          const data = await getJson(`https://api.azbry.com/api/download/ytplay2?q=${encodeURIComponent(q)}`);
          const r = data.result || {};
          if (!r.download) throw new Error("Endpoint YouTube tidak mengembalikan link audio.");
          return { streamUrl: r.download, title: r.title, artist: r.channel, thumbnail: r.thumbnail, duration: toSeconds(r.duration) };
        },
      ],
      // Cadangan 1: endpoint webapi "play" (hanya judul).
      [
        "endpoint webapi play",
        async () => {
          const data = await getJson(`https://webapi-fawn.vercel.app/download/play?q=${encodeURIComponent(q)}`);
          const r = data.data || {};
          const streamUrl = httpsOrNull(r.downloads?.find((d) => d?.type === "audio")?.url || r.downloads?.[0]?.url);
          if (!streamUrl) throw new Error("Endpoint webapi play tidak mengembalikan link audio.");
          return {
            streamUrl,
            title: r.title || r.video?.title,
            artist: r.video?.author,
            thumbnail: httpsOrNull(r.video?.thumbnail) || httpsOrNull(r.thumbnail),
            duration: toSeconds(r.video?.duration),
          };
        },
      ],
      // Cadangan 2: scraper Savetube (URL video yang dipilih).
      [
        "scraper Savetube",
        async () => {
          if (!url) throw new Error("URL video YouTube tidak tersedia untuk scraper.");
          const dl = await scrapeSavetube(url, "audio", "128");
          if (!dl?.downloadUrl) throw new Error("Scraper Savetube tidak mengembalikan link audio.");
          return { streamUrl: dl.downloadUrl, title: dl.title, thumbnail: dl.thumbnail };
        },
      ],
    ],
    "Semua sumber YouTube sedang bermasalah. Coba lagi sebentar lagi."
  );
}

async function resolveSpotify({ url, query, artist }) {
  const q = withArtist(query, artist);
  return firstSuccess(
    "Spotify",
    [
      // Utama: endpoint nexray spotifyplay (hanya judul).
      [
        "endpoint nexray",
        async () => {
          const data = await getJson(`https://api.nexray.eu.cc/downloader/spotifyplay?q=${encodeURIComponent(q)}`);
          const r = data.result || {};
          if (!r.download_url) throw new Error("Endpoint Spotify tidak mengembalikan link audio.");
          return {
            streamUrl: r.download_url,
            title: r.title,
            artist: r.artist,
            thumbnail: r.thumbnail,
            duration: toSeconds(r.duration ?? r.duration_ms ?? r.durationMs),
          };
        },
      ],
      // Cadangan 1: endpoint webapi "spotplay" (hanya judul).
      [
        "endpoint webapi spotplay",
        async () => {
          const data = await getJson(`https://webapi-fawn.vercel.app/download/spotplay?q=${encodeURIComponent(q)}`);
          const r = data.data || {};
          const streamUrl = httpsOrNull(r.downloads?.find((d) => d?.type === "audio")?.url || r.downloads?.[0]?.url);
          if (!streamUrl) throw new Error("Endpoint webapi spotplay tidak mengembalikan link audio.");
          return {
            streamUrl,
            title: r.title,
            artist: r.artist,
            thumbnail: httpsOrNull(r.search?.cover) || httpsOrNull(r.thumbnail),
            duration: toSeconds(r.duration) || toSeconds(r.search?.duration),
          };
        },
      ],
      // Cadangan 2: scraper spotimate.app (URL track yang dipilih).
      [
        "scraper Spotimate",
        async () => {
          if (!url) throw new Error("URL lagu Spotify tidak tersedia untuk scraper.");
          const r = await scrapeSpotimate(url);
          return { streamUrl: r.media[0].url, title: null, artist: r.author, thumbnail: r.thumbnail };
        },
      ],
    ],
    "Semua sumber Spotify sedang bermasalah. Coba lagi sebentar lagi."
  );
}

async function resolveSoundCloud({ url, query }) {
  // 1) Scraper langsung ke SoundCloud (link stream CDN bisa diputar langsung).
  const viaDirect = async () => {
    const r = await resolveSoundCloudUrl(url);
    return { streamUrl: r.streamUrl, title: r.title, artist: r.artist, thumbnail: r.thumbnail };
  };
  // 2) Klickaud (URL).
  const viaKlickaud = async () => {
    const scraped = await scrapeSoundCloudUrl(url);
    const streamUrl = scraped.media?.[0]?.url;
    if (!streamUrl) throw new Error("Scraper SoundCloud (Klickaud) tidak menemukan link stream.");
    return { streamUrl, title: scraped.title, thumbnail: scraped.thumbnail };
  };
  // 3) Endpoint faa (hanya judul): jaring pengaman terakhir.
  const viaEndpoint = async () => {
    const data = await getJson(`https://api-faa.my.id/faa/soundcloud-play?query=${encodeURIComponent(query)}`);
    const r = data.result || {};
    if (!r.download_url) throw new Error("Endpoint SoundCloud tidak mengembalikan link audio.");
    return { streamUrl: r.download_url, title: r.title, artist: r.user, thumbnail: r.thumbnail };
  };

  try {
    return await viaDirect();
  } catch (err) {
    console.error("[music] scraper langsung SoundCloud gagal, coba Klickaud:", err.message);
    try {
      return await viaKlickaud();
    } catch (err2) {
      console.error("[music] Klickaud gagal, pakai endpoint terakhir:", err2.message);
      return viaEndpoint();
    }
  }
}

export async function resolveMusic({ source, url, query, artist }) {
  const input = { url, query: clip(query, 250), artist: clip(artist, 120) };
  if (source === "spotify") return resolveSpotify(input);
  if (source === "soundcloud") return resolveSoundCloud(input);
  return resolveYouTube(input);
}
