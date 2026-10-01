/***
  @ Base: https://rapidsave.com/
  @ Note: Unduh video Reddit (dengan audio) lewat situs rapidsave.com.
    Diadaptasi dari axios ke fetch bawaan Node supaya konsisten dengan
    scraper lain di project ini (tidak perlu tambah dependency axios).
  @ Format hasil: { title, author, thumbnail, media: [{ type, label, url }] }
***/

import { stripHtml } from "./scraperUtils.js";

const MOBILE_UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 16_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.5 Mobile/15E148 Safari/604.1";
const DESKTOP_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36";

function extractCleanUrl(text) {
  const match = String(text || "").match(/https?:\/\/[^\s]+/i);
  return match ? match[0] : String(text || "").trim();
}

// Link pendek (reddit.com/r/.../s/xxxx atau redd.it/xxxx) -> URL post lengkap.
// Redirect-nya dibaca manual (tanpa mengikuti), jadi halaman Reddit-nya
// sendiri tidak perlu diunduh.
async function resolveCanonicalUrl(url) {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": MOBILE_UA },
      redirect: "manual",
      signal: AbortSignal.timeout(10000),
    });
    const location = res.headers.get("location");
    if (location) return new URL(location, url).href;
  } catch {
    // lanjut pakai URL asli
  }
  return url;
}

export async function scrapeReddit(url) {
  if (!url || typeof url !== "string") throw new Error("Link Reddit tidak valid.");
  const cleanUrl = extractCleanUrl(url);
  if (!/(reddit\.com|redd\.it)/i.test(cleanUrl)) {
    throw new Error("Link ini bukan link Reddit.");
  }

  let targetUrl = cleanUrl;
  if (/\/s\/|redd\.it\//i.test(cleanUrl)) {
    targetUrl = await resolveCanonicalUrl(cleanUrl);
  }

  const res = await fetch(`https://rapidsave.com/info?url=${encodeURIComponent(targetUrl)}`, {
    headers: {
      "User-Agent": DESKTOP_UA,
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      Referer: "https://rapidsave.com/",
    },
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) {
    throw new Error(`Situs sumber (RapidSave) menolak permintaan (status ${res.status}).`);
  }
  const html = await res.text();

  const dlMatch =
    html.match(/class="downloadbutton"[^>]*href="([^"]+)"/i) ||
    html.match(/href="([^"]*sd\.rapidsave\.com\/download\.php[^"]*)"/i) ||
    html.match(/href="([^"]*download[^"]*)"/i);

  if (!dlMatch) {
    if (html.includes("alert-info") && html.includes("Reddit is limiting")) {
      throw new Error("Reddit sedang membatasi akses ke RapidSave. Coba lagi nanti.");
    }
    throw new Error("Tidak menemukan video di postingan ini (mungkin postingan tanpa video).");
  }

  let title = "Reddit Video";
  const titleMatch =
    html.match(/class="text-center">([^<]+)<\/p>/i) ||
    html.match(/<h2>([\s\S]*?)<\/h2>/i) ||
    html.match(/<strong>([\s\S]*?)<\/strong>/i);
  if (titleMatch && stripHtml(titleMatch[1])) {
    title = stripHtml(titleMatch[1]);
  } else {
    const slugMatch = targetUrl.match(/comments\/[^/]+\/([^/?#]+)/);
    if (slugMatch?.[1]) title = decodeURIComponent(slugMatch[1].replace(/_/g, " "));
  }

  const thumbMatch = html.match(/<img[^>]+src="([^">]*thumbs\.rapidsave\.com[^">]*)"/i);
  const thumbnail = thumbMatch ? thumbMatch[1].replace(/&amp;/g, "&") : null;

  const videoUrl = new URL(dlMatch[1].replace(/&amp;/g, "&"), "https://rapidsave.com").href;

  const media = [{ type: "video", label: "Download video (dengan audio)", url: videoUrl }];

  // Beberapa video Reddit menyimpan audio terpisah di parameter audio_url.
  try {
    const audioParam = new URL(videoUrl).searchParams.get("audio_url");
    if (audioParam && audioParam.startsWith("http")) {
      media.push({ type: "audio", label: "Download audio saja", url: audioParam });
    }
  } catch {
    // abaikan
  }

  return { title, author: null, thumbnail, media };
}
