import { NextResponse } from "next/server";
import yts from "yt-search";

// Impor playlist YouTube / YouTube Music: membaca DAFTAR LAGU (judul + channel/artis +
// sampul) dari halaman playlist publik, tanpa login dan tanpa API key. Hasilnya disimpan
// sebagai playlist KOYEN oleh PlaylistTab; link audionya baru dicari saat lagu diputar.
// Playlist harus publik atau "tidak publik" (unlisted). Playlist pribadi, "Suka" (LM),
// dan mix/radio otomatis (RD...) tidak bisa dibaca.
//
// Urutan: baca halaman playlist langsung (+ halaman lanjutan sampai MAX_TRACKS),
// cadangan: module yt-search (hanya halaman pertama, ±100 lagu).

export const runtime = "nodejs";
export const maxDuration = 30;

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36";
const MAX_TRACKS = 300;
const MAX_CONTINUATIONS = 4;
const ALLOWED_HOSTS = /^(music\.youtube\.com|(www|m)\.youtube\.com|youtube\.com|youtu\.be)$/i;

const bad = (message, status = 400) => NextResponse.json({ status: false, message }, { status });
const clean = (v, n) => (typeof v === "string" ? v.replace(/[\s\u00a0]+/g, " ").trim().slice(0, n) : "");

function httpsOrNull(v) {
  try {
    const u = new URL(String(v || ""));
    return u.protocol === "https:" ? u.href : null;
  } catch {
    return null;
  }
}

// ID playlist dari link (music.youtube.com / youtube.com / youtu.be) atau ID mentah.
function extractListId(input) {
  const raw = input.trim();
  if (/^(PL|OLAK5uy_|UU|FL|VL|RD|LM|WL)[A-Za-z0-9_-]{0,64}$/.test(raw)) return raw.replace(/^VL(?=PL|OLAK5uy_)/, "");
  const link = (input.match(/https?:\/\/\S+/) || [])[0];
  if (!link) return { error: "Tempel link playlist YouTube Music (atau YouTube) yang lengkap." };
  let u;
  try {
    u = new URL(link);
  } catch {
    return { error: "Link tidak valid." };
  }
  if (!ALLOWED_HOSTS.test(u.hostname)) return { error: "Link harus dari YouTube Music atau YouTube." };
  const id = u.searchParams.get("list");
  if (!id || !/^[A-Za-z0-9_-]{2,64}$/.test(id)) {
    return { error: "Link ini bukan link playlist. Buka playlist-nya lalu salin link dari tombol Bagikan." };
  }
  return id;
}

function cleanArtist(raw) {
  return clean(raw, 120)
    .replace(/\s*-\s*topic$/i, "")
    .replace(/vevo$/i, "")
    .trim();
}

function pickThumb(thumbs, id) {
  const list = Array.isArray(thumbs) ? thumbs.filter((t) => t?.url) : [];
  list.sort((a, b) => (a.width || 0) - (b.width || 0));
  const mid = list.find((t) => (t.width || 0) >= 160) || list[list.length - 1];
  return httpsOrNull(mid?.url) || `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
}

// Cari semua objek bernama `key` di dalam JSON halaman (struktur halaman sering bergeser,
// jadi dicari, bukan ditunjuk jalurnya).
function collect(node, key, out = [], depth = 0) {
  if (!node || typeof node !== "object" || depth > 30) return out;
  if (Array.isArray(node)) {
    for (const v of node) collect(v, key, out, depth + 1);
    return out;
  }
  if (node[key] && typeof node[key] === "object") out.push(node[key]);
  for (const v of Object.values(node)) collect(v, key, out, depth + 1);
  return out;
}

function rendererToTrack(r) {
  const id = r?.videoId;
  if (!id || !/^[A-Za-z0-9_-]{11}$/.test(id) || r.isPlayable === false) return null;
  const title = clean(r.title?.runs?.[0]?.text || r.title?.simpleText, 200);
  if (!title || /^\[(deleted|private) video\]$/i.test(title)) return null;
  const artist = cleanArtist(r.shortBylineText?.runs?.[0]?.text || r.longBylineText?.runs?.[0]?.text || "");
  return {
    title,
    artist,
    thumbnail: pickThumb(r.thumbnail?.thumbnails, id),
    pageUrl: `https://www.youtube.com/watch?v=${id}`,
    // Sama seperti hasil pencarian YouTube: judul; nama channel ditambahkan oleh /api/music.
    searchQuery: title,
  };
}

async function readPlaylistPage(listId) {
  const res = await fetch(`https://www.youtube.com/playlist?list=${encodeURIComponent(listId)}&hl=id&gl=ID`, {
    headers: { "User-Agent": UA, "Accept-Language": "id-ID,id;q=0.9,en;q=0.8", Cookie: "CONSENT=YES+1; SOCS=CAI" },
    signal: AbortSignal.timeout(12000),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const html = await res.text();
  const m = /var ytInitialData\s*=\s*(\{[\s\S]*?\});\s*<\/script>/.exec(html);
  if (!m) throw new Error("data halaman playlist tidak ditemukan");
  const data = JSON.parse(m[1]);

  const name =
    clean(collect(data, "playlistMetadataRenderer")[0]?.title, 80) ||
    clean(collect(data, "playlistHeaderRenderer")[0]?.title?.simpleText, 80) ||
    clean(/<meta property="og:title" content="([^"]+)"/.exec(html)?.[1], 80);

  const tracks = [];
  const add = (renderers) => {
    for (const r of renderers) {
      const t = rendererToTrack(r);
      if (t) tracks.push(t);
    }
  };
  add(collect(data, "playlistVideoRenderer"));

  // Halaman lanjutan (playlist > 100 lagu).
  let token = collect(data, "continuationCommand")[0]?.token;
  const apiKey = /"INNERTUBE_API_KEY":"([^"]+)"/.exec(html)?.[1];
  const version = /"INNERTUBE_CLIENT_VERSION":"([^"]+)"/.exec(html)?.[1] || "2.20241001.00.00";
  for (let i = 0; token && apiKey && i < MAX_CONTINUATIONS && tracks.length < MAX_TRACKS; i++) {
    try {
      const r = await fetch(`https://www.youtube.com/youtubei/v1/browse?key=${apiKey}&prettyPrint=false`, {
        method: "POST",
        headers: { "User-Agent": UA, "Content-Type": "application/json", Cookie: "CONSENT=YES+1; SOCS=CAI" },
        body: JSON.stringify({
          context: { client: { clientName: "WEB", clientVersion: version, hl: "id", gl: "ID" } },
          continuation: token,
        }),
        signal: AbortSignal.timeout(10000),
        cache: "no-store",
      });
      if (!r.ok) break;
      const j = await r.json();
      add(collect(j, "playlistVideoRenderer"));
      token = collect(j, "continuationCommand")[0]?.token;
    } catch {
      break; // halaman lanjutan gagal: pakai yang sudah didapat
    }
  }
  return { name, tracks };
}

// Cadangan: module yt-search (halaman pertama saja).
async function readViaYts(listId) {
  const res = await Promise.race([
    yts({ listId, hl: "id", gl: "ID" }),
    new Promise((_, rej) => setTimeout(() => rej(new Error("yt-search terlalu lama")), 12000)),
  ]);
  const tracks = [];
  for (const v of res?.videos || []) {
    if (!v?.videoId) continue;
    const title = clean(v.title, 200);
    if (!title || /^\[(deleted|private) video\]$/i.test(title)) continue;
    tracks.push({
      title,
      artist: cleanArtist(v.author?.name || ""),
      thumbnail: httpsOrNull(v.thumbnail) || `https://i.ytimg.com/vi/${v.videoId}/hqdefault.jpg`,
      pageUrl: `https://www.youtube.com/watch?v=${v.videoId}`,
      searchQuery: title,
    });
  }
  return { name: clean(res?.title, 80), tracks };
}

export async function POST(req) {
  let body;
  try {
    body = await req.json();
  } catch {
    return bad("Body tidak valid.");
  }
  const input = clean(body?.url, 400);
  if (!input) return bad("Tempel link playlist YouTube Music dulu.");

  const parsed = extractListId(input);
  if (parsed?.error) return bad(parsed.error);
  const listId = parsed;

  if (listId.startsWith("RD")) return bad("Mix / radio otomatis tidak bisa diimpor. Pakai playlist biasa.");
  if (listId === "LM" || listId === "WL") return bad("Playlist pribadi (Suka / Tonton nanti) tidak bisa diimpor.");

  let result = null;
  try {
    result = await readPlaylistPage(listId);
  } catch (err) {
    console.error("[youtube-playlist] baca halaman gagal:", err.message);
  }
  if (!result?.tracks.length) {
    try {
      result = await readViaYts(listId);
    } catch (err) {
      console.error("[youtube-playlist] yt-search gagal:", err.message);
    }
  }
  if (!result?.tracks.length) {
    return bad("Playlist tidak bisa dibaca. Pastikan playlist-nya publik (bukan privat) dan bukan mix otomatis.", 404);
  }

  // Tanpa duplikat (video yang sama).
  const seen = new Set();
  const tracks = result.tracks.filter((t) => !seen.has(t.pageUrl) && seen.add(t.pageUrl)).slice(0, MAX_TRACKS);

  return NextResponse.json({
    status: true,
    name: result.name || "Playlist YouTube",
    cover: null, // tiap lagu punya sampul sendiri -> kartu playlist memakai kolase
    tracks,
  });
}
