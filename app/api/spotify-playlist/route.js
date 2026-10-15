import { NextResponse } from "next/server";

// Impor playlist Spotify: membaca DAFTAR LAGU (judul + artis) dari halaman embed
// publik Spotify, tanpa login dan tanpa API key. Hasilnya disimpan sebagai
// playlist KOYEN oleh PlaylistTab; link audionya baru dicari saat lagu diputar.
// Hanya playlist/album PUBLIK yang bisa dibaca, dan halaman embed biasanya hanya
// memuat sekitar 100 lagu pertama.

export const runtime = "nodejs";
export const maxDuration = 25;

const UA =
  "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Mobile Safari/537.36";
const MAX_TRACKS = 300;

// Link dari aplikasi Spotify di HP biasanya berbentuk pendek (spotify.link/xxxx).
const ALLOWED_HOSTS = /^(open\.spotify\.com|spotify\.link|spotify\.app\.link|link\.spotify\.com)$/i;
const REF_RE = /(?:open\.spotify\.com\/(?:intl-[a-z]{2}(?:-[a-z]{2})?\/)?(?:embed\/)?|spotify:)(playlist|album)[\/:]([A-Za-z0-9]{22})/i;

const bad = (message, status = 400) => NextResponse.json({ status: false, message }, { status });
const clean = (v, n) => (typeof v === "string" ? v.replace(/[\s\u00a0]+/g, " ").trim().slice(0, n) : "");

function extractRef(text) {
  const m = REF_RE.exec(text || "");
  return m ? { type: m[1].toLowerCase(), id: m[2] } : null;
}

function httpsOrNull(v) {
  try {
    const u = new URL(String(v || ""));
    return u.protocol === "https:" ? u.href : null;
  } catch {
    return null;
  }
}

// Cari objek yang punya `trackList` di dalam JSON halaman embed (struktur
// __NEXT_DATA__ bisa bergeser, jadi dicari, bukan ditunjuk jalurnya).
function findEntity(node, depth = 0) {
  if (!node || typeof node !== "object" || depth > 8) return null;
  if (Array.isArray(node.trackList)) return node;
  for (const v of Object.values(node)) {
    const hit = findEntity(v, depth + 1);
    if (hit) return hit;
  }
  return null;
}

function pickCover(entity) {
  const sources =
    entity?.coverArt?.sources || entity?.images?.sources || (Array.isArray(entity?.images) ? entity.images : null) || [];
  const list = Array.isArray(sources) ? sources.filter((s) => s?.url) : [];
  if (!list.length) return httpsOrNull(entity?.coverArt?.url || entity?.image);
  list.sort((a, b) => (b.width || 0) - (a.width || 0));
  // ukuran sedang sudah cukup untuk thumbnail
  const mid = list.find((s) => (s.width || 0) <= 400) || list[list.length - 1];
  return httpsOrNull(mid.url);
}

async function fetchText(url, ms = 10000) {
  const res = await fetch(url, {
    headers: { "User-Agent": UA, "Accept-Language": "en-US,en;q=0.9", Accept: "text/html,application/json" },
    redirect: "follow",
    signal: AbortSignal.timeout(ms),
    cache: "no-store",
  });
  return { res, text: await res.text() };
}

export async function POST(req) {
  let body;
  try {
    body = await req.json();
  } catch {
    return bad("Body tidak valid.");
  }
  const input = clean(body?.url, 400);
  if (!input) return bad("Tempel link playlist Spotify dulu.");

  // 1) Ambil jenis + ID playlist dari link / URI yang ditempel.
  let ref = extractRef(input);
  if (!ref) {
    const link = (input.match(/https?:\/\/\S+/) || [input])[0];
    let host = "";
    try {
      host = new URL(link).hostname;
    } catch {
      return bad("Link tidak valid. Salin link playlist dari Spotify.");
    }
    if (!ALLOWED_HOSTS.test(host)) return bad("Link harus dari Spotify (open.spotify.com atau spotify.link).");
    try {
      // Link pendek: ikuti pengalihannya sampai ketemu link playlist aslinya.
      const { res, text } = await fetchText(link, 8000);
      ref = extractRef(res.url) || extractRef(text);
    } catch {
      return bad("Gagal membuka link Spotify tersebut. Coba lagi.", 502);
    }
  }
  if (!ref) return bad("Itu bukan link playlist Spotify. Pastikan yang dibagikan adalah playlist, bukan lagu.");

  // 2) Baca halaman embed-nya.
  let entity;
  try {
    const { res, text } = await fetchText(`https://open.spotify.com/embed/${ref.type}/${ref.id}`);
    if (res.status === 404) return bad("Playlist tidak ditemukan. Pastikan playlist-nya publik.", 404);
    const m = /<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/.exec(text);
    if (!m) throw new Error("data embed tidak ada");
    entity = findEntity(JSON.parse(m[1]));
  } catch (err) {
    console.error("[spotify-playlist] gagal baca embed:", err.message);
    return bad("Gagal membaca playlist dari Spotify. Coba lagi sebentar lagi.", 502);
  }
  if (!entity) return bad("Playlist tidak bisa dibaca. Pastikan playlist-nya publik (bukan privat).", 404);

  // 3) Rapikan daftar lagu.
  const cover = pickCover(entity);
  const seen = new Set();
  const tracks = [];
  for (const it of entity.trackList) {
    const id = /spotify:track:([A-Za-z0-9]{22})/.exec(it?.uri || "")?.[1];
    const title = clean(it?.title || it?.name, 200);
    if (!title) continue;
    const artist =
      clean(it?.subtitle, 120) ||
      clean(Array.isArray(it?.artists) ? it.artists.map((a) => a?.name).filter(Boolean).join(", ") : "", 120);
    const key = `${title.toLowerCase()}|${artist.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    tracks.push({
      title,
      artist,
      pageUrl: id ? `https://open.spotify.com/track/${id}` : null,
      // Format yang sama dengan hasil pencarian Spotify ("Artis - Judul").
      searchQuery: clean(artist ? `${artist} - ${title}` : title, 250),
    });
    if (tracks.length >= MAX_TRACKS) break;
  }
  if (!tracks.length) return bad("Playlist ini kosong atau lagunya tidak bisa dibaca.", 404);

  return NextResponse.json({
    status: true,
    type: ref.type,
    name: clean(entity.name || entity.title, 80) || "Playlist Spotify",
    cover,
    tracks,
  });
}
