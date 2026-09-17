import { CHROME_UA, serializeData, stripHtml, textByClass, attrByClass } from "./scraperUtils.js";

function formatResolutionLabel(rawText, url = "") {
  const text = rawText || "";
  const urlMatch = url.match(/\/vid\/(\d+x\d+)\//i);
  if (urlMatch) return urlMatch[1].toLowerCase();
  const match = text.match(/(\d+\s*[xX]\s*\d+|\d+\s*p)/i);
  if (match) return match[1].replace(/\s+/g, "").toLowerCase();
  const clean = text.replace(/download|video|mp4|get|premium|for|\$|\d+\.\d+|:/gi, "").trim();
  return clean || "MP4";
}

function isPaywallOrInvalid(href, labelText) {
  if (!href || !href.startsWith("http")) return true;
  const lowerHref = href.toLowerCase();
  const lowerLabel = (labelText || "").toLowerCase();
  return (
    lowerHref.includes("checkout") ||
    lowerHref.includes("stripe") ||
    lowerHref.includes("buy") ||
    lowerHref.includes("premium") ||
    lowerLabel.includes("$") ||
    lowerLabel.includes("premium") ||
    lowerLabel.includes("paywall")
  );
}

// Cari baris tabel hasil (tanpa DOMParser): tiap <tr> yang mengandung tombol
// download, ambil label kualitas dari <td> pertama + href tombolnya.
function extractRows(html) {
  const rows = [];
  const rowRe = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  let rm;
  while ((rm = rowRe.exec(html)) !== null) {
    const rowHtml = rm[1];
    if (!rowHtml.includes("download__item__info__actions__button")) continue;
    const quality = stripHtml(rowHtml.match(/<td[^>]*>([\s\S]*?)<\/td>/i)?.[1] || "");
    const href =
      rowHtml.match(/download__item__info__actions__button[^>]*href="([^"]+)"/i)?.[1] ||
      rowHtml.match(/href="([^"]+)"[^>]*download__item__info__actions__button/i)?.[1];
    if (href) rows.push({ quality, href });
  }
  return rows;
}

function extractBtnLinks(html) {
  const out = [];
  const aRe = /<a\s+[^>]*class="[^"]*\bbtn\b[^"]*"[^>]*>([\s\S]*?)<\/a>/gi;
  let m;
  while ((m = aRe.exec(html)) !== null) {
    const href = m[0].match(/href="([^"]+)"/i)?.[1];
    if (href) out.push({ href, text: stripHtml(m[1]) });
  }
  return out;
}

export async function scrapeTwitter(url) {
  const cleanUrl = url
    .split("?")[0]
    .replace(/https:\/\/(fixupx|fxtwitter|vxtwitter|nitter|twitter)\.com/g, "https://x.com");

  const res = await fetch("https://tweeload.com/en/download", {
    method: "POST",
    body: serializeData({ url: cleanUrl }),
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": CHROME_UA,
    },
    signal: AbortSignal.timeout(15000),
  });
  const html = await res.text();

  let media = extractRows(html)
    .map((r) => {
      const href = r.href.startsWith("/") ? "https://tweeload.com" + r.href : r.href;
      if (isPaywallOrInvalid(href, r.quality)) return null;
      const label = formatResolutionLabel(r.quality, href);
      const isImg = /\.(jpe?g|png|webp)(\?|$)/i.test(href);
      return { type: isImg ? "image" : "video", label, url: href };
    })
    .filter(Boolean);

  if (!media.length) {
    media = extractBtnLinks(html)
      .filter(
        (a) =>
          (a.href.includes("downloads.acxcdn.com") || a.href.includes("twimg.com") || a.href.includes("tweeload")) &&
          a.text.toLowerCase() !== "download via the mobile app" &&
          !isPaywallOrInvalid(a.href, a.text)
      )
      .map((a) => {
        const label = formatResolutionLabel(a.text, a.href);
        const isImg = /\.(jpe?g|png|webp)(\?|$)/i.test(a.href);
        return { type: isImg ? "image" : "video", label, url: a.href };
      });
  }

  if (!media.length) {
    throw new Error("Scraper Twitter/X tidak menemukan link media.");
  }

  const name = textByClass(html, "download__item__info__user__name");
  const handle = textByClass(html, "download__item__info__user__handle");
  const thumbnail =
    attrByClass(html, "download__item__preview", "src") || attrByClass(html, "download__item", "src") || null;

  return {
    title: name ? `${name} (${handle || ""})`.trim() : null,
    author: handle,
    thumbnail,
    media,
  };
}
