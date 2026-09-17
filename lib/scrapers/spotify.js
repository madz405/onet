import { CHROME_UA, getCookiesFromHeaders, serializeData, stripHtml, extractFormInputs } from "./scraperUtils.js";

const BASE = "https://spotidown.app";

async function readMaybeJsonHtml(res) {
  const text = await res.text();
  try {
    const json = JSON.parse(text);
    if (json?.error) throw new Error(json.message || "Spotidown mengembalikan error.");
    return json?.data ?? text;
  } catch {
    return text;
  }
}

export async function scrapeSpotify(url) {
  const r1 = await fetch(BASE + "/", {
    headers: { "User-Agent": CHROME_UA },
    signal: AbortSignal.timeout(10000),
  });
  const html1 = await r1.text();
  const cookies = getCookiesFromHeaders(r1.headers);

  const formInputs = extractFormInputs(html1, "spotifyurl") || {};
  const data1 = { ...formInputs, url, "g-recaptcha-response": "dummy_token" };

  const r2Headers = {
    "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
    "User-Agent": CHROME_UA,
    Origin: BASE,
    Referer: BASE + "/",
    "X-Requested-With": "XMLHttpRequest",
    Cookie: cookies,
  };

  const r2 = await fetch(BASE + "/action", {
    method: "POST",
    body: serializeData(data1),
    headers: r2Headers,
    signal: AbortSignal.timeout(15000),
  });
  let finalHtml = await readMaybeJsonHtml(r2);

  const form2 = extractFormInputs(finalHtml, "submitspurl");
  if (form2) {
    const data2 = { ...form2, "g-recaptcha-response": "dummy_token" };
    const r3 = await fetch(BASE + "/action/track", {
      method: "POST",
      body: serializeData(data2),
      headers: r2Headers,
      signal: AbortSignal.timeout(15000),
    });
    finalHtml = await readMaybeJsonHtml(r3);
  }

  const title = stripHtml(finalHtml.match(/<h3[^>]*>([^<]*)</i)?.[1] || "") || null;
  const artist = stripHtml(finalHtml.match(/<p[^>]*>([^<]*)</i)?.[1] || "") || null;
  const thumbnail = finalHtml.match(/<img[^>]+src="([^"]+)"/i)?.[1] || null;

  const media = [];
  const aRe = /<a\s+([^>]*)>([\s\S]*?)<\/a>/gi;
  let m;
  while ((m = aRe.exec(finalHtml)) !== null) {
    const href = m[1].match(/href="([^"]+)"/i)?.[1];
    const text = stripHtml(m[2]);
    if (!href || !href.startsWith("http")) continue;
    if (href.includes("premium.html") || text === "Download Another Song") continue;
    media.push({ type: "audio", label: text || "Download MP3", url: href });
  }

  if (!media.length) {
    throw new Error("Scraper Spotify tidak menemukan link download.");
  }

  return {
    title: artist ? `${artist} - ${title || ""}`.trim() : title,
    author: artist,
    thumbnail,
    media,
  };
}
