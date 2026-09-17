import { CHROME_UA } from "./scraperUtils.js";

function isSiteAsset(u) {
  return (
    u.includes("d53b014d86a6b6761bf649a0ed813c2b") ||
    u.includes("/avatars/") ||
    u.includes("/profile/") ||
    u.includes("sprite") ||
    u.includes("placeholder")
  );
}

export async function scrapePinterest(url) {
  let targetUrl = url;

  // Link pendek pin.it perlu di-expand dulu ke URL pin aslinya.
  if (targetUrl.includes("pin.it")) {
    try {
      const expandRes = await fetch(targetUrl, {
        headers: { "User-Agent": CHROME_UA },
        redirect: "follow",
        signal: AbortSignal.timeout(10000),
      });
      const html = await expandRes.text();
      const canonical = html.match(/<link[^>]+rel="canonical"[^>]+href="([^"]+)"/i);
      targetUrl = canonical?.[1] || expandRes.url || targetUrl;
    } catch {
      // biarkan pakai link pendeknya kalau expand gagal
    }
  }

  const res = await fetch(targetUrl, {
    headers: {
      "User-Agent": CHROME_UA,
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.5",
    },
    signal: AbortSignal.timeout(15000),
  });
  const html = await res.text();

  const titleMatch =
    html.match(/<meta[^>]+property="og:title"[^>]+content="([^"]+)"/i) ||
    html.match(/<meta[^>]+content="([^"]+)"[^>]+property="og:title"/i);
  const title = titleMatch?.[1] ? titleMatch[1].replace(/ \| Pinterest$/i, "").trim() : null;

  const videoMatches =
    html.match(/https:\/\/(?:v1\.pinimg\.com|7\.pinimg\.com|v\.pinimg\.com)\/[^"'\s]+\.mp4/gi) ||
    html.match(/https:\/\/[^"'\s]+\.mp4[^\s"']*/gi) ||
    [];

  let imageMatches =
    html.match(/https:\/\/i\.pinimg\.com\/originals\/[a-zA-Z0-9/._-]+\.(?:jpg|jpeg|png|webp)/gi) || [];
  if (imageMatches.length === 0) {
    imageMatches = html.match(/https:\/\/i\.pinimg\.com\/736x\/[a-zA-Z0-9/._-]+\.(?:jpg|jpeg|png|webp)/gi) || [];
  }

  const videos = [...new Set(videoMatches)];
  const images = [...new Set(imageMatches.filter((u) => !isSiteAsset(u)))];

  if (!videos.length && !images.length) {
    throw new Error("Scraper Pinterest tidak menemukan media di link ini.");
  }

  const media = [
    ...videos.map((u, i) => ({
      type: "video",
      label: videos.length > 1 ? `Download video ${i + 1}` : "Download video",
      url: u,
    })),
    ...images.map((u, i) => ({
      type: "image",
      label: images.length > 1 ? `Download gambar ${i + 1}` : "Download gambar",
      url: u,
    })),
  ];

  return {
    title,
    author: null,
    thumbnail: images[0] || videos[0] || null,
    media,
  };
}
