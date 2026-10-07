// Scraper YouTube via Innertube dengan konteks client ANDROID_VR.
// Port dari scraper Go: satu POST ke youtubei/v1/player, lalu ambil direct
// link dari streamingData. Tanpa PoToken / JS runtime.
//
// Catatan penting:
// - Link googlevideo biasanya terikat ke IP yang meminta. Kalau link ini
//   dibuka dari browser user (IP beda dengan server), bisa kena 403.
// - Kalau YouTube memblokir IP server (bot check), scraper melempar error
//   dan route.js otomatis lanjut ke sumber cadangan.
// - Kalau suatu saat berhenti jalan, coba naikkan CLIENT_VERSION di bawah.

const CLIENT_VERSION = "1.56.21";
const CLIENT_UA = `com.google.android.apps.youtube.vr.oculus/${CLIENT_VERSION} (Linux; U; Android 12L; eureka-user Build/SQ3A.220605.009.A1) gzip`;
const ENDPOINT = "https://www.youtube.com/youtubei/v1/player?prettyPrint=false";
const ID_RE = /^[a-zA-Z0-9_-]{11}$/;

export function extractVideoId(input) {
  const clean = String(input || "").trim();
  if (ID_RE.test(clean)) return clean;

  let u;
  try {
    u = new URL(/^https?:\/\//i.test(clean) ? clean : `https://${clean}`);
  } catch {
    return null;
  }

  const host = u.hostname.replace(/^www\.|^m\.|^music\./, "");
  if (host === "youtu.be") {
    const id = u.pathname.slice(1).split("/")[0];
    return ID_RE.test(id) ? id : null;
  }

  const v = u.searchParams.get("v");
  if (v && ID_RE.test(v)) return v;

  const m = u.pathname.match(/^\/(?:embed|shorts|v|live|watch)\/([a-zA-Z0-9_-]{11})/);
  return m ? m[1] : null;
}

async function fetchPlayer(videoId) {
  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "User-Agent": CLIENT_UA,
      "X-YouTube-Client-Name": "28",
      "X-YouTube-Client-Version": CLIENT_VERSION,
      Origin: "https://www.youtube.com",
    },
    body: JSON.stringify({
      videoId,
      contentCheckOk: true,
      racyCheckOk: true,
      context: {
        client: {
          clientName: "ANDROID_VR",
          clientVersion: CLIENT_VERSION,
          deviceMake: "Oculus",
          deviceModel: "Quest 3",
          osName: "Android",
          osVersion: "12L",
          androidSdkVersion: 32,
          hl: "en",
          gl: "US",
        },
      },
    }),
    signal: AbortSignal.timeout(10000),
  });

  const data = await res.json().catch(() => null);
  if (!data) throw new Error("Respons YouTube tidak valid.");
  return data;
}

function formatBytes(n) {
  const bytes = Number(n);
  if (!bytes) return "";
  return ` · ${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function pickBestThumbnail(videoId, thumbs) {
  let best = null;
  let maxArea = 0;
  for (const t of thumbs || []) {
    const area = (t.width || 0) * (t.height || 0);
    if (t.url && area > maxArea) {
      maxArea = area;
      best = t.url;
    }
  }
  return best || `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
}

function pickAudio(adaptive) {
  const audios = adaptive.filter((f) => f.url && /^audio\//.test(f.mimeType || ""));
  if (!audios.length) return null;
  // Prioritas: itag 140 (m4a/AAC, paling kompatibel), lalu m4a lain, lalu sisanya.
  return (
    audios.find((f) => f.itag === 140) ||
    audios
      .filter((f) => /^audio\/mp4/.test(f.mimeType))
      .sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0))[0] ||
    audios.sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0))[0]
  );
}

function pickVideo(muxed) {
  // formats[] = video+audio sudah digabung (umumnya itag 18, 360p MP4).
  const list = muxed.filter((f) => f.url && /^video\//.test(f.mimeType || ""));
  if (!list.length) return null;
  return (
    list.find((f) => f.itag === 18) ||
    list.sort((a, b) => (b.height || 0) - (a.height || 0))[0]
  );
}

export async function scrapeYouTubeInnertube(url, format) {
  const videoId = extractVideoId(url);
  if (!videoId) throw new Error("URL YouTube tidak valid.");

  const data = await fetchPlayer(videoId);

  const status = data?.playabilityStatus?.status;
  if (status !== "OK") {
    const reason = data?.playabilityStatus?.reason || status || "tidak diketahui";
    throw new Error(`YouTube menolak permintaan: ${reason}`);
  }

  const details = data.videoDetails || {};
  const streaming = data.streamingData || {};
  const wantAudio = format === "audio";

  const media = [];
  if (wantAudio) {
    const a = pickAudio(streaming.adaptiveFormats || []);
    if (a) {
      const isM4a = /^audio\/mp4/.test(a.mimeType);
      media.push({
        type: "audio",
        label: `Download Audio ${isM4a ? "M4A" : "WebM"}${formatBytes(a.contentLength)}`,
        url: a.url,
      });
    }
  } else {
    const v = pickVideo(streaming.formats || []);
    if (v) {
      media.push({
        type: "video",
        label: `Download MP4 ${v.qualityLabel || ""}${formatBytes(v.contentLength)}`.trim(),
        url: v.url,
      });
    }
  }

  if (!media.length) {
    throw new Error("YouTube tidak mengembalikan link langsung untuk video ini.");
  }

  return {
    title: details.title || null,
    author: details.author || null,
    thumbnail: pickBestThumbnail(videoId, details.thumbnail?.thumbnails),
    media,
  };
}
