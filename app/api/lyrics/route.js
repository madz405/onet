import { NextResponse } from "next/server";

// Lirik lagu (berpenanda waktu) dari LRCLIB (https://lrclib.net) — gratis, tanpa
// API key. Dipanggil pemutar penuh (components/FullPlayer.js) saat tab "Lirik"
// dibuka. Judul lagu dari YouTube biasanya berantakan ("Artis - Judul (Official
// Video)"), jadi dibersihkan dulu dan dicoba beberapa kombinasi judul/artis.

export const runtime = "nodejs";
export const maxDuration = 25;

const LRCLIB = "https://lrclib.net/api";
const UA = "KOYEN-Web/1.0 (https://koyen.web.id)";

const clip = (v, n) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, n) : "");

// huruf kecil, tanpa aksen/tanda baca, supaya perbandingan judul longgar.
function norm(s) {
  return (s || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

const JUNK =
  /\b(official\s*(music\s*)?(video|audio|mv|lyric\s*video|visuali[sz]er)|lyric\s*video|lyrics?|video\s*clip|music\s*video|audio|visuali[sz]er|hd|4k|mv|full\s*version)\b/gi;

function cleanTitle(raw) {
  return (raw || "")
    .replace(/[\(\[\{【「][^\)\]\}】」]*[\)\]\}】」]/g, " ") // isi kurung dibuang
    .replace(/\b(feat|ft|featuring)\b\.?.*$/i, " ")
    .replace(/\|.*$/, " ")
    .replace(JUNK, " ")
    .replace(/["“”]/g, " ")
    .replace(/\s+/g, " ")
    .replace(/^[\s\-–—:]+|[\s\-–—:]+$/g, "")
    .trim();
}

function cleanArtist(raw) {
  return (raw || "")
    .replace(/\s*-\s*topic$/i, "")
    .replace(/vevo$/i, "")
    .replace(/\b(official|channel|music)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Kombinasi (artis, judul) yang dicoba, dari yang paling mungkin.
function buildCandidates(title, artist) {
  const out = [];
  const add = (a, t) => {
    const A = (a || "").trim();
    const T = (t || "").trim();
    if (!T) return;
    if (!out.some((c) => norm(c.artist) === norm(A) && norm(c.track) === norm(T))) out.push({ artist: A, track: T });
  };
  const a = cleanArtist(artist);
  const t = cleanTitle(title);
  // Format "Artis - Judul" (umum di YouTube).
  const m = (title || "").replace(/[\(\[][^\)\]]*[\)\]]/g, " ").split(/\s+[-–—]\s+/);
  if (m.length >= 2) {
    add(cleanTitle(m[0]), cleanTitle(m.slice(1).join(" - ")));
    add(cleanTitle(m.slice(1).join(" - ")), cleanTitle(m[0]));
  }
  add(a, t);
  add("", t);
  return out.slice(0, 4);
}

async function lrclib(path, params) {
  const url = `${LRCLIB}${path}?${new URLSearchParams(params).toString()}`;
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": UA, Accept: "application/json" },
      signal: AbortSignal.timeout(7000),
      cache: "no-store",
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

// Skor kecocokan satu hasil terhadap lagu yang diputar. -1 = tolak.
function score(item, cand, duration) {
  if (!item || (!item.syncedLyrics && !item.plainLyrics && !item.instrumental)) return -1;
  const wantT = norm(cand.track);
  const gotT = norm(item.trackName);
  if (!wantT || !gotT) return -1;
  const titleOk = gotT === wantT || gotT.includes(wantT) || wantT.includes(gotT);
  if (!titleOk) return -1; // cegah lirik lagu lain
  let s = gotT === wantT ? 6 : 3;
  const wantA = norm(cand.artist);
  const gotA = norm(item.artistName);
  if (wantA && gotA) {
    if (gotA === wantA) s += 6;
    else if (gotA.includes(wantA) || wantA.includes(gotA)) s += 4;
    else s -= 3;
  }
  if (item.syncedLyrics) s += 10;
  if (duration > 0 && item.duration > 0) {
    const d = Math.abs(item.duration - duration);
    if (d <= 3) s += 6;
    else if (d <= 8) s += 3;
    else if (d > 20) s -= 6;
  }
  return s;
}

// "[01:23.45] teks" -> { t: 83.45, text }. Satu baris boleh punya beberapa penanda waktu.
function parseLrc(lrc) {
  const lines = [];
  const tag = /\[(\d{1,3}):(\d{2})(?:[.:](\d{1,3}))?\]/g;
  for (const raw of (lrc || "").split(/\r?\n/)) {
    const stamps = [...raw.matchAll(tag)];
    if (!stamps.length) continue;
    const text = raw.replace(tag, "").trim();
    if (!text) continue;
    for (const m of stamps) {
      const t = Number(m[1]) * 60 + Number(m[2]) + (m[3] ? Number(`0.${m[3]}`) : 0);
      lines.push({ t, text });
    }
  }
  return lines.sort((a, b) => a.t - b.t);
}

function reply(body, found) {
  return NextResponse.json(body, {
    headers: {
      "Cache-Control": found
        ? "public, s-maxage=86400, stale-while-revalidate=604800"
        : "public, s-maxage=1800",
    },
  });
}

export async function GET(req) {
  const sp = new URL(req.url).searchParams;
  const title = clip(sp.get("title"), 200);
  const artist = clip(sp.get("artist"), 120);
  const duration = Math.round(Number(sp.get("duration")) || 0);
  if (!title) return NextResponse.json({ status: false, message: "Judul kosong." }, { status: 400 });

  const cands = buildCandidates(title, artist);
  if (!cands.length) return reply({ status: true, found: false }, false);

  try {
    // 1) Pencocokan persis (judul + artis [+ durasi]) untuk tiap kombinasi.
    const exact = await Promise.all(
      cands
        .filter((c) => c.artist)
        .map((c) =>
          lrclib("/get", {
            track_name: c.track,
            artist_name: c.artist,
            ...(duration > 0 ? { duration: String(duration) } : {}),
          }).then((item) => ({ item, cand: c }))
        )
    );

    // 2) Pencarian longgar sebagai cadangan.
    const searches = [];
    for (const c of cands.slice(0, 3)) {
      searches.push(
        lrclib("/search", { track_name: c.track, ...(c.artist ? { artist_name: c.artist } : {}) }).then((list) => ({
          list,
          cand: c,
        }))
      );
    }
    searches.push(
      lrclib("/search", { q: `${cands[0].artist} ${cands[0].track}`.trim() }).then((list) => ({
        list,
        cand: cands[0],
      }))
    );
    const found = await Promise.all(searches);

    let best = null;
    let bestScore = -1;
    const consider = (item, cand) => {
      const s = score(item, cand, duration);
      if (s > bestScore) {
        best = item;
        bestScore = s;
      }
    };
    for (const { item, cand } of exact) if (item && !item.code) consider(item, cand);
    for (const { list, cand } of found) if (Array.isArray(list)) for (const item of list) consider(item, cand);

    if (!best) return reply({ status: true, found: false }, false);

    const synced = parseLrc(best.syncedLyrics);
    const plain = typeof best.plainLyrics === "string" ? best.plainLyrics.trim() : "";
    if (!synced.length && !plain) {
      return reply({ status: true, found: false, instrumental: Boolean(best.instrumental) }, false);
    }
    return reply(
      { status: true, found: true, synced, plain: synced.length ? "" : plain, instrumental: false },
      true
    );
  } catch {
    return NextResponse.json({ status: false, message: "Gagal memuat lirik." }, { status: 502 });
  }
}
