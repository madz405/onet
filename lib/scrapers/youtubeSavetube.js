// Scraper YouTube -> audio lewat API Savetube (dipakai y2mate.net.co).
// Alur: POST /v2/info (respons terenkripsi AES-128-CBC) -> dekripsi untuk dapat
// "key" -> POST /download dengan key itu -> dapat downloadUrl.
// Versi ini memakai fetch bawaan Node (tanpa axios) supaya tidak perlu
// dependensi tambahan.
import crypto from "crypto";

const CDN = "https://cdn403.savetube.vip";
const REQUEST_TIMEOUT_MS = 12000;

// Kunci dekripsi respons /v2/info. Di kode aslinya disembunyikan lewat
// obfuscation; hasil akhirnya sama dengan konstanta ini (32 karakter hex).
const SECRET_KEY_HEX = "C5D58EF67A7584E4A29F6C35BBC4EB12";

const HEADERS = {
  "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:153.0) Gecko/20100101 Firefox/153.0",
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

async function postJson(path, body) {
  const res = await fetch(`${CDN}${path}`, {
    method: "POST",
    headers: HEADERS,
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok || !data) {
    throw new Error(`Savetube ${path} gagal (HTTP ${res.status}).`);
  }
  return data;
}

/**
 * @param {string} youtubeUrl  link video YouTube
 * @param {"audio"|"video"} downloadType
 * @param {string} quality  audio: "320" | "256" | "128" | "64"
 */
export async function scrapeSavetube(youtubeUrl, downloadType = "audio", quality = "128") {
  const videoId = extractVideoId(youtubeUrl);
  if (!videoId) throw new Error("URL YouTube tidak valid.");

  const info = await postJson("/v2/info", { url: youtubeUrl });
  if (!info?.data) throw new Error("Savetube tidak mengembalikan data info.");

  let meta;
  try {
    meta = decryptData(info.data);
  } catch {
    throw new Error("Savetube: gagal mendekripsi data info (kunci mungkin sudah berganti).");
  }
  if (!meta?.key) throw new Error("Savetube: key unduhan tidak ditemukan.");

  const dl = await postJson("/download", { downloadType, quality, key: meta.key });
  const downloadUrl = dl?.data?.downloadUrl;
  if (!downloadUrl) throw new Error("Savetube tidak mengembalikan link unduhan.");

  return {
    title: meta.title || null,
    durationLabel: meta.durationLabel || null,
    thumbnail: meta.thumbnail || `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
    downloadUrl,
  };
}
