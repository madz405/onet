// Scraper YouTube cadangan (kedua): API content-service milik y2mate.rest.
// Alurnya: POST /api/v1/downloads untuk membuat job konversi, lalu cek status
// job tiap 2 detik sampai "ready". Polling dibatasi supaya function di Vercel
// tidak menggantung (route download punya batas 60 detik).
import { CHROME_UA } from "./scraperUtils.js";

const API = "https://content-service.opa-shan.workers.dev";
const POLL_INTERVAL_MS = 2000;
const MAX_WAIT_MS = 25000; // total waktu tunggu konversi
const REQUEST_TIMEOUT_MS = 10000;

const HEADERS = {
  "user-agent": CHROME_UA,
  "content-type": "application/json",
  accept: "*/*",
  origin: "https://www.y2mate.rest",
  referer: "https://www.y2mate.rest/",
  "accept-language": "id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7",
};

function extractVideoId(url) {
  return url.match(
    /(?:youtube\.com\/(?:[^/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/|youtube\.com\/shorts\/)([^"&?/\s]{11})/i
  )?.[1];
}

const isHttp = (v) => typeof v === "string" && /^https?:\/\//i.test(v);

// Bentuk respons job "ready" tidak terdokumentasi, jadi cari link unduhan
// dengan toleran: cek nama field yang lazim dulu, lalu telusuri seluruh objek
// (mengabaikan link thumbnail/gambar/status).
function findDownloadUrl(result) {
  const preferred = [
    "download_url", "downloadUrl", "download", "file_url", "fileUrl",
    "direct_url", "directUrl", "url", "link",
  ];
  for (const k of preferred) {
    if (isHttp(result?.[k])) return result[k];
  }
  const candidates = [];
  const walk = (value, key) => {
    if (isHttp(value)) {
      if (!/thumb|image|img|cover|poster|avatar|status|icon/i.test(key)) candidates.push([key, value]);
    } else if (Array.isArray(value)) {
      value.forEach((v) => walk(v, key));
    } else if (value && typeof value === "object") {
      Object.entries(value).forEach(([k, v]) => walk(v, k));
    }
  };
  walk(result, "");
  const best = candidates.find(([k]) => /download|file|direct|mp3|mp4|url|link/i.test(k)) || candidates[0];
  return best ? best[1] : null;
}

function findThumbnail(result, videoId) {
  for (const k of ["thumbnail", "thumbnail_url", "thumb", "image", "cover"]) {
    if (isHttp(result?.[k])) return result[k];
  }
  return `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
}

async function fetchJson(url, options) {
  const res = await fetch(url, { ...options, signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
  const data = await res.json().catch(() => null);
  return { res, data };
}

export async function scrapeYouTubeY2mate(url, format) {
  const videoId = extractVideoId(url);
  if (!videoId) throw new Error("URL YouTube tidak valid.");

  const wantAudio = format === "audio";
  const body = { url, format: wantAudio ? "mp3" : "720" };

  const { res: postRes, data: postData } = await fetchJson(`${API}/api/v1/downloads`, {
    method: "POST",
    headers: HEADERS,
    body: JSON.stringify(body),
  });

  if (!postData?.job_id) {
    const reason = postData?.message || postData?.error || `HTTP ${postRes.status}`;
    throw new Error(`Scraper y2mate gagal membuat job: ${reason}`);
  }

  const deadline = Date.now() + MAX_WAIT_MS;
  let result = null;

  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
    const { data } = await fetchJson(`${API}/api/v1/downloads/${postData.job_id}`, {
      method: "GET",
      headers: HEADERS,
    }).catch(() => ({ data: null }));
    if (!data) continue; // gangguan sesaat, coba lagi sampai batas waktu
    if (data.status === "ready") {
      result = data;
      break;
    }
    if (data.status === "failed" || data.status === "error") {
      throw new Error(`Scraper y2mate gagal mengonversi: ${data.message || data.error || data.status}`);
    }
  }

  if (!result) throw new Error("Scraper y2mate belum selesai konversi dalam batas waktu.");

  const dlUrl = findDownloadUrl(result);
  if (!dlUrl) {
    console.error("[youtube-y2mate] job ready tapi link tidak ditemukan. Field:", Object.keys(result).join(", "));
    throw new Error("Scraper y2mate tidak mengembalikan link unduhan.");
  }

  return {
    title: result.title || result.video_title || result.name || null,
    author: result.author || result.channel || null,
    thumbnail: findThumbnail(result, videoId),
    media: [
      {
        type: wantAudio ? "audio" : "video",
        label: wantAudio ? "Download MP3" : "Download MP4 720p",
        url: dlUrl,
      },
    ],
  };
}
