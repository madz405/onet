/***
  @ Base: https://bandcampdownloader.app/
  @ Note: Unduh lagu atau album Bandcamp (MP3) lewat bandcampdownloader.app.
    Diadaptasi dari axios + cheerio ke fetch bawaan Node + regex, karena
    project ini tidak punya dependency tersebut.
  @ Penyesuaian untuk web: album diproses dengan 3 permintaan paralel dan
    dibatasi 30 lagu / ~45 detik total, supaya tidak melewati batas waktu
    fungsi serverless (maxDuration 60 detik di route download).
  @ Format hasil: { title, author, thumbnail, media: [{ type: "audio", label, url, filename }] }
***/

import { CHROME_UA, getCookiesFromHeaders, stripHtml } from "./scraperUtils.js";

const BASE = "https://bandcampdownloader.app";
const MAX_TRACKS = 30;
const CONCURRENCY = 3;
const DEADLINE_MS = 45000;

const BASE_HEADERS = {
  "User-Agent": CHROME_UA,
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
  Referer: `${BASE}/`,
  Origin: BASE,
};

const getAttr = (tag, name) =>
  tag.match(new RegExp(`${name}\\s*=\\s*"([^"]*)"`, "i"))?.[1] ??
  tag.match(new RegExp(`${name}\\s*=\\s*'([^']*)'`, "i"))?.[1] ??
  null;

const decodeAttr = (v) => (v == null ? v : v.replace(/&amp;/g, "&").replace(/&quot;/g, '"'));

// Ambil semua <form name="..."> beserta nilai <input>-nya (name -> value).
function parseForms(html, formName) {
  const forms = [];
  const formRe = new RegExp(`<form\\b[^>]*name="${formName}"[^>]*>([\\s\\S]*?)<\\/form>`, "gi");
  let fm;
  while ((fm = formRe.exec(html)) !== null) {
    const inputs = {};
    const hidden = [];
    for (const tag of fm[1].match(/<input\b[^>]*>/gi) || []) {
      const name = getAttr(tag, "name");
      const value = decodeAttr(getAttr(tag, "value"));
      if (name) {
        inputs[name] = value ?? "";
        if (/type\s*=\s*["']hidden["']/i.test(tag)) hidden.push([name, value ?? ""]);
      }
    }
    forms.push({ inputs, hidden });
  }
  return forms;
}

function decodeMeta(b64) {
  try {
    return JSON.parse(Buffer.from(b64, "base64").toString("utf8"));
  } catch {
    return {};
  }
}

function cloudflareHint(status) {
  return status === 403 || status === 503
    ? " Situs sumber kemungkinan memblokir permintaan dari server (Cloudflare)."
    : "";
}

async function postForm(path, params, cookie, timeoutMs) {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { ...BASE_HEADERS, "Content-Type": "application/x-www-form-urlencoded", Cookie: cookie },
    body: new URLSearchParams(params).toString(),
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) {
    throw new Error(`Situs sumber menolak permintaan (status ${res.status}).${cloudflareHint(res.status)}`);
  }
  try {
    return await res.json();
  } catch {
    throw new Error("Situs sumber mengembalikan respons yang tidak valid.");
  }
}

export async function scrapeBandcamp(url, options = {}) {
  if (!url || typeof url !== "string") throw new Error("Link Bandcamp tidak valid.");
  const quality = options.quality || "320";

  // Langkah 1: buka halaman utama untuk cookie sesi + token CSRF.
  const r1 = await fetch(`${BASE}/`, { headers: BASE_HEADERS, signal: AbortSignal.timeout(15000) });
  if (!r1.ok) {
    throw new Error(`Situs sumber tidak bisa dibuka (status ${r1.status}).${cloudflareHint(r1.status)}`);
  }
  const cookie = getCookiesFromHeaders(r1.headers);
  const homeHtml = await r1.text();

  const csrf = parseForms(homeHtml, "submitbcurl")[0]?.hidden[0];
  if (!csrf) throw new Error("Gagal mengambil token dari situs sumber (tampilan situsnya mungkin berubah).");

  // Langkah 2: kirim link Bandcamp -> daftar lagu.
  const r2 = await postForm("/action", { url: url.trim(), [csrf[0]]: csrf[1] }, cookie, 30000);
  if (r2.error) throw new Error(r2.message || "Gagal memproses link Bandcamp ini.");
  if (!r2.success || !r2.html) throw new Error("Respons situs sumber tidak sesuai harapan.");

  const trackForms = parseForms(r2.html, "submitapurl").filter((f) => f.inputs.data);
  if (!trackForms.length) throw new Error("Tidak ada lagu yang ditemukan di link ini.");

  const tracks = trackForms.slice(0, MAX_TRACKS).map((f, i) => {
    const meta = decodeMeta(f.inputs.data);
    return {
      index: i + 1,
      title: meta.name || `Lagu ${i + 1}`,
      artist: meta.artist || null,
      album: meta.album || null,
      cover: meta.cover || null,
      data: f.inputs.data,
      base: f.inputs.base || "",
      token: f.inputs.token || "",
    };
  });
  const first = tracks[0];
  const isAlbum = trackForms.length > 1;

  // Langkah 3: minta link unduhan tiap lagu (paralel, dibatasi waktu).
  const startedAt = Date.now();
  const results = new Array(tracks.length).fill(null);
  let cursor = 0;
  let firstError = null;

  async function worker() {
    while (cursor < tracks.length) {
      const i = cursor++;
      if (Date.now() - startedAt > DEADLINE_MS) return;
      const t = tracks[i];
      try {
        const r3 = await postForm(
          "/action/track",
          { data: t.data, base: t.base, token: t.token, type: quality },
          cookie,
          40000
        );
        if (r3.error) throw new Error(r3.message || "Gagal mengambil link lagu.");

        const links = [];
        for (const a of String(r3.data || "").match(/<a\b[^>]*>[\s\S]*?<\/a>/gi) || []) {
          const cls = getAttr(a, "class") || "";
          const href = decodeAttr(getAttr(a, "href"));
          if (/\babutton\b/.test(cls) && href && href.includes("/dl?token=")) {
            links.push({
              label: stripHtml(a),
              url: new URL(href, BASE).href,
            });
          }
        }
        results[i] = links;
      } catch (err) {
        if (!firstError) firstError = err;
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, tracks.length) }, worker));

  const media = [];
  tracks.forEach((t, i) => {
    const links = results[i] || [];
    links.forEach((l) => {
      const many = links.length > 1 && l.label;
      const base = `${t.artist ? `${t.artist} - ` : ""}${t.title}`;
      media.push({
        type: "audio",
        label: `${isAlbum ? `${t.index}. ` : ""}${t.title}${many ? ` (${l.label})` : ""}`,
        url: l.url,
        filename: `${base}${many ? ` ${l.label}` : ""}.mp3`,
      });
    });
  });

  if (!media.length) {
    throw firstError || new Error("Tidak ada link unduhan yang berhasil diambil.");
  }

  return {
    title: isAlbum ? first.album || first.title : first.title,
    author: first.artist,
    thumbnail: first.cover,
    media,
  };
}
