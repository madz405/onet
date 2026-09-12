import { NextResponse } from "next/server";

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
        const result = isPhoto ? await trySlide() : await tryVideo().catch(trySlide);
        return NextResponse.json({ status: true, platform, ...result });
      }

      case "instagram": {
        const data = await getJson(
          `https://api.termai.cc/api/downloader/instagram?url=${link}&key=Bell409`
        );
        const d = data.data || {};
        const ogTitle = d.userInfo?.raw?.ogTitle || "";
        const ogDesc = d.userInfo?.raw?.ogDesc || "";

        // Username asli tersembunyi di dalam teks ogDesc, formatnya kira-kira:
        // "69K likes, 2,783 comments - namauser pada 6 September 2026: ...".
        const usernameMatch = ogDesc.match(/-\s*(\S+)\s+pada\b/);
        const author = usernameMatch?.[1] || null;

        // Kalau data.title kosong, captionnya masih ada di dalam ogTitle,
        // formatnya: 'namatampilan di Instagram: "isi caption di sini"'.
        const captionMatch = ogTitle.match(/:\s*"([\s\S]*)"\s*$/);
        const title = d.title || captionMatch?.[1] || null;

        const contents = d.content || [];
        const media = contents.map((item, i) => ({
          type: item.type === "video" ? "video" : "image",
          label: item.type === "video" ? "Download video" : `Download foto ${i + 1}`,
          url: item.url,
        }));

        return NextResponse.json({
          status: true,
          platform,
          title,
          author,
          thumbnail: contents[0]?.thumbnail || d.userInfo?.profilePic || null,
          media,
        });
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
        const data = await getJson(`https://api.azbry.com/api/download/pinterest?url=${link}`);
        const r = data.result || {};
        const media = [];
        if (r.type === "video" && r.download) {
          media.push({ type: "video", label: "Download video", url: r.download });
        } else if (r.download) {
          media.push({ type: "image", label: "Download gambar", url: r.download });
        }
        return NextResponse.json({
          status: true,
          platform,
          title: r.title,
          author: r.user?.fullName,
          thumbnail: r.thumbnail,
          media,
        });
      }

      case "twitter": {
        const data = await getJson(`https://api.azbry.com/api/download/x?url=${link}`);
        const r = data.result || {};
        const media = (r.media || []).map((m, i) => ({
          type: m.type?.startsWith("video") ? "video" : "image",
          label: m.type?.startsWith("video") ? "Download video" : `Download foto ${i + 1}`,
          url: m.url,
        }));
        return NextResponse.json({
          status: true,
          platform,
          title: r.title,
          author: r.author?.name,
          thumbnail: r.media?.[0]?.thumbnail || r.author?.profile_image,
          media,
        });
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
        const data = await getJson(`https://api.azbry.com/api/download/applemusic?url=${link}`);
        const r = data.result || {};
        return NextResponse.json({
          status: true,
          platform,
          title: r.title,
          author: r.artist,
          thumbnail: null,
          media: r.download ? [{ type: "audio", label: "Download MP3", url: r.download }] : [],
        });
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
        // Catatan: respons endpoint ini tidak dibungkus field "result".
        const data = await getJson(`https://api.azbry.com/api/download/spotify?url=${link}`);
        return NextResponse.json({
          status: true,
          platform,
          title: data.title,
          author: data.author,
          thumbnail: data.cover,
          media: data.downloadLink
            ? [{ type: "audio", label: "Download MP3", url: data.downloadLink }]
            : [],
        });
      }

      case "youtube": {
        const wantAudio = format === "audio";
        const endpoint = wantAudio
          ? `https://api.azbry.com/api/download/ytmp3?url=${link}`
          : `https://api.azbry.com/api/download/ytmp4?url=${link}`;
        const data = await getJson(endpoint);
        const r = data.result || {};
        return NextResponse.json({
          status: true,
          platform,
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
        });
      }

      default:
        return fail("Platform tidak dikenali.");
    }
  } catch (err) {
    return fail(err.message || "Terjadi kesalahan saat memproses link.");
  }
}
