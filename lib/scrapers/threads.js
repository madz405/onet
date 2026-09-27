/***
  @ Base: https://threadster.app/
  @ Note: Ambil media (foto/video) dari sebuah post Threads lewat situs
    threadster.app. Versi aslinya pakai axios + cheerio; di sini diganti
    fetch bawaan Node + regex sederhana, karena project ini tidak punya
    dependency cheerio (samakan dengan gaya scraper lain di sini).
***/

import { CHROME_UA, getCookiesFromHeaders, serializeData } from "./scraperUtils.js";

function extractHrefs(html) {
  const hrefs = [];
  const re = /<a\b[^>]*href="([^"]+)"/gi;
  let m;
  while ((m = re.exec(html)) !== null) hrefs.push(m[1]);
  return hrefs;
}

// Link download-nya bawa query "token" ala JWT (header.payload.signature);
// payload-nya JSON base64url berisi URL media aslinya.
function decodeTokenUrl(href) {
  try {
    const urlObj = new URL(href);
    const token = urlObj.searchParams.get("token");
    if (!token) return null;
    const payloadPart = token.split(".")[1];
    if (!payloadPart) return null;

    let b64 = payloadPart.replace(/-/g, "+").replace(/_/g, "/");
    while (b64.length % 4) b64 += "=";
    const payload = JSON.parse(Buffer.from(b64, "base64").toString("utf-8"));
    return payload?.url || null;
  } catch {
    return null;
  }
}

function guessType(mediaUrl) {
  return /\.(jpg|jpeg|png|webp)(\?|$)/i.test(mediaUrl) ? "image" : "video";
}

export async function scrapeThreads(url) {
  if (!url || typeof url !== "string") throw new Error("Link Threads tidak valid.");

  const baseHeaders = {
    "User-Agent": CHROME_UA,
    Accept:
      "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
    Origin: "https://threadster.app",
    Referer: "https://threadster.app/",
  };

  // Step 1: buka halaman utama dulu buat dapat cookie sesi.
  const r1 = await fetch("https://threadster.app/", {
    headers: baseHeaders,
    signal: AbortSignal.timeout(15000),
  });
  const cookieStr = getCookiesFromHeaders(r1.headers);

  // Step 2: submit link Threads-nya.
  const r2 = await fetch("https://threadster.app/download", {
    method: "POST",
    headers: {
      ...baseHeaders,
      "Content-Type": "application/x-www-form-urlencoded",
      Cookie: cookieStr,
    },
    body: serializeData({ url }),
    signal: AbortSignal.timeout(20000),
  });
  const html = await r2.text();

  const hrefs = extractHrefs(html).filter((h) => h.includes("token=") || h.includes("acxcdn.com"));

  const rawItems = hrefs.map((href) => {
    const finalUrl = decodeTokenUrl(href) || href;
    return { type: guessType(finalUrl), url: finalUrl };
  });

  if (!rawItems.length) {
    throw new Error("Tidak menemukan link media (post mungkin privat atau linknya tidak valid).");
  }

  const imageCount = rawItems.filter((it) => it.type === "image").length;
  const videoCount = rawItems.filter((it) => it.type === "video").length;
  let imgIdx = 0;
  let vidIdx = 0;
  const media = rawItems.map((it) => {
    if (it.type === "image") {
      imgIdx++;
      return { ...it, label: imageCount > 1 ? `Foto ${imgIdx}` : "Foto" };
    }
    vidIdx++;
    return { ...it, label: videoCount > 1 ? `Video ${vidIdx}` : "Video" };
  });

  return {
    title: "Threads Media",
    author: null,
    thumbnail: media.find((m) => m.type === "image")?.url || null,
    media,
  };
}
