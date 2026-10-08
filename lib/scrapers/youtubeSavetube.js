import crypto from "crypto";

// Daftar domain CDN Savetube untuk redundansi jika salah satu down
const CDNS = [
  "https://cdn.savetube.vip",
  "https://cdn1.savetube.vip",
  "https://cdn51.savetube.vip",
  "https://cdn403.savetube.vip"
];

const REQUEST_TIMEOUT_MS = 25000;
const SECRET_KEY_HEX = "C5D58EF67A7584E4A29F6C35BBC4EB12";

const HEADERS = {
  "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  accept: "application/json, text/plain, */*",
  "accept-language": "en-US,en;q=0.9",
  "content-type": "application/json",
  origin: "https://y2mate.net.co",
  referer: "https://y2mate.net.co/",
};

function extractVideoId(url) {
  return url.match(
    /(?:youtube\.com\/(?:[^/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/|youtube\.com\/shorts\/)([^"&?/\s]{11})/i
  )?.[1];
}

function decryptData(encryptedBase64) {
  const key = Buffer.from(SECRET_KEY_HEX, "hex");
  const buf = Buffer.from(String(encryptedBase64).replace(/\s/g, ""), "base64");
  const iv = buf.subarray(0, 16);
  const ciphertext = buf.subarray(16);
  const decipher = crypto.createDecipheriv("aes-128-cbc", key, iv);
  const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
  return JSON.parse(decrypted);
}

async function postJsonWithFallback(path, body) {
  let lastError;
  for (const cdn of CDNS) {
    try {
      const res = await fetch(`${cdn}${path}`, {
        method: "POST",
        headers: HEADERS,
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
      const data = await res.json().catch(() => null);
      if (res.ok && data) {
        return { data, activeCdn: cdn };
      }
    } catch (err) {
      lastError = err;
    }
  }
  throw new Error(`Semua server CDN Savetube gagal/timeout (${lastError?.message || 'Server down'})`);
}

/**
 * Scraper YouTube via Savetube API
 * @param {string} youtubeUrl Link video/Shorts YouTube
 * @param {"audio"|"video"} downloadType "audio" atau "video"
 * @param {string} quality Audio: "320" | "256" | "128" | "64" | Video: "1080" | "720" | "480" | "360"
 */
export async function scrapeSavetube(youtubeUrl, downloadType = "audio", quality = "128") {
  const videoId = extractVideoId(youtubeUrl);
  if (!videoId) throw new Error("URL YouTube tidak valid.");

  const { data: info, activeCdn } = await postJsonWithFallback("/v2/info", { url: youtubeUrl });
  if (!info?.data) throw new Error("Savetube tidak mengembalikan data info.");

  let meta;
  try {
    meta = decryptData(info.data);
  } catch {
    throw new Error("Savetube: gagal mendekripsi data info (kunci mungkin sudah berganti).");
  }
  if (!meta?.key) throw new Error("Savetube: key unduhan tidak ditemukan.");

  const resDl = await fetch(`${activeCdn}/download`, {
    method: "POST",
    headers: HEADERS,
    body: JSON.stringify({ downloadType, quality, key: meta.key }),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  const dl = await resDl.json().catch(() => null);
  
  const downloadUrl = dl?.data?.downloadUrl;
  if (!downloadUrl) throw new Error("Savetube tidak mengembalikan link unduhan.");

  return {
    title: meta.title || null,
    durationLabel: meta.durationLabel || null,
    thumbnail: meta.thumbnail || `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
    downloadUrl,
  };
}
