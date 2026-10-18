import { NextResponse } from "next/server";
import { reportError } from "@/lib/reportError";
import { searchSoundCloud } from "@/lib/scrapers/soundcloud";
import { scrapeSoundCloudUrl, resolveSoundCloudFromQuery } from "@/lib/scrapers/soundcloudUrl";
import { searchYouTubeVideo } from "@/lib/scrapers/youtubeSearch";
import { scrapeSavetube } from "@/lib/scrapers/youtubeSavetube";
import { getJson, searchMusic, resolveMusic, isAllowedSourceUrl, MUSIC_SOURCES } from "@/lib/musicSearch";

export const runtime = "nodejs";
export const maxDuration = 30;

const UA =
  "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Mobile Safari/537.36";

// Jalur lama (cari + langsung putar hasil teratas). Masih dipakai pemutar saat
// link lagu di riwayat kedaluwarsa dan perlu diambil ulang (MusicPlayerProvider).
async function legacy(source, query) {
  const q = encodeURIComponent(query.trim());

  try {
    if (source === "spotify") {
      const data = await getJson(`https://api.nexray.eu.cc/downloader/spotifyplay?q=${q}`);
      const r = data.result || {};
      return NextResponse.json({
        status: true,
        source: "spotify",
        title: r.title,
        artist: r.artist,
        album: r.album,
        duration: r.duration,
        thumbnail: r.thumbnail,
        streamUrl: r.download_url,
      });
    }

    if (source === "soundcloud") {
      // 1) Prioritas utama: cari URL track paling relevan lewat endpoint
      //    search SoundCloud (nexray), lalu proses URL itu pakai scraper
      //    Klickaud buat dapat link stream-nya — scraper yang sama juga
      //    dipakai downloader SoundCloud.
      const tryPrimaryScraper = async () => {
        const hit = await resolveSoundCloudFromQuery(query.trim());
        const scraped = await scrapeSoundCloudUrl(hit.url);
        const streamUrl = scraped.media?.[0]?.url;
        if (!streamUrl) throw new Error("Scraper SoundCloud (Klickaud) tidak menemukan link stream.");
        return {
          status: true,
          source: "soundcloud",
          title: scraped.title || hit.title,
          artist: scraped.author || hit.author,
          duration: hit.duration,
          thumbnail: scraped.thumbnail || hit.thumbnail,
          streamUrl,
        };
      };

      // 2) Cadangan: scraper langsung ke SoundCloud (API v2 internal +
      //    client_id publik), kalau prioritas di atas gagal.
      const trySecondaryScraper = async () => {
        const r = await searchSoundCloud(query.trim());
        return {
          status: true,
          source: "soundcloud",
          title: r.title,
          artist: r.artist,
          duration: r.duration,
          thumbnail: r.thumbnail,
          streamUrl: r.streamUrl,
        };
      };

      // 3) Cadangan terakhir: endpoint faa (kadang diblokir firewall dari
      //    server, tapi tetap dicoba sebagai jaring pengaman paling akhir).
      const tryEndpoint = async () => {
        const data = await getJson(`https://api-faa.my.id/faa/soundcloud-play?query=${q}`);
        const r = data.result || {};
        return {
          status: true,
          source: "soundcloud",
          title: r.title,
          artist: r.user,
          // API ini mengembalikan durasi dalam milidetik, bukan detik.
          duration: typeof r.duration === "number" ? Math.round(r.duration / 1000) : null,
          thumbnail: r.thumbnail,
          streamUrl: r.download_url,
        };
      };

      // Urutan: scraper langsung ke SoundCloud dulu (link stream CDN-nya bisa
      // diputar langsung di browser), baru Klickaud, terakhir endpoint faa.
      const result = await trySecondaryScraper().catch((err) => {
        console.error("[music] scraper langsung SoundCloud gagal, coba Klickaud:", err.message);
        return tryPrimaryScraper().catch((err2) => {
          console.error("[music] scraper Klickaud gagal, pakai endpoint terakhir:", err2.message);
          return tryEndpoint();
        });
      });
      return NextResponse.json(result);
    }

    // default: youtube
    // 1) Utama: endpoint azbry (cari + link audio dalam satu panggilan).
    const tryYouTubeEndpoint = async () => {
      const data = await getJson(`https://api.azbry.com/api/download/ytplay2?q=${q}`);
      const r = data.result || {};
      if (!r.download) throw new Error("Endpoint YouTube tidak mengembalikan link audio.");
      return {
        status: true,
        source: "youtube",
        title: r.title,
        artist: r.channel,
        duration: null,
        thumbnail: r.thumbnail,
        streamUrl: r.download,
      };
    };

    // 2) Cadangan: cari URL video lewat yt-search, lalu ambil audio 128kbps
    //    lewat scraper Savetube.
    const tryYouTubeScraper = async () => {
      const hit = await searchYouTubeVideo(query.trim());
      const dl = await scrapeSavetube(hit.url, "audio", "128");
      return {
        status: true,
        source: "youtube",
        title: hit.title || dl.title,
        artist: hit.author,
        duration: hit.seconds,
        thumbnail: hit.thumbnail || dl.thumbnail,
        streamUrl: dl.downloadUrl,
      };
    };

    const result = await tryYouTubeEndpoint()
      .catch((err) => {
        console.error("[music] endpoint YouTube gagal, pakai yts + Savetube:", err.message);
        return tryYouTubeScraper();
      })
      .catch((err) => {
        console.error("[music] scraper YouTube (yts + Savetube) gagal:", err.message);
        throw new Error("Lagu tidak ditemukan atau semua sumber YouTube sedang bermasalah. Coba lagi sebentar lagi.");
      });
    return NextResponse.json(result);
  } catch (err) {
    await reportError(`musik: ${source || "youtube"}`, err, { judul: query });
    return NextResponse.json({ status: false, message: err.message || "Lagu tidak ditemukan." }, { status: 404 });
  }
}

function bad(message, status = 400) {
  return NextResponse.json({ status: false, message }, { status });
}

const clip = (v, n) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, n) : "");

export async function POST(req) {
  let body;
  try {
    body = await req.json();
  } catch {
    return bad("Body tidak valid.");
  }

  const { action } = body || {};
  const source = MUSIC_SOURCES.includes(body?.source) ? body.source : "youtube";

  // ---- Langkah 1: cari -> daftar hasil ----
  if (action === "search") {
    const query = clip(body?.query, 200);
    if (!query) return bad("Judul lagu tidak boleh kosong.");
    try {
      const results = await searchMusic(source, query);
      return NextResponse.json({ status: true, source, results });
    } catch (err) {
      await reportError(`musik cari: ${source}`, err, { judul: query });
      return bad(err.message || "Lagu tidak ditemukan.", 404);
    }
  }

  // ---- Langkah 2: ambil link stream untuk SATU lagu yang dipilih ----
  if (action === "resolve") {
    const url = typeof body?.url === "string" ? body.url.trim() : "";
    const query = clip(body?.query, 250);
    const artist = clip(body?.artist, 120);
    if (!query) return bad("Judul lagu tidak boleh kosong.");
    if (url && !isAllowedSourceUrl(source, url)) return bad("Link lagu tidak valid.");
    if (!url && source !== "spotify") return bad("Link lagu tidak valid.");
    try {
      const r = await resolveMusic({ source, url, query, artist });
      if (!r?.streamUrl) throw new Error("Link lagu tidak ditemukan.");
      return NextResponse.json({
        status: true,
        source,
        title: r.title || null,
        artist: r.artist || null,
        thumbnail: r.thumbnail || null,
        streamUrl: r.streamUrl,
        duration: Number.isFinite(r.duration) && r.duration > 0 ? r.duration : null,
      });
    } catch (err) {
      await reportError(`musik putar: ${source}`, err, { judul: query });
      return bad(err.message || "Gagal mengambil lagu.", 502);
    }
  }

  // ---- Jalur lama (tanpa action): cari + putar hasil teratas ----
  const query = body?.query;
  if (!query || !query.trim()) return bad("Judul lagu tidak boleh kosong.");
  return legacy(source, query);
}
