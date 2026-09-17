import { NextResponse } from "next/server";
import { instagram } from "@/lib/scrapers/instagram";
import { tiktokDl } from "@/lib/scrapers/tiktok";
import { scrapePinterest } from "@/lib/scrapers/pinterest";
import { scrapeTwitter } from "@/lib/scrapers/twitter";
import { scrapeAppleMusic } from "@/lib/scrapers/applemusic";
import { scrapeSpotify } from "@/lib/scrapers/spotify";
import { scrapeYouTube } from "@/lib/scrapers/youtube";

export const runtime = "nodejs";

const UA =
  "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Mobile Safari/537.36";

async function getJson(url) {
  const res = await fetch(url, { headers: { "User-Agent": UA } });
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

  if (result.music_info?.url) {
    media.push({ type: "audio", label: "Audio latar", url: result.music_info.url });
  }

  return {
    title: result.title || null,
    author: result.author?.nickname || result.author?.fullname || null,
    thumbnail: result.cover || null,
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
        // 1) Coba scraper langsung (tikwm) dulu — tidak butuh API key.
        const tryScraper = async () => {
          const res = await tiktokDl(url);
          if (!res.status || !res.data?.length) {
            throw new Error("Scraper TikTok gagal memproses link ini.");
          }
          return normalizeTiktokScraperResult(res);
        };

        // 2) Kalau scraper gagal (tikwm down/berubah struktur), jatuh ke
        //    endpoint API azbry sebagai cadangan — logic lama tetap dipakai:
        //    coba endpoint video dulu, kalau ternyata post foto baru coba
        //    endpoint slide.
        const tryEndpoint = async () => {
          const isPhoto = /\/photo\//i.test(url);
          const tryVideo = async () => {
            const data = await getJson(`https://api.azbry.com/api/download/tiktokv2?url=${link}`);
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
            const data = await getJson(`https://api.azbry.com/api/download/tiktokslide?url=${link}`);
            const r = data.result || {};
            const images = (r.images || []).map((img, i) => ({
              type: "image",
              label: `Foto ${i + 1}`,
              url: img,
            }));
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

        const result = await tryScraper().catch((err) => {
          console.error("[tiktok] scraper gagal, pakai endpoint cadangan:", err.message);
          return tryEndpoint();
        });

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

      case "capcut": {
        const data = await getJson(`https://api.azbry.com/api/download/capcut?url=${link}`);
        const r = data.result || {};
        const labelMap = {
          hd_no_watermark: "Download HD (tanpa watermark)",
          no_watermark: "Download (tanpa watermark)",
          watermark: "Download (dengan watermark)",
        };
        const media = (r.medias || []).map((m) => ({
          type: "video",
          label: labelMap[m.quality] || m.quality,
          url: m.url,
        }));
        return NextResponse.json({
          status: true,
          platform,
          title: r.title,
          author: r.author,
          thumbnail: r.thumbnail,
          media,
        });
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
        const data = await getJson(`https://api.azbry.com/api/download/soundcloud?url=${link}`);
        const r = data.result || {};
        return NextResponse.json({
          status: true,
          platform,
          title: r.title,
          author: r.artist,
          thumbnail: r.thumbnail,
          media: r.download ? [{ type: "audio", label: "Download MP3", url: r.download }] : [],
        });
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
