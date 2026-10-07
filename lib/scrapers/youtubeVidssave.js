// Scraper YouTube via Vidssave (id.vidssave.com).
//
// HARGAI WOY JANGAN DIHAPUS!
// Skrep by *JH a.k.a DHIKA - FIONY BOT*
// Credits to all Fiony's Bot Admin.
//
// Diadaptasi untuk project ini: pakai fetch bawaan Node (tanpa axios) dan
// node:crypto (tanpa crypto-js), jadi tidak perlu install package baru.
//
// Alur: parse (ambil daftar resource) -> download (minta task) -> polling
// SSE download_query sampai dapat download_link.

import { createDecipheriv } from "node:crypto";
import { CHROME_UA } from "./scraperUtils.js";

const API_BASE = "https://api.vidssave.com";
const HOST = "id.vidssave.com";
const DOMAIN = "api-ak.vidssave.com";

const HEADERS = {
  "Content-Type": "application/x-www-form-urlencoded",
  Origin: `https://${HOST}`,
  Referer: `https://${HOST}/`,
  "User-Agent": CHROME_UA,
};

// AES-256-CBC: key 32 karakter, IV = 16 karakter pertama key, padding nol.
const AES_STR = "4c9b7d2e".repeat(3).concat("4c9b7d21");
const AES_KEY = Buffer.from(AES_STR, "utf8");
const AES_IV = Buffer.from(AES_STR.substring(0, 16), "utf8");

export function decryptData(b64) {
  const decipher = createDecipheriv("aes-256-cbc", AES_KEY, AES_IV);
  decipher.setAutoPadding(false); // padding nol dibuang manual di bawah
  const raw = Buffer.concat([decipher.update(Buffer.from(b64, "base64")), decipher.final()]);
  const text = raw.toString("utf8").replace(/\0+$/, "");
  return JSON.parse(text);
}

async function postApi(path, auth, extraBody) {
  const payload = new URLSearchParams({ hostname: HOST, auth, domain: DOMAIN, ...extraBody });
  const res = await fetch(`${API_BASE}/api/contentsite_api/media/${path}`, {
    method: "POST",
    headers: HEADERS,
    body: payload.toString(),
    signal: AbortSignal.timeout(12000),
  });
  const data = await res.json().catch(() => null);
  if (!data) throw new Error("Respons Vidssave tidak valid.");
  if (data.status !== 1) throw new Error(data.msg || `Vidssave gagal di tahap ${path}.`);
  return decryptData(data.data);
}

// Minta task download lalu polling sampai link siap. Dibatasi ~24 detik
// supaya tidak menghabiskan waktu function (maxDuration route = 60 detik).
const POLL_ATTEMPTS = 12;
const POLL_INTERVAL_MS = 2000;

async function resolveDownloadLink(resourceContent) {
  try {
    const { task_id } = await postApi("download", "4c9b7d21", { request: resourceContent });
    if (!task_id) return null;

    const sseUrl =
      `${API_BASE}/sse/contentsite_api/media/download_query` +
      `?auth=20250901majwlqo&domain=${DOMAIN}&task_id=${encodeURIComponent(task_id)}` +
      `&download_domain=vidssave.com&origin=content_site`;

    for (let i = 0; i < POLL_ATTEMPTS; i++) {
      await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
      try {
        const res = await fetch(sseUrl, {
          headers: { ...HEADERS, Accept: "text/event-stream" },
          signal: AbortSignal.timeout(10000),
        });
        const text = await res.text();
        for (const line of text.split("\n")) {
          if (!line.startsWith("data:")) continue;
          const payload = JSON.parse(line.slice(5).trim());
          if (payload.download_link) return payload.download_link;
        }
      } catch {
        // belum siap / koneksi putus, coba lagi di putaran berikutnya
      }
    }
  } catch (err) {
    console.error("[vidssave] resolve link gagal:", err.message);
  }
  return null;
}

function sizeLabel(bytes) {
  const n = Number(bytes);
  return n ? ` · ${(n / (1024 * 1024)).toFixed(1)} MB` : "";
}

const qualityNum = (r) => parseInt(r.quality, 10) || 0;

export async function scrapeYouTubeVidssave(url, format) {
  const info = await postApi("parse", "4c9b7d21", { origin: "source", link: url });
  if (!info?.resources?.length) throw new Error("Vidssave tidak menemukan resource video/audio.");

  const wantAudio = format === "audio";
  let picked;

  if (wantAudio) {
    // Satu opsi saja: audio dengan kualitas tertinggi.
    const audios = info.resources
      .filter((r) => r.type === "audio" && r.resource_content)
      .sort((a, b) => qualityNum(b) - qualityNum(a));
    picked = audios.slice(0, 1);
  } else {
    // Maksimal 3 kualitas MP4 berbeda, diutamakan yang <= 1080p supaya
    // ukuran file & waktu konversi masuk akal.
    const mp4 = info.resources
      .filter((r) => r.type === "video" && (r.format || "").toUpperCase() === "MP4" && r.resource_content)
      .sort((a, b) => qualityNum(b) - qualityNum(a));
    const seen = new Set();
    const unique = mp4.filter((r) => (seen.has(r.quality) ? false : seen.add(r.quality)));
    const sane = unique.filter((r) => qualityNum(r) <= 1080);
    picked = (sane.length ? sane : unique).slice(0, 3);
  }

  if (!picked.length) {
    throw new Error(`Vidssave tidak punya opsi ${wantAudio ? "audio" : "video MP4"} untuk link ini.`);
  }

  const resolved = await Promise.all(
    picked.map(async (r) => {
      const link = await resolveDownloadLink(r.resource_content);
      return link ? { r, link } : null;
    })
  );

  const media = resolved.filter(Boolean).map(({ r, link }) =>
    wantAudio
      ? {
          type: "audio",
          label: `Download Audio ${(r.format || "MP3").toUpperCase()}${sizeLabel(r.size)}`,
          url: link,
        }
      : {
          type: "video",
          label: `Download MP4 ${r.quality || ""}${sizeLabel(r.size)}`.trim(),
          url: link,
        }
  );

  if (!media.length) throw new Error("Vidssave belum selesai memproses file (link belum siap).");

  return {
    title: info.title || null,
    author: null,
    thumbnail: info.thumbnail || `https://i.ytimg.com/vi/${info.id || ""}/hqdefault.jpg`,
    media,
  };
}
