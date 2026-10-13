// Scraper Spotify via spotimate.app — dipakai sebagai CADANGAN:
//   - halaman Downloader (lib/scrapers/spotify.js -> spotimate -> endpoint azbry)
//   - halaman Musik (endpoint nexray spotifyplay -> spotimate), lihat lib/musicSearch.js
//
// Disesuaikan dari skrip Termux (axios + cheerio) ke gaya scraper project ini:
// fetch bawaan Node + parsing HTML dengan regex, jadi TIDAK butuh dependensi baru.
//
// Alurnya (sama dengan skrip aslinya):
//   1. GET  /en1            -> cookie awal
//   2. POST /api/userverify -> token verifikasi (cftoken)
//   3. POST /action         -> HTML berisi form lagu (data, token, base)
//   4. POST /action/track   -> HTML berisi link download MP3 (dl.spotimate.app)

import { CHROME_UA, getCookiesFromHeaders, stripHtml } from "./scraperUtils.js";

const BASE = "https://spotimate.app";

// Gabungkan cookie baru (dari Set-Cookie sebuah response) ke cookie yang sudah ada.
function mergeCookies(existing, headers) {
  const fresh = getCookiesFromHeaders(headers);
  if (!fresh) return existing;
  return existing ? `${existing}; ${fresh}` : fresh;
}

// Spotimate membalas JSON; kalau yang datang ternyata HTML (mis. halaman blokir),
// beri pesan yang jelas daripada error "Unexpected token <".
async function readJson(res, label) {
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    console.error(`[spotimate] ${label} bukan JSON — status ${res.status}, cuplikan: ${text.slice(0, 200)}`);
    throw new Error(`Spotimate (${label}) membalas data yang tidak valid.`);
  }
}

const decodeAttr = (v) => String(v || "").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#0?39;/g, "'");

// Ambil semua <form> beserta pasangan name/value <input>-nya.
function parseForms(html) {
  const forms = [];
  const formRe = /<form\b[^>]*>([\s\S]*?)<\/form>/gi;
  let fm;
  while ((fm = formRe.exec(html)) !== null) {
    const inputs = {};
    const inputRe = /<input\b[^>]*>/gi;
    let im;
    while ((im = inputRe.exec(fm[1])) !== null) {
      const name = im[0].match(/\bname="([^"]*)"/i)?.[1];
      if (!name) continue;
      inputs[name] = decodeAttr(im[0].match(/\bvalue="([^"]*)"/i)?.[1] ?? "");
    }
    forms.push(inputs);
  }
  return forms;
}

function formBody(fields) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) {
    if (v !== undefined && v !== null) fd.append(k, String(v));
  }
  return fd; // fetch mengisi Content-Type + boundary multipart sendiri
}

// Hanya link track Spotify yang diterima; query string (?si=...) dibuang.
function cleanSpotifyUrl(input) {
  const u = new URL(String(input || "").trim());
  if (u.protocol !== "https:" || u.hostname !== "open.spotify.com" || !/\/track\//.test(u.pathname)) {
    throw new Error("Link harus berupa link track Spotify.");
  }
  return `${u.origin}${u.pathname}`;
}

export async function scrapeSpotimate(inputUrl) {
  const url = cleanSpotifyUrl(inputUrl);
  const baseHeaders = { "User-Agent": CHROME_UA, Origin: BASE, Referer: `${BASE}/en1` };

  // 1) Cookie awal.
  const r1 = await fetch(`${BASE}/en1`, {
    headers: { "User-Agent": CHROME_UA, Accept: "*/*" },
    signal: AbortSignal.timeout(10000),
  });
  let cookies = getCookiesFromHeaders(r1.headers);

  // 2) Token verifikasi. Kalau gagal, lanjut tanpa token (seperti skrip aslinya).
  let token = "";
  try {
    const rv = await fetch(`${BASE}/api/userverify`, {
      method: "POST",
      headers: {
        ...baseHeaders,
        "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
        "X-Requested-With": "XMLHttpRequest",
        Cookie: cookies,
      },
      body: `url=${encodeURIComponent(url)}`,
      signal: AbortSignal.timeout(8000),
    });
    const vj = await rv.json().catch(() => null);
    if (vj?.token) token = vj.token;
    cookies = mergeCookies(cookies, rv.headers);
  } catch {
    // abaikan
  }

  // 3) Ambil daftar lagu.
  const r2 = await fetch(`${BASE}/action`, {
    method: "POST",
    headers: { ...baseHeaders, Cookie: cookies },
    body: formBody({ url, cftoken: token }),
    signal: AbortSignal.timeout(15000),
  });
  cookies = mergeCookies(cookies, r2.headers);
  const act = await readJson(r2, "action");
  if (!act || act.success === false) throw new Error(act?.message || "Spotimate mengembalikan kegagalan.");

  const html = typeof act.html === "string" ? act.html : "";
  const titleH = stripHtml(html.match(/<h[23][^>]*>([\s\S]*?)<\/h[23]>/i)?.[1] || "");
  const artistP = stripHtml(html.match(/<p\b[^>]*>([\s\S]*?)<\/p>/i)?.[1] || "");
  const thumbImg = html.match(/<img\b[^>]*\bsrc="([^"]+)"/i)?.[1] || "";

  const track = parseForms(html)
    .map((f) => ({ data: f.data || "", token: f.token || f.track_token || "", base: f.base || url }))
    .find((f) => f.data || f.token);
  if (!track) throw new Error("Spotimate tidak menemukan lagu untuk link ini.");

  let title = titleH;
  let artist = artistP;
  let thumbnail = thumbImg;
  if (track.data) {
    try {
      const d = JSON.parse(Buffer.from(track.data, "base64").toString());
      title = d.name || d.title || title;
      artist = d.artist || d.singer || artist;
      thumbnail = d.cover || thumbnail;
    } catch {
      // data bukan base64 JSON — pakai hasil parsing HTML
    }
  }

  // 4) Ambil link download untuk lagu pertama.
  if (!(track.data && track.token)) throw new Error("Spotimate tidak memberi data untuk mengunduh lagu.");
  const r3 = await fetch(`${BASE}/action/track`, {
    method: "POST",
    headers: { ...baseHeaders, Cookie: cookies },
    body: formBody({ data: track.data, base: track.base, token: track.token }),
    signal: AbortSignal.timeout(15000),
  });
  const dl = await readJson(r3, "action/track");
  const dlHtml = typeof dl?.data === "string" ? dl.data : typeof dl?.html === "string" ? dl.html : "";

  const media = [];
  const aRe = /<a\b([^>]*)>([\s\S]*?)<\/a>/gi;
  let am;
  while ((am = aRe.exec(dlHtml)) !== null) {
    const href = decodeAttr(am[1].match(/\bhref="([^"]+)"/i)?.[1]);
    const text = stripHtml(am[2]);
    if (!/^https:\/\//i.test(href)) continue;
    if (/tunecable|premium/i.test(href) || /another song/i.test(text)) continue;
    const isCover =
      /cover/i.test(text) || /cover/i.test(href) || /scdn\.co/i.test(href) || /\.(jpe?g|png|webp)(\?.*)?$/i.test(href);
    if (isCover) {
      if (!thumbnail) thumbnail = href; // cadangan sampul; bukan untuk diunduh
      continue;
    }
    media.push({ type: "audio", label: "Download MP3 (320kbps)", url: href });
  }

  if (!media.length) throw new Error("Spotimate tidak menemukan link download.");

  return {
    title: artist ? `${artist} - ${title || ""}`.trim() : title || "Spotify Track",
    author: artist || null,
    thumbnail: thumbnail || null,
    media,
  };
}
