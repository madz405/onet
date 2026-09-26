/***
  @ Base: https://www.klickaud.org/
  @ Note: SoundCloud downloader lewat klickaud.org. Butuh URL track
    SoundCloud (bukan judul lagu) — makanya dipasangkan dengan endpoint
    pencarian nexray di app/api/music/route.js buat cari URL-nya dulu
    kalau yang ada cuma judul lagu.
    Diadaptasi dari axios+CommonJS ke fetch bawaan Node + ESM supaya
    konsisten dengan scraper lain di project ini.
***/

import { CHROME_UA, serializeData } from "./scraperUtils.js";

function cleanTitle(raw) {
  return (raw || "")
    .replace(/_KLICKAUD\.mp3$/i, "")
    .replace(/_forhub_soundcloud_to_mp3\.mp3$/i, "")
    .replace(/\.mp3$/i, "")
    .replace(/_/g, " ")
    .trim();
}

// Cookie jar sederhana: klickaud butuh cookie session yang sama dipakai
// terus dari step token → download → capability → sse.
function makeCookieJar() {
  const jar = {};
  return {
    merge(cookieStr) {
      if (!cookieStr) return;
      cookieStr.split(";").forEach((part) => {
        const [k, v] = part.trim().split("=");
        if (k && v) jar[k] = v;
      });
    },
    header() {
      return Object.entries(jar)
        .map(([k, v]) => `${k}=${v}`)
        .join("; ");
    },
  };
}

function mergeSetCookie(res, jar) {
  try {
    if (typeof res.headers.getSetCookie === "function") {
      res.headers.getSetCookie().forEach((c) => jar.merge(c.split(";")[0]));
      return;
    }
  } catch {
    // lanjut ke fallback di bawah
  }
  const single = res.headers.get("set-cookie");
  if (single) jar.merge(single.split(",")[0].split(";")[0]);
}

// Baca stream SSE dari worker klickaud sampai ketemu event "ready" (berisi
// download_url) atau event "failed". Versi web-stream dari loop
// response.data.on("data"/"end"/"error") di kode axios aslinya.
async function readSseDownloadUrl(sseUrl, headers) {
  const res = await fetch(sseUrl, { headers, signal: AbortSignal.timeout(45000) });
  if (!res.body) throw new Error("Tidak ada body SSE dari Klickaud.");

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      if (buffer.includes("event: ready")) {
        const lines = buffer.split("\n");
        for (let i = 0; i < lines.length; i++) {
          if (lines[i].trim() === "event: ready" && lines[i + 1]?.startsWith("data:")) {
            try {
              const data = JSON.parse(lines[i + 1].replace("data:", "").trim());
              if (data.download_url) {
                return { downloadUrl: data.download_url, fileName: data.file_name || null };
              }
            } catch {
              // lanjut nunggu potongan buffer berikutnya
            }
          }
        }
      }

      if (buffer.includes("event: failed")) {
        throw new Error("Worker Klickaud gagal memproses track ini.");
      }
    }
  } finally {
    reader.cancel().catch(() => {});
  }

  throw new Error("Stream SSE Klickaud berakhir tanpa link download.");
}

export async function scrapeSoundcloudLink(url) {
  if (!url || typeof url !== "string") throw new Error("Link SoundCloud tidak valid.");

  const jar = makeCookieJar();
  const baseHeaders = { "User-Agent": CHROME_UA, Referer: "https://www.klickaud.org/en17/" };

  // Step 1: ambil CSRF token.
  const tokenRes = await fetch("https://www.klickaud.org/csrf-token-endpoint.php", {
    headers: { ...baseHeaders, Accept: "application/json" },
    signal: AbortSignal.timeout(10000),
  });
  mergeSetCookie(tokenRes, jar);
  const tokenData = await tokenRes.json().catch(() => null);
  const csrfToken = tokenData?.csrf_token;
  if (!csrfToken) throw new Error("Gagal mengambil CSRF token dari Klickaud.");

  // Step 2: submit URL track.
  const postRes = await fetch("https://www.klickaud.org/download.php", {
    method: "POST",
    headers: {
      ...baseHeaders,
      "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
      Origin: "https://www.klickaud.org",
      Cookie: jar.header(),
    },
    body: serializeData({ value: url, csrf_token: csrfToken }),
    signal: AbortSignal.timeout(15000),
  });
  mergeSetCookie(postRes, jar);
  const html = await postRes.text();

  const downloadMode = (html.match(/const\s+downloadMode\s*=\s*["']([^"']+)["']/) || [])[1];
  const directUrl = (html.match(/const\s+directDownloadUrl\s*=\s*["']([^"']*)["']/) || [])[1];
  const defaultFileName =
    (html.match(/const\s+defaultFileName\s*=\s*["']([^"']+)["']/) || [])[1] || "SoundCloud Track";
  const sseGrant = (html.match(/const\s+sseGrant\s*=\s*["']([^"']+)["']/) || [])[1];

  // Mode A: link download sudah langsung tersedia.
  if (downloadMode === "direct" && directUrl) {
    return {
      title: cleanTitle(defaultFileName),
      author: null,
      thumbnail: null,
      media: [{ type: "audio", label: "MP3 (128kbps)", url: directUrl }],
    };
  }

  // Mode B: harus lewat worker SSE dulu.
  if (!sseGrant) throw new Error("Tidak mendapat sesi download (grant) dari Klickaud.");

  const capRes = await fetch("https://www.klickaud.org/sse_capability.php", {
    method: "POST",
    headers: {
      ...baseHeaders,
      "Content-Type": "application/json",
      Origin: "https://www.klickaud.org",
      Referer: "https://www.klickaud.org/download.php",
      Cookie: jar.header(),
    },
    body: JSON.stringify({ grant: sseGrant, url }),
    signal: AbortSignal.timeout(10000),
  });
  mergeSetCookie(capRes, jar);
  const capData = await capRes.json().catch(() => null);
  const capability = capData?.capability;
  if (!capability) throw new Error("Klickaud menolak otorisasi download (capability).");

  const sseUrl = `https://www.klickaud.org/worker_sse.php?url=${encodeURIComponent(
    url
  )}&cap=${encodeURIComponent(capability)}`;

  const { downloadUrl, fileName } = await readSseDownloadUrl(sseUrl, {
    ...baseHeaders,
    Referer: "https://www.klickaud.org/download.php",
    Cookie: jar.header(),
    Accept: "text/event-stream",
  });

  return {
    title: cleanTitle(fileName || defaultFileName),
    author: null,
    thumbnail: null,
    media: [{ type: "audio", label: "MP3 (128kbps)", url: downloadUrl }],
  };
}
