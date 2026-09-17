import { CHROME_UA } from "./scraperUtils.js";

function extractVideoId(url) {
  return url.match(
    /(?:youtube\.com\/(?:[^/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?/\s]{11})/i
  )?.[1];
}

async function getOembed(videoId) {
  let title = null;
  let thumbnail = `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
  try {
    const res = await fetch(
      `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`,
      { signal: AbortSignal.timeout(6000) }
    );
    if (res.ok) {
      const data = await res.json();
      title = data.title || title;
      thumbnail = data.thumbnail_url || thumbnail;
    }
  } catch {
    // biarkan pakai default di atas
  }
  return { title, thumbnail };
}

// Kode aslinya polling sampai 30 detik (15 x 2 detik) menunggu konversi
// selesai di server pihak ketiga — itu berisiko bikin function di Vercel
// kena timeout. Di sini dipangkas jauh lebih pendek: kalau belum selesai
// dalam waktu segini, scraper dianggap gagal dan route.js otomatis jatuh
// ke endpoint azbry yang sudah pasti cepat.
const POLL_ATTEMPTS = 4;
const POLL_INTERVAL_MS = 1200;

async function convertMobi(convertURL, videoId, format, headers) {
  const convRes = await fetch(`${convertURL}&v=${videoId}&f=${format}`, {
    headers,
    signal: AbortSignal.timeout(8000),
  });
  const convData = await convRes.json().catch(() => null);
  if (!convData || convData.error) return null;

  let dlUrl = convData.downloadURL;
  const progUrl = convData.progressURL;
  let progress = 0;

  for (let attempt = 0; attempt < POLL_ATTEMPTS && progress < 3; attempt++) {
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
    const progRes = await fetch(progUrl, { headers, signal: AbortSignal.timeout(6000) }).catch(() => null);
    const progData = await progRes?.json().catch(() => null);
    if (!progData || progData.error) break;
    progress = progData.progress;
    if (progData.downloadURL) dlUrl = progData.downloadURL;
    if (progress === 4) break;
  }

  if (dlUrl?.startsWith("//")) dlUrl = "https:" + dlUrl;
  if (dlUrl?.startsWith("/")) dlUrl = "https://ytmp3.mobi" + dlUrl;
  return dlUrl || null;
}

export async function scrapeYouTube(url, format) {
  const videoId = extractVideoId(url);
  if (!videoId) throw new Error("URL YouTube tidak valid.");

  const meta = await getOembed(videoId);

  const headers = {
    Origin: "https://ytmp3.mobi",
    Referer: "https://ytmp3.mobi/",
    "User-Agent": CHROME_UA,
  };

  const initRes = await fetch("https://a.ymcdn.org/api/v1/init?p=y&23=1llum1n471", {
    headers,
    signal: AbortSignal.timeout(8000),
  });
  const initData = await initRes.json().catch(() => null);
  if (!initData || initData.error || !initData.convertURL) {
    throw new Error("Inisialisasi scraper YouTube gagal.");
  }

  const wantFormat = format === "audio" ? "mp3" : "mp4";
  const dlUrl = await convertMobi(initData.convertURL, videoId, wantFormat, headers);

  if (!dlUrl) {
    throw new Error("Scraper YouTube belum selesai konversi, pakai endpoint cadangan.");
  }

  return {
    title: meta.title,
    author: null,
    thumbnail: meta.thumbnail,
    media: [
      {
        type: format === "audio" ? "audio" : "video",
        label: format === "audio" ? "Download MP3" : "Download MP4",
        url: dlUrl,
      },
    ],
  };
}
