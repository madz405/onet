import { NextResponse } from "next/server";
import { searchSoundCloud } from "@/lib/scrapers/soundcloud";
import { scrapeSoundCloudUrl, resolveSoundCloudFromQuery } from "@/lib/scrapers/soundcloudUrl";
import { searchYouTubeVideo } from "@/lib/scrapers/youtubeSearch";
import { scrapeSavetube } from "@/lib/scrapers/youtubeSavetube";

export const runtime = "nodejs";
export const maxDuration = 30;

const UA =
  "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Mobile Safari/537.36";

async function getJson(url) {
  const res = await fetch(url, {
    headers: {
      "User-Agent": UA,
      Accept: "application/json, text/plain, */*",
      // Beberapa endpoint API komunitas (termasuk api-faa.my.id) memfilter
      // request tanpa Referer yang wajar — tanpa ini kadang server langsung
      // balas halaman blokir/HTML, bukan JSON.
      Referer: new URL(url).origin + "/",
    },
  });
  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    // Log detail asli ke server (kelihatan di log Vercel) supaya penyebab
    // "respons tidak valid" ketahuan persis — biasanya karena server
    // (IP datacenter Vercel) diblokir/di-challenge oleh proteksi bot si
    // endpoint, sedangkan tes manual dari browser (IP rumah) lolos.
    console.error(
      `[music] non-JSON dari ${url} — status ${res.status}, cuplikan: ${text.slice(0, 300)}`
    );
    throw new Error(`Sumber musik mengembalikan respons tidak valid (status ${res.status}).`);
  }
  if (!res.ok || data?.status === false) {
    throw new Error(data?.message || "Lagu tidak ditemukan.");
  }
  return data;
}

export async function POST(req) {
  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ status: false, message: "Body tidak valid." }, { status: 400 });
  }

  const { source, query } = body || {};
  if (!query || !query.trim()) {
    return NextResponse.json({ status: false, message: "Judul lagu tidak boleh kosong." }, { status: 400 });
  }
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
    return NextResponse.json({ status: false, message: err.message || "Lagu tidak ditemukan." }, { status: 404 });
  }
}
