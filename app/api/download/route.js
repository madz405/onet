import { NextResponse } from "next/server";
import { instagram } from "@/lib/scrapers/instagram";
import { tiktokDl } from "@/lib/scrapers/tiktok";
import { scrapePinterest } from "@/lib/scrapers/pinterest";
import { scrapeTwitter } from "@/lib/scrapers/twitter";
import { scrapeAppleMusic } from "@/lib/scrapers/applemusic";
import { scrapeSpotify } from "@/lib/scrapers/spotify";
import { scrapeYouTube } from "@/lib/scrapers/youtube";
import { scrapeDouyin } from "@/lib/scrapers/douyin";
import { scrapeSoundCloudUrl } from "@/lib/scrapers/soundcloudUrl";

export const runtime = "nodejs";
// Downloader TikTok sekarang bisa mencoba 3 API + scraper berurutan, jadi
// beri waktu lebih panjang supaya fallback terakhir tidak terpotong.
export const maxDuration = 60;

const UA =
  "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Mobile Safari/537.36";

async function getJson(url, timeoutMs) {
  const res = await fetch(url, {
    headers: { "User-Agent": UA },
    ...(timeoutMs ? { signal: AbortSignal.timeout(timeoutMs) } : {}),
  });
  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error("Endpoint sumber mengembalikan respons yang tidak valid.");
  }
  if (!res.ok || data?.status === false) {
    throw new Error(data?.message || "Endpoint sumber gagal memproses link ini.");
  }
  return data;
}

function fail(message, statusCode = 400) {
  return NextResponse.json({ status: false, message }, { status: statusCode });
}

// Meratakan hasil kaya dari lib/scrapers/tiktok.js jadi bentuk seragam
// { title, author, thumbnail, media } yang dipakai di seluruh app.
function formatBytes(bytes) {
  if (!bytes) return "";
  const mb = bytes / (1024 * 1024);
  return ` · ${mb.toFixed(1)} MB`;
}

function normalizeTiktokScraperResult(result) {
  const labelMap = {
    watermark: "Download (dengan watermark)",
    nowatermark: "Download (tanpa watermark)",
    nowatermark_hd: "Download HD (tanpa watermark)",
  };

  const media = (result.data || []).map((m, i) =>
    m.type === "photo"
      ? { type: "image", label: `Foto ${i + 1}`, url: m.url }
      : {
          type: "video",
          label: (labelMap[m.type] || "Download video") + formatBytes(m.size),
          url: m.url,
        }
  );

  // Catatan: hasil scraper (tikwm) sengaja TIDAK menyertakan audio latar,
  // karena link audionya tidak tersedia/tidak bisa diputar. Audio hanya
  // muncul kalau hasil datang dari endpoint API (lihat case "tiktok").

  return {
    title: result.title || null,
    author: result.author?.nickname || result.author?.fullname || null,
    thumbnail: result.cover || null,
    media,
  };
}

// Hasil endpoint API nexray dan faa punya bentuk mirip: "data" berisi string
// URL (video) atau array URL (slide foto), plus music_info.url untuk audio.
// Kalau ternyata data kosong, dilempar error supaya lanjut ke sumber berikutnya.
function pushTiktokAudio(media, r) {
  if (r.music_info?.url) media.push({ type: "audio", label: "Audio latar", url: r.music_info.url });
}

function normalizeNexrayTiktok(r) {
  const media = [];
  const photos = Array.isArray(r.data) ? r.data : Array.isArray(r.images) ? r.images : null;
  if (photos?.length) {
    photos.forEach((img, i) => media.push({ type: "image", label: `Foto ${i + 1}`, url: img }));
  } else if (typeof r.data === "string" && r.data) {
    media.push({ type: "video", label: "Download (tanpa watermark)", url: r.data });
  }
  if (!media.length) throw new Error("empty");
  pushTiktokAudio(media, r);
  return {
    title: r.title || null,
    author: r.author?.nickname || r.author?.fullname || null,
    thumbnail: r.cover || null,
    media,
  };
}

function normalizeFaaTiktok(r) {
  const media = [];
  if (Array.isArray(r.data)) {
    r.data.forEach((img, i) => media.push({ type: "image", label: `Foto ${i + 1}`, url: img }));
  } else {
    const hd = r.alternatives?.hd || r.data;
    const sd = r.alternatives?.sd;
    if (sd && sd !== hd) {
      media.push({ type: "video", label: "Download (tanpa watermark)", url: sd });
      media.push({ type: "video", label: "Download HD (tanpa watermark)", url: hd });
    } else if (hd) {
      media.push({ type: "video", label: "Download (tanpa watermark)", url: hd });
    }
  }
  if (!media.length) throw new Error("empty");
  pushTiktokAudio(media, r);
  return {
    title: r.title || null,
    author: r.author?.nickname || r.author?.username || null,
    thumbnail: r.cover || null,
    media,
  };
}

// Meratakan hasil kaya dari lib/scrapers/instagram.js (yang punya 2 kemungkinan
// bentuk: media.videos[] untuk reel/video, atau media.slides[] untuk carousel foto)
// menjadi bentuk seragam { title, author, thumbnail, media } yang dipakai di seluruh app.
function normalizeInstagramScraperResult(result) {
  const metadata = result?.metadata || {};
  const author = result?.author || {};
  const media = [];

  if (Array.isArray(result?.media?.videos) && result.media.videos.length) {
    result.media.videos.forEach((v, i) => {
      media.push({
        type: "video",
        label: result.media.videos.length > 1 ? `Download video ${i + 1}` : "Download video",
        url: v.url,
      });
    });
  } else if (Array.isArray(result?.media?.slides) && result.media.slides.length) {
    let photoIndex = 0;
    result.media.slides.forEach((slide) => {
      (slide.images || []).forEach((img) => {
        photoIndex += 1;
        media.push({ type: "image", label: `Download foto ${photoIndex}`, url: img.url });
      });
      (slide.videos || []).forEach((vid) => {
        media.push({ type: "video", label: "Download video", url: vid.url });
      });
    });
  }

  return {
    title: metadata.caption || null,
    author: author.username || null,
    thumbnail: result?.media?.thumbnail || author.profilePic || null,
    media,
  };
}

export async function POST(req) {
  let body;
  try {
    body = await req.json();
  } catch {
    return fail("Body permintaan tidak valid.");
  }

  const { platform, url, format } = body || {};
  if (!platform) return fail("Platform belum dipilih.");
  if (!url || typeof url !== "string" || !/^https?:\/\//i.test(url.trim())) {
    return fail("Masukkan link yang valid (harus diawali http:// atau https://).");
  }
  const link = encodeURIComponent(url.trim());

  try {
    switch (platform) {
      case "tiktok": {
        const API_TIMEOUT = 10000;

        // Urutan percobaan: azbry -> faa -> nexray -> scraper (tikwm).
        // Tiap sumber yang gagal/mengembalikan hasil kosong otomatis lanjut
        // ke sumber berikutnya.

        // 1) API azbry — coba endpoint video dulu, kalau ternyata post foto
        //    baru coba endpoint slide.
        const tryAzbry = async () => {
          const isPhoto = /\/photo\//i.test(url);
          const tryVideo = async () => {
            const data = await getJson(
              `https://api.azbry.com/api/download/tiktokv2?url=${link}`,
              API_TIMEOUT
            );
            const r = data.result || {};
            const downloads = (r.downloads || []).map((d) => ({
              type: d.type === "mp3" ? "audio" : "video",
              label: d.quality || d.type,
              url: d.url,
            }));
            if (!downloads.length) throw new Error("empty");
            return {
              title: r.title,
              author: r.author?.username,
              thumbnail: r.cover,
              media: downloads,
            };
          };
          const trySlide = async () => {
            const data = await getJson(
              `https://api.azbry.com/api/download/tiktokslide?url=${link}`,
              API_TIMEOUT
            );
            const r = data.result || {};
            const images = (r.images || []).map((img, i) => ({
              type: "image",
              label: `Foto ${i + 1}`,
              url: img,
            }));
            if (!images.length) throw new Error("empty");
            if (r.music) images.push({ type: "audio", label: "Audio latar", url: r.music });
            return {
              title: r.title,
              author: r.author,
              thumbnail: r.cover,
              media: images,
            };
          };
          return isPhoto ? await trySlide() : await tryVideo().catch(trySlide);
        };

        // 2) API faa — satu endpoint untuk video maupun slide.
        const tryFaa = async () => {
          const data = await getJson(`https://api-faa.my.id/faa/tiktok?url=${link}`, API_TIMEOUT);
          return normalizeFaaTiktok(data.result || {});
        };

        // 3) API nexray — satu endpoint untuk video maupun slide.
        const tryNexray = async () => {
          const data = await getJson(
            `https://api.nexray.eu.cc/downloader/tiktok?url=${link}`,
            API_TIMEOUT
          );
          return normalizeNexrayTiktok(data.result || {});
        };

        // 4) Scraper langsung (tikwm) — paling terakhir. Hasil scraper tidak
        //    punya audio, jadi pemutar audio dan tombol "Audio latar"
        //    otomatis tidak muncul.
        const tryScraper = async () => {
          const res = await tiktokDl(url);
          if (!res.status || !res.data?.length) {
            throw new Error("Scraper TikTok gagal memproses link ini.");
          }
          return normalizeTiktokScraperResult(res);
        };

        const attempts = [
          ["azbry", tryAzbry],
          ["faa", tryFaa],
          ["nexray", tryNexray],
          ["scraper", tryScraper],
        ];

        let result = null;
        for (const [name, run] of attempts) {
          try {
            result = await run();
            if (result?.media?.length) break;
            result = null;
          } catch (err) {
            console.error(`[tiktok] ${name} gagal:`, err.message);
          }
        }
        if (!result) {
          throw new Error("Semua sumber TikTok gagal memproses link ini. Coba lagi sebentar lagi.");
        }

        return NextResponse.json({ status: true, platform, ...result });
      }

      case "instagram": {
        // 1) Coba scraper langsung ke Instagram dulu (lebih cepat, tanpa
        //    tergantung API pihak ketiga). instagram.video() menangani
        //    reel/video, instagram.slide() menangani carousel/foto — coba
        //    video dulu, kalau memang bukan video baru coba slide.
        const tryScraper = async () => {
          let res = await instagram.video(url);
          if (!res.status) {
            res = await instagram.slide(url);
          }
          if (!res.status) {
            throw new Error(res.error || "Scraper Instagram gagal memproses link ini.");
          }
          return normalizeInstagramScraperResult(res.result);
        };

        // 2) Kalau scraper gagal (link diblokir, struktur halaman IG
        //    berubah, dll), baru jatuh ke endpoint API sebagai cadangan.
        const tryEndpoint = async () => {
          const data = await getJson(
            `https://api.termai.cc/api/downloader/instagram?url=${link}&key=Bell409`
          );
          const d = data.data || {};
          const ogTitle = d.userInfo?.raw?.ogTitle || "";
          const ogDesc = d.userInfo?.raw?.ogDesc || "";

          const usernameMatch = ogDesc.match(/-\s*(\S+)\s+pada\b/);
          const author = usernameMatch?.[1] || null;

          const captionMatch = ogTitle.match(/:\s*"([\s\S]*)"\s*$/);
          const title = d.title || captionMatch?.[1] || null;

          const contents = d.content || [];
          const media = contents.map((item, i) => ({
            type: item.type === "video" ? "video" : "image",
            label: item.type === "video" ? "Download video" : `Download foto ${i + 1}`,
            url: item.url,
          }));

          return {
            title,
            author,
            thumbnail: contents[0]?.thumbnail || d.userInfo?.profilePic || null,
            media,
          };
        };

        const result = await tryScraper().catch((err) => {
          console.error("[instagram] scraper gagal, pakai endpoint cadangan:", err.message);
          return tryEndpoint();
        });

        return NextResponse.json({ status: true, platform, ...result });
      }

      case "facebook": {
        const data = await getJson(`https://api.azbry.com/api/download/allinonev2?url=${link}`);
        const r = data.result || {};
        const media = (r.downloads || []).map((d) => ({
          type: /mp3/i.test(d.label) ? "audio" : /image/i.test(d.label) ? "image" : "video",
          label: d.label,
          url: d.url,
        }));
        return NextResponse.json({
          status: true,
          platform,
          title: r.title,
          author: r.owner,
          thumbnail: r.thumbnail,
          media,
        });
      }

      case "pinterest": {
        const tryScraper = async () => {
          const result = await scrapePinterest(url);
          if (!result.media?.length) throw new Error("Scraper Pinterest tidak menemukan media.");
          return result;
        };
        const tryEndpoint = async () => {
          const data = await getJson(`https://api.azbry.com/api/download/pinterest?url=${link}`);
          const r = data.result || {};
          const media = [];
          if (r.type === "video" && r.download) {
            media.push({ type: "video", label: "Download video", url: r.download });
          } else if (r.download) {
            media.push({ type: "image", label: "Download gambar", url: r.download });
          }
          return { title: r.title, author: r.user?.fullName, thumbnail: r.thumbnail, media };
        };
        const result = await tryScraper().catch((err) => {
          console.error("[pinterest] scraper gagal, pakai endpoint cadangan:", err.message);
          return tryEndpoint();
        });
        return NextResponse.json({ status: true, platform, ...result });
      }

      case "twitter": {
        const tryScraper = async () => {
          const result = await scrapeTwitter(url);
          if (!result.media?.length) throw new Error("Scraper Twitter/X tidak menemukan media.");
          return result;
        };
        const tryEndpoint = async () => {
          const data = await getJson(`https://api.azbry.com/api/download/x?url=${link}`);
          const r = data.result || {};
          const media = (r.media || []).map((m, i) => ({
            type: m.type?.startsWith("video") ? "video" : "image",
            label: m.type?.startsWith("video") ? "Download video" : `Download foto ${i + 1}`,
            url: m.url,
          }));
          return {
            title: r.title,
            author: r.author?.name,
            thumbnail: r.media?.[0]?.thumbnail || r.author?.profile_image,
            media,
          };
        };
        const result = await tryScraper().catch((err) => {
          console.error("[twitter] scraper gagal, pakai endpoint cadangan:", err.message);
          return tryEndpoint();
        });
        return NextResponse.json({ status: true, platform, ...result });
      }

      case "douyin": {
        // Douyin cuma pakai scraper langsung (belum ada endpoint API
        // cadangan yang stabil untuk platform ini di project ini).
        const result = await scrapeDouyin(url);
        if (!result.media?.length) {
          throw new Error("Scraper Douyin tidak menemukan media yang bisa diunduh.");
        }
        return NextResponse.json({ status: true, platform, ...result });
      }

      case "applemusic": {
        const tryScraper = async () => {
          const result = await scrapeAppleMusic(url);
          if (!result.media?.length) throw new Error("Scraper Apple Music tidak menemukan media.");
          return result;
        };
        const tryEndpoint = async () => {
          const data = await getJson(`https://api.azbry.com/api/download/applemusic?url=${link}`);
          const r = data.result || {};
          return {
            title: r.title,
            author: r.artist,
            thumbnail: null,
            media: r.download ? [{ type: "audio", label: "Download MP3", url: r.download }] : [],
          };
        };
        const result = await tryScraper().catch((err) => {
          console.error("[applemusic] scraper gagal, pakai endpoint cadangan:", err.message);
          return tryEndpoint();
        });
        return NextResponse.json({ status: true, platform, ...result });
      }

      case "soundcloud": {
        const tryScraper = async () => {
          const result = await scrapeSoundCloudUrl(url);
          if (!result.media?.length) throw new Error("Scraper SoundCloud tidak menemukan media.");
          return result;
        };
        const tryEndpoint = async () => {
          const data = await getJson(`https://api.azbry.com/api/download/soundcloud?url=${link}`);
          const r = data.result || {};
          return {
            title: r.title,
            author: r.artist,
            thumbnail: r.thumbnail,
            media: r.download ? [{ type: "audio", label: "Download MP3", url: r.download }] : [],
          };
        };
        const result = await tryScraper().catch((err) => {
          console.error("[soundcloud] scraper gagal, pakai endpoint cadangan:", err.message);
          return tryEndpoint();
        });
        return NextResponse.json({ status: true, platform, ...result });
      }

      case "spotify": {
        const tryScraper = async () => {
          const result = await scrapeSpotify(url);
          if (!result.media?.length) throw new Error("Scraper Spotify tidak menemukan media.");
          return result;
        };
        const tryEndpoint = async () => {
          // Catatan: respons endpoint ini tidak dibungkus field "result".
          const data = await getJson(`https://api.azbry.com/api/download/spotify?url=${link}`);
          return {
            title: data.title,
            author: data.author,
            thumbnail: data.cover,
            media: data.downloadLink
              ? [{ type: "audio", label: "Download MP3", url: data.downloadLink }]
              : [],
          };
        };
        const result = await tryScraper().catch((err) => {
          console.error("[spotify] scraper gagal, pakai endpoint cadangan:", err.message);
          return tryEndpoint();
        });
        return NextResponse.json({ status: true, platform, ...result });
      }

      case "youtube": {
        const wantAudio = format === "audio";
        const tryScraper = async () => {
          const result = await scrapeYouTube(url, format);
          if (!result.media?.length) throw new Error("Scraper YouTube tidak menghasilkan link.");
          return result;
        };
        const tryEndpoint = async () => {
          const endpoint = wantAudio
            ? `https://api.azbry.com/api/download/ytmp3?url=${link}`
            : `https://api.azbry.com/api/download/ytmp4?url=${link}`;
          const data = await getJson(endpoint);
          const r = data.result || {};
          return {
            title: r.title,
            author: r.author || r.channel,
            thumbnail: r.thumbnail,
            media: r.download
              ? [
                  {
                    type: wantAudio ? "audio" : "video",
                    label: wantAudio ? "Download MP3" : `Download MP4 ${r.quality || ""}`.trim(),
                    url: r.download,
                  },
                ]
              : [],
          };
        };
        const result = await tryScraper().catch((err) => {
          console.error("[youtube] scraper gagal, pakai endpoint cadangan:", err.message);
          return tryEndpoint();
        });
        return NextResponse.json({ status: true, platform, ...result });
      }

      default:
        return fail("Platform tidak dikenali.");
    }
  } catch (err) {
    return fail(err.message || "Terjadi kesalahan saat memproses link.");
  }
}
