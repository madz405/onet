/***
  @ Base: https://www.iesdouyin.com/
  @ Note: Douyin video/foto downloader langsung ke situs resminya (tanpa
    API pihak ketiga). Diadaptasi dari versi axios ke fetch bawaan Node
    supaya konsisten dengan scraper lain di project ini (tidak perlu
    tambah dependency axios).
***/

import { getCookiesFromHeaders } from "./scraperUtils.js";

const MOBILE_UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 16_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.5 Mobile/15E148 Safari/604.1";
const DESKTOP_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

function extractCleanUrl(text) {
  if (!text || typeof text !== "string") return "";
  const match = text.match(/https?:\/\/[^\s]+/i);
  let clean = match ? match[0] : text.trim();
  if (!clean.startsWith("http://") && !clean.startsWith("https://")) {
    clean = "https://" + clean;
  }
  return clean;
}

function extractDouyinItemId(text) {
  if (!text || typeof text !== "string") return null;
  const match =
    text.match(/(?:video|note|share\/(?:video|slides))\b[\/?](\d{15,22})/i) ||
    text.match(/modal_id=(\d{15,22})/i) ||
    text.match(/group_id=(\d{15,22})/i) ||
    text.match(/aweme_id=(\d{15,22})/i) ||
    text.match(/\/(\d{18,20})\b/);
  return match ? match[1] : null;
}

// Parser brace-matching kecil buat motong objek JS/JSON dari tengah string
// <script>, tanpa regex greedy yang gampang salah kalau ada nested brace
// atau tanda kutip di dalam isinya.
function parseJSObject(slice) {
  let braceCount = 0,
    inStr = false,
    strChar = null,
    escape = false,
    endIdx = -1;
  for (let i = 0; i < slice.length; i++) {
    const c = slice[i];
    if (escape) {
      escape = false;
      continue;
    }
    if (c === "\\") {
      escape = true;
      continue;
    }
    if (inStr) {
      if (c === strChar) inStr = false;
      continue;
    }
    if (c === '"' || c === "'") {
      inStr = true;
      strChar = c;
      continue;
    }
    if (c === "{") braceCount++;
    else if (c === "}") {
      braceCount--;
      if (braceCount === 0) {
        endIdx = i + 1;
        break;
      }
    }
  }
  if (endIdx === -1) return null;
  try {
    return JSON.parse(slice.substring(0, endIdx));
  } catch {
    return null;
  }
}

// Douyin menaruh data halaman di beberapa kemungkinan variabel global
// (tergantung versi halaman yang di-serve), jadi dicoba satu-satu.
function extractRouterOrSSRData(htmlStr) {
  if (!htmlStr || typeof htmlStr !== "string") return null;

  const markers = [
    "window._ROUTER_DATA =",
    "window._SSR_DATA =",
    "window._RENDER_DATA =",
    "window.__INIT_PROPS__ =",
    "window.SSR_HYDRATED_DATA =",
  ];

  for (const marker of markers) {
    const startIdx = htmlStr.indexOf(marker);
    if (startIdx === -1) continue;

    let slice = htmlStr.slice(startIdx + marker.length).trim();
    if (slice.startsWith('"') && slice.includes("%7B")) {
      const matchStr = slice.match(/^"([^"]+)"/);
      if (matchStr) {
        try {
          slice = decodeURIComponent(matchStr[1]);
        } catch {
          // biarkan slice apa adanya kalau gagal decode
        }
      }
    } else if (slice.startsWith("%7B")) {
      try {
        slice = decodeURIComponent(slice);
      } catch {
        // biarkan slice apa adanya kalau gagal decode
      }
    }

    const data = parseJSObject(slice);
    if (data) return data;
  }

  const scriptMatches = htmlStr.matchAll(
    /<script[^>]*id="RENDER_DATA"[^>]*>([\s\S]*?)<\/script>/gi
  );
  for (const m of scriptMatches) {
    try {
      return JSON.parse(decodeURIComponent(m[1].trim()));
    } catch {
      // coba marker/script berikutnya kalau gagal parse
    }
  }

  return null;
}

// Fallback terakhir: panggil langsung API item info Douyin pakai item id
// yang sudah ketemu dari URL/HTML, plus cookie ttwid yang sudah terkumpul.
async function fetchDouyinApi(itemId, cookieHeader = "") {
  try {
    const apiUrl = `https://www.iesdouyin.com/web/api/v2/aweme/iteminfo/?item_ids=${itemId}`;
    const res = await fetch(apiUrl, {
      headers: {
        "User-Agent": MOBILE_UA,
        Referer: "https://www.iesdouyin.com/",
        Accept: "application/json",
        Cookie: cookieHeader,
      },
      signal: AbortSignal.timeout(10000),
    });
    const d = await res.json();
    if (d?.item_list?.length > 0) return d.item_list[0];
  } catch {
    // biarkan null, dianggap gagal di langkah ini
  }
  return null;
}

function getItemFromData(data) {
  if (!data) return null;

  const loaderData = data.loaderData || {};
  for (const key in loaderData) {
    const itemList = loaderData[key]?.videoInfoRes?.item_list;
    if (itemList?.length) return itemList[0];
  }

  if (data.aweme?.detail) return data.aweme.detail;
  if (data.item_list?.length) return data.item_list[0];
  if (data.aweme_detail) return data.aweme_detail;
  return null;
}

// Meratakan item mentah dari Douyin jadi bentuk seragam
// { title, author, thumbnail, media } yang dipakai di seluruh app.
function buildResult(item) {
  const title = item.desc || item.share_info?.share_desc || "Douyin Content";
  const author = item.author?.nickname || "Douyin User";
  const thumbnail =
    item.video?.cover?.url_list?.[0] || item.images?.[0]?.url_list?.[0] || null;
  const media = [];

  if (item.images?.length) {
    item.images.forEach((img, i) => {
      const imgUrl = img.url_list?.[0] || img.download_url_list?.[0];
      if (imgUrl) {
        media.push({
          type: "image",
          label: `Foto ${i + 1}`,
          url: imgUrl.replace(/^http:/, "https:"),
        });
      }
    });
  } else {
    let videoUrl =
      item.video?.play_addr?.url_list?.[0] || item.video?.download_addr?.url_list?.[0];

    if (videoUrl) {
      videoUrl = videoUrl.replace(/^http:/, "https:").replace("playwm", "play");

      let videoId = null;
      try {
        videoId = new URL(videoUrl).searchParams.get("video_id");
      } catch {
        // biarkan null, coba regex di bawah
      }
      if (!videoId) {
        const m = videoUrl.match(/video_id=([^&]+)/);
        if (m) videoId = m[1];
      }

      // Endpoint aweme.snssdk.com dengan video_id mentah biasanya sudah
      // tanpa watermark; kalau video_id tidak ketemu, jatuh balik ke
      // videoUrl apa adanya.
      const noWatermarkUrl = videoId
        ? `https://aweme.snssdk.com/aweme/v1/play/?video_id=${videoId}`
        : videoUrl;

      media.push({ type: "video", label: "Download HD (tanpa watermark)", url: noWatermarkUrl });
      media.push({ type: "video", label: "Download (standar)", url: videoUrl });
    }
  }

  // Kalau musik latarnya tersedia, sertakan sebagai audio — sama seperti
  // perlakuan "Audio latar" di downloader TikTok.
  const musicUrl = item.music?.play_url?.url_list?.[0] || item.music?.play_url?.uri || null;
  if (typeof musicUrl === "string" && musicUrl.startsWith("http")) {
    media.push({ type: "audio", label: "Audio latar", url: musicUrl.replace(/^http:/, "https:") });
  }

  return { title, author, thumbnail, media };
}

async function scrapeOnce(url) {
  if (!url || typeof url !== "string") throw new Error("Link tidak valid.");
  const cleanUrl = extractCleanUrl(url);

  // Cookie jar sederhana: Douyin butuh cookie ttwid (didapat dari langkah
  // redirect/request pertama) supaya halaman detail mau mengirim data SSR.
  const cookieJar = {};
  const mergeCookies = (cookieStr) => {
    if (!cookieStr) return;
    cookieStr.split(";").forEach((part) => {
      const [k, v] = part.trim().split("=");
      if (k && v) cookieJar[k] = v;
    });
  };
  const getCookieHeader = () =>
    Object.entries(cookieJar)
      .map(([k, v]) => `${k}=${v}`)
      .join("; ");

  let targetUrl = cleanUrl;
  let itemId = extractDouyinItemId(cleanUrl);

  // Step 1: ikuti redirect link pendek (v.douyin.com) sambil kumpulkan cookie.
  if (cleanUrl.includes("v.douyin.com")) {
    try {
      const r1 = await fetch(cleanUrl, {
        headers: {
          "User-Agent": MOBILE_UA,
          Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        },
        redirect: "manual",
        signal: AbortSignal.timeout(10000),
      });
      mergeCookies(getCookiesFromHeaders(r1.headers));
      const loc = r1.headers.get("location");
      if (loc) targetUrl = loc;
    } catch {
      // biarkan pakai cleanUrl kalau redirect gagal ditangkap
    }
  }

  if (!itemId) itemId = extractDouyinItemId(targetUrl);

  const slidesMatch = targetUrl.match(/share\/slides\/([0-9]{15,22})/i);
  if (slidesMatch?.[1]) {
    targetUrl = `https://www.iesdouyin.com/share/video/${slidesMatch[1]}/`;
    itemId = slidesMatch[1];
  }

  // Step 2: request halaman detail buat cari data SSR + nambah cookie.
  let htmlStr = "";
  try {
    const r2 = await fetch(targetUrl, {
      headers: {
        "User-Agent": MOBILE_UA,
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
        "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
        Cookie: getCookieHeader(),
      },
      signal: AbortSignal.timeout(15000),
    });
    mergeCookies(getCookiesFromHeaders(r2.headers));
    htmlStr = await r2.text();
  } catch {
    // lanjut ke langkah berikutnya walau request ini gagal
  }

  if (!itemId) itemId = extractDouyinItemId(targetUrl) || extractDouyinItemId(htmlStr);

  let parsedData = extractRouterOrSSRData(htmlStr);
  let item = getItemFromData(parsedData);

  // Step 3: ulangi request dengan cookie ttwid yang sudah didapat — kadang
  // data SSR baru muncul di percobaan kedua ini.
  if (!item) {
    try {
      const r3 = await fetch(targetUrl, {
        headers: {
          "User-Agent": MOBILE_UA,
          Accept:
            "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
          "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
          Cookie: getCookieHeader(),
          Referer: "https://www.douyin.com/",
        },
        signal: AbortSignal.timeout(15000),
      });
      mergeCookies(getCookiesFromHeaders(r3.headers));
      htmlStr = await r3.text();
      parsedData = extractRouterOrSSRData(htmlStr);
      item = getItemFromData(parsedData);
    } catch {
      // lanjut ke fallback API
    }
  }

  // Step 4: fallback ke API iteminfo langsung pakai item id + cookie.
  if (!item && itemId) {
    item = await fetchDouyinApi(itemId, getCookieHeader());
  }

  // Step 5: percobaan terakhir pakai User-Agent desktop (kadang versi
  // desktop me-render data SSR yang tidak muncul di versi mobile).
  if (!item) {
    try {
      const r4 = await fetch(targetUrl, {
        headers: {
          "User-Agent": DESKTOP_UA,
          Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
          Cookie: getCookieHeader(),
        },
        signal: AbortSignal.timeout(15000),
      });
      const fallbackHtml = await r4.text();
      item = getItemFromData(extractRouterOrSSRData(fallbackHtml));
    } catch {
      // tidak ada langkah lain, biarkan item tetap null
    }
  }

  if (!item) throw new Error("Tidak menemukan data video/foto di halaman Douyin.");

  return buildResult(item);
}

// Douyin kadang gagal di percobaan pertama (rate limit / cookie belum
// matang) — retry sekali sebelum menyerah, sama seperti pola scraper
// TikTok (tikwm) di project ini.
export async function scrapeDouyin(url) {
  try {
    return await scrapeOnce(url);
  } catch {
    await new Promise((r) => setTimeout(r, 400));
    return await scrapeOnce(url);
  }
}
