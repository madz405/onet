/***
  @ Base: https://www.klickaud.org/
  @ Note: Ambil link download audio dari URL track SoundCloud lewat alur
    resmi situs klickaud.org (ambil CSRF token -> submit URL -> kadang
    link download langsung tersedia, kadang harus nunggu proses lewat
    worker SSE). Diadaptasi dari versi axios ke fetch bawaan Node —
    bagian SSE-nya dibaca manual pakai Web Streams API (ReadableStream),
    karena fetch Node tidak punya event emitter seperti stream Node biasa.

    Dipakai untuk dua hal:
    - Downloader SoundCloud (input: URL track langsung dari user).
    - Player musik SoundCloud (input: judul lagu) — lewat resolveSoundCloudFromQuery
      di bawah, yang cari URL track paling relevan dulu via endpoint search
      nexray, baru linknya diproses scrapeSoundCloudUrl.
***/

import { parseDurationToSeconds } from "./scraperUtils.js";

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36";

function cleanTitle(raw) {
  return (raw || "")
    .replace(/_KLICKAUD\.mp3$/i, "")
    .replace(/_forhub_soundcloud_to_mp3\.mp3$/i, "")
    .replace(/\.mp3$/i, "")
    .replace(/_/g, " ")
    .trim();
}

function mergeCookies(jar, headers) {
  const raw =
    typeof headers.getSetCookie === "function"
      ? headers.getSetCookie()
      : (headers.get("set-cookie") || "").split(",").filter(Boolean);
  raw.forEach((c) => {
    const val = c.split(";")[0];
    if (val) jar.push(val);
  });
}

// Baca event-stream (SSE) dari worker Klickaud pakai reader Web Streams
// manual — versi axios asli pakai `responseType: "stream"` + event
// emitter Node, yang tidak ada di fetch bawaan.
async function readKlickaudSse(response, defaultFileName) {
  if (!response.body) throw new Error("Worker Klickaud tidak mengirim stream apa pun.");

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      if (buffer.includes("event: ready")) {
        const lines = buffer.split("\n");
        for (let i = 0; i < lines.length; i++) {
          if (lines[i].trim() === "event: ready" && lines[i + 1]?.startsWith("data:")) {
            try {
              const data = JSON.parse(lines[i + 1].replace("data:", "").trim());
              if (data.download_url) {
                const title = data.file_name ? cleanTitle(data.file_name) : cleanTitle(defaultFileName);
                return { title, url: data.download_url };
              }
            } catch {
              // data JSON di chunk ini mungkin belum lengkap, tunggu chunk berikutnya
            }
          }
        }
      }

      if (buffer.includes("event: failed")) {
        throw new Error("Worker Klickaud gagal memproses track ini.");
      }
    }
  } finally {
    try {
      reader.releaseLock();
    } catch {
      // abaikan, stream mungkin sudah selesai/di-abort
    }
  }

  throw new Error("Stream SSE Klickaud berhenti tanpa link download.");
}

// Ambil link download dari sebuah URL track SoundCloud.
export async function scrapeSoundCloudUrl(url) {
  if (!url || typeof url !== "string") throw new Error("Link SoundCloud tidak valid.");

  const cookieJar = [];
  const getCookieHeader = () => cookieJar.join("; ");

  // Step 1: ambil CSRF token.
  const tokenRes = await fetch("https://www.klickaud.org/csrf-token-endpoint.php", {
    headers: {
      "User-Agent": UA,
      Referer: "https://www.klickaud.org/en17/",
      Accept: "application/json",
    },
    signal: AbortSignal.timeout(10000),
  });
  mergeCookies(cookieJar, tokenRes.headers);
  const tokenData = await tokenRes.json().catch(() => null);
  const csrfToken = tokenData?.csrf_token;
  if (!csrfToken) throw new Error("Gagal mengambil CSRF token dari Klickaud.");

  // Step 2: submit URL track.
  const postRes = await fetch("https://www.klickaud.org/download.php", {
    method: "POST",
    headers: {
      "User-Agent": UA,
      Referer: "https://www.klickaud.org/en17/",
      Origin: "https://www.klickaud.org",
      "Content-Type": "application/x-www-form-urlencoded",
      Cookie: getCookieHeader(),
    },
    body: new URLSearchParams({ value: url, csrf_token: csrfToken }).toString(),
    signal: AbortSignal.timeout(15000),
  });
  mergeCookies(cookieJar, postRes.headers);
  const html = await postRes.text();

  const downloadMode = (html.match(/const\s+downloadMode\s*=\s*["']([^"']+)["']/) || [])[1];
  const directUrl = (html.match(/const\s+directDownloadUrl\s*=\s*["']([^"']*)["']/) || [])[1];
  const defaultFileName =
    (html.match(/const\s+defaultFileName\s*=\s*["']([^"']+)["']/) || [])[1] || "SoundCloud Track";
  const sseGrant = (html.match(/const\s+sseGrant\s*=\s*["']([^"']+)["']/) || [])[1];

  // Mode A: link download langsung tersedia, tanpa perlu nunggu worker.
  if (downloadMode === "direct" && directUrl) {
    return {
      title: cleanTitle(defaultFileName),
      author: null,
      thumbnail: null,
      media: [{ type: "audio", label: "MP3 (128kbps)", url: directUrl }],
    };
  }

  // Mode B: harus lewat proses worker (SSE) dulu.
  if (!sseGrant) throw new Error("Tidak menemukan sesi download (grant) dari Klickaud.");

  const capRes = await fetch("https://www.klickaud.org/sse_capability.php", {
    method: "POST",
    headers: {
      "User-Agent": UA,
      Referer: "https://www.klickaud.org/download.php",
      Origin: "https://www.klickaud.org",
      "Content-Type": "application/json",
      Cookie: getCookieHeader(),
    },
    body: JSON.stringify({ grant: sseGrant, url }),
    signal: AbortSignal.timeout(10000),
  });
  mergeCookies(cookieJar, capRes.headers);
  const capData = await capRes.json().catch(() => null);
  const capability = capData?.capability;
  if (!capability) throw new Error("Klickaud menolak otorisasi proses download.");

  const sseUrl = `https://www.klickaud.org/worker_sse.php?url=${encodeURIComponent(url)}&cap=${encodeURIComponent(
    capability
  )}`;
  const sseRes = await fetch(sseUrl, {
    headers: {
      "User-Agent": UA,
      Referer: "https://www.klickaud.org/download.php",
      Cookie: getCookieHeader(),
      Accept: "text/event-stream",
    },
    signal: AbortSignal.timeout(45000),
  });

  const { title, url: downloadUrl } = await readKlickaudSse(sseRes, defaultFileName);
  return {
    title,
    author: null,
    thumbnail: null,
    media: [{ type: "audio", label: "MP3 (128kbps)", url: downloadUrl }],
  };
}

// Cari judul lagu -> ambil URL track paling relevan (hasil teratas) lewat
// endpoint search SoundCloud milik user sendiri (api.nexray.eu.cc).
export async function resolveSoundCloudFromQuery(query) {
  const res = await fetch(`https://api.nexray.eu.cc/search/soundcloud?q=${encodeURIComponent(query)}`, {
    headers: { "User-Agent": UA, Accept: "application/json" },
    signal: AbortSignal.timeout(10000),
  });
  const data = await res.json().catch(() => null);
  const top = data?.result?.[0];
  if (!data?.status || !top?.url) {
    throw new Error("Pencarian SoundCloud tidak menemukan lagunya.");
  }

  return {
    url: top.url,
    title: top.title || null,
    author: top.author?.name || null,
    thumbnail: top.thumbnail || null,
    duration: parseDurationToSeconds(top.duration),
  };
}
