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
//   - YouTube    : endpoint azbry (judul) -> scraper Savetube (URL)
//   - Spotify    : endpoint nexray spotifyplay (judul) -> scraper Spotimate (URL)
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
      // Kata kunci untuk endpoint pengambil link (yang hanya menerima judul).
      query: full,
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
async function resolveYouTube({ url, query }) {
  // Utama: endpoint azbry (hanya judul).
  const viaEndpoint = async () => {
    const data = await getJson(`https://api.azbry.com/api/download/ytplay2?q=${encodeURIComponent(query)}`);
    const r = data.result || {};
    if (!r.download) throw new Error("Endpoint YouTube tidak mengembalikan link audio.");
    return { streamUrl: r.download, title: r.title, artist: r.channel, thumbnail: r.thumbnail };
  };
  // Cadangan: scraper Savetube (URL video yang dipilih).
  const viaScraper = async () => {
    const dl = await scrapeSavetube(url, "audio", "128");
    if (!dl?.downloadUrl) throw new Error("Scraper Savetube tidak mengembalikan link audio.");
    return { streamUrl: dl.downloadUrl, title: dl.title, thumbnail: dl.thumbnail };
  };

  try {
    return await viaEndpoint();
  } catch (err) {
    console.error("[music] endpoint YouTube gagal, pakai Savetube:", err.message);
    try {
      return await viaScraper();
    } catch (err2) {
      console.error("[music] Savetube gagal:", err2.message);
      throw new Error("Semua sumber YouTube sedang bermasalah. Coba lagi sebentar lagi.");
    }
  }
}

async function resolveSpotify({ url, query }) {
  // Utama: endpoint nexray spotifyplay (hanya judul).
  const viaEndpoint = async () => {
    const data = await getJson(`https://api.nexray.eu.cc/downloader/spotifyplay?q=${encodeURIComponent(query)}`);
    const r = data.result || {};
    if (!r.download_url) throw new Error("Endpoint Spotify tidak mengembalikan link audio.");
    return { streamUrl: r.download_url, title: r.title, artist: r.artist, thumbnail: r.thumbnail };
  };
  // Cadangan: scraper spotimate.app (URL track yang dipilih).
  const viaScraper = async () => {
    if (!url) throw new Error("URL lagu Spotify tidak tersedia untuk scraper.");
    const r = await scrapeSpotimate(url);
    return { streamUrl: r.media[0].url, title: null, artist: r.author, thumbnail: r.thumbnail };
  };

  try {
    return await viaEndpoint();
  } catch (err) {
    console.error("[music] endpoint Spotify gagal, pakai scraper Spotimate:", err.message);
    try {
      return await viaScraper();
    } catch (err2) {
      console.error("[music] scraper Spotimate gagal:", err2.message);
      throw new Error("Semua sumber Spotify sedang bermasalah. Coba lagi sebentar lagi.");
    }
  }
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

export async function resolveMusic({ source, url, query }) {
  const input = { url, query: clip(query, 250) };
  if (source === "spotify") return resolveSpotify(input);
  if (source === "soundcloud") return resolveSoundCloud(input);
  return resolveYouTube(input);
}
