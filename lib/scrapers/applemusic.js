import { CHROME_UA, getCookiesFromHeaders, serializeData, stripHtml, extractFormInputs } from "./scraperUtils.js";

const BASE = "https://aplmate.com";

export async function scrapeAppleMusic(url) {
  const headers = {
    "User-Agent": CHROME_UA,
    Accept: "application/json, text/javascript, */*; q=0.01",
    "X-Requested-With": "XMLHttpRequest",
  };

  const r1 = await fetch(BASE + "/", {
    headers: { ...headers, Accept: "text/html" },
    signal: AbortSignal.timeout(10000),
  });
  const cookies = getCookiesFromHeaders(r1.headers);

  const r2 = await fetch(BASE + "/action/userverify", {
    method: "POST",
    body: serializeData({ url }),
    headers: {
      ...headers,
      "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
      Cookie: cookies,
    },
    signal: AbortSignal.timeout(15000),
  });
  const r2Data = await r2.json().catch(() => null);
  const token = r2Data?.success ? r2Data.token : null;
  if (!token) throw new Error(r2Data?.message || "Verifikasi aplmate gagal.");

  const r3 = await fetch(BASE + "/action", {
    method: "POST",
    body: serializeData({ url, "cf-turnstile-response": token }),
    headers: {
      ...headers,
      "Content-Type": "application/x-www-form-urlencoded",
      Cookie: cookies,
    },
    signal: AbortSignal.timeout(15000),
  });
  const r3Data = await r3.json().catch(() => null);
  if (!r3Data || r3Data.error) throw new Error(r3Data?.message || "Aksi aplmate gagal.");

  let finalHtml = r3Data.html || "";
  const formInputs = extractFormInputs(finalHtml, "submitapurl");

  if (formInputs) {
    const r4 = await fetch(BASE + "/action/track", {
      method: "POST",
      body: serializeData(formInputs),
      headers: {
        ...headers,
        "Content-Type": "application/x-www-form-urlencoded",
        Cookie: cookies,
      },
      signal: AbortSignal.timeout(15000),
    });
    const r4Text = await r4.text();
    let r4Data;
    try {
      r4Data = JSON.parse(r4Text);
    } catch {
      r4Data = null;
    }
    finalHtml = r4Data?.data || r4Data?.html || r4Text;
  }

  const title =
    stripHtml(finalHtml.match(/class="[^"]*\bhover-underline\b[^"]*"[^>]*>([^<]*)</i)?.[1] || "") ||
    stripHtml(finalHtml.match(/<h3[^>]*>([^<]*)</i)?.[1] || "") ||
    null;
  const artist = stripHtml(finalHtml.match(/<p[^>]*>([^<]*)</i)?.[1] || "") || null;
  const thumbnail = finalHtml.match(/<img[^>]+src="([^"]+)"/i)?.[1] || null;

  const media = [];
  const aRe = /<a\s+([^>]*)>([\s\S]*?)<\/a>/gi;
  let m;
  while ((m = aRe.exec(finalHtml)) !== null) {
    const attrs = m[1];
    const href = attrs.match(/href="([^"]+)"/i)?.[1];
    const text = stripHtml(m[2]);
    if (!href) continue;
    const isTrackLink = href.includes("/dl?token=") || /class="[^"]*\babutton\b[^"]*"/i.test(attrs);
    if (!isTrackLink) continue;
    if (href.includes("ko-fi.com") || href.includes("premium.html")) continue;
    if (text.toLowerCase().includes("another song")) continue;
    media.push({
      type: "audio",
      label: text || "Download MP3",
      url: href.startsWith("http") ? href : BASE + href,
    });
  }

  if (!media.length) {
    throw new Error("Scraper Apple Music tidak menemukan link download.");
  }

  return {
    title: artist ? `${artist} - ${title || ""}`.trim() : title,
    author: artist,
    thumbnail,
    media,
  };
}
