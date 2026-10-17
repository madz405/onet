// Playlist musik, disimpan di localStorage browser (per-perangkat, tanpa login).
//
// Yang disimpan per lagu: data lagunya (judul, artis, sampul, URL asal, kata
// kunci) DITAMBAH link stream terakhir (streamUrl + resolvedAt), sama seperti
// riwayat. Link stream bisa kedaluwarsa; kalau gagal diputar, pemutar
// (MusicPlayerProvider.handleAudioError) mengambil link baru dari URL asal /
// judul lewat /api/music (action "resolve") lalu menyimpannya lagi di sini.
// Lagu yang belum pernah diputar (mis. hasil impor Spotify) belum punya link;
// link-nya disimpan begitu lagu pertama kali diputar. Saat playlist diekspor,
// link stream TIDAK ikut dibawa.
//
// Semua fungsi mengembalikan objek { list, ... } berisi daftar playlist terbaru
// (dan menyimpannya ke localStorage), atau { error } kalau gagal. Tidak ada yang
// melempar error.

import { makeTrackId } from "./musicHistory.js";

export const PLAYLISTS_KEY = "koyen-music-playlists";
export const MAX_PLAYLISTS = 30;
export const MAX_TRACKS = 300;
export const MAX_NAME = 40;
const MAX_IMPORT_CHARS = 2 * 1024 * 1024;
const SOURCES = new Set(["youtube", "spotify", "soundcloud"]);

const str = (v, n) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, n) : "");

function httpsOrNull(v) {
  try {
    const u = new URL(String(v || ""));
    return u.protocol === "https:" ? u.href : null;
  } catch {
    return null;
  }
}

// Link stream yang masuk akal disimpan (https, tidak terlalu panjang).
function cleanStreamUrl(v) {
  const u = httpsOrNull(v);
  return u && u.length <= 4000 ? u : null;
}

// Salinan lagu tanpa link stream (untuk ekspor / impor file).
function withoutStream(t) {
  const { streamUrl, resolvedAt, ...rest } = t; // eslint-disable-line no-unused-vars
  return rest;
}

function newId() {
  return `pl_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

// Bentuk lagu yang disimpan di playlist (field lain dibuang; link stream ikut
// disimpan kalau ada).
// Mengembalikan null kalau datanya tidak layak disimpan.
export function toPlaylistTrack(t) {
  if (!t || typeof t !== "object") return null;
  const source = SOURCES.has(t.source) ? t.source : null;
  const title = str(t.title, 200);
  if (!source || !title) return null;
  const artist = str(t.artist, 120);
  const streamUrl = cleanStreamUrl(t.streamUrl);
  return {
    id: str(t.id, 400) || makeTrackId({ source, title, artist }),
    source,
    title,
    artist,
    thumbnail: httpsOrNull(t.thumbnail),
    pageUrl: httpsOrNull(t.pageUrl),
    searchQuery: str(t.searchQuery, 250),
    query: str(t.query, 200),
    ...(streamUrl ? { streamUrl, resolvedAt: Number.isFinite(t.resolvedAt) ? t.resolvedAt : Date.now() } : {}),
  };
}

function sanitizePlaylist(p) {
  if (!p || typeof p !== "object") return null;
  const name = str(p.name, MAX_NAME);
  if (!name) return null;
  const seen = new Set();
  const tracks = [];
  for (const raw of Array.isArray(p.tracks) ? p.tracks : []) {
    const t = toPlaylistTrack(raw);
    if (!t || seen.has(t.id)) continue;
    seen.add(t.id);
    tracks.push(t);
    if (tracks.length >= MAX_TRACKS) break;
  }
  const cover = httpsOrNull(p.cover);
  return {
    id: str(p.id, 80) || newId(),
    name,
    createdAt: Number.isFinite(p.createdAt) ? p.createdAt : Date.now(),
    ...(cover ? { cover } : {}), // sampul playlist (impor Spotify), ditampilkan 1x di kartu playlist
    tracks,
  };
}

function sanitizeList(raw) {
  const out = [];
  const ids = new Set();
  for (const item of Array.isArray(raw) ? raw : []) {
    const p = sanitizePlaylist(item);
    if (!p) continue;
    if (ids.has(p.id)) p.id = newId();
    ids.add(p.id);
    out.push(p);
    if (out.length >= MAX_PLAYLISTS) break;
  }
  return out;
}

function persist(list) {
  try {
    window.localStorage.setItem(PLAYLISTS_KEY, JSON.stringify(list));
  } catch {
    // Penuh? Link stream-lah yang paling besar; simpan tanpa itu supaya playlist-nya
    // sendiri tidak hilang (link diambil lagi saat lagu diputar).
    try {
      const slim = list.map((p) => ({ ...p, tracks: p.tracks.map(withoutStream) }));
      window.localStorage.setItem(PLAYLISTS_KEY, JSON.stringify(slim));
    } catch {
      // localStorage diblokir (mode private, dll) — abaikan.
    }
  }
  return list;
}

export function loadPlaylists() {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(PLAYLISTS_KEY);
    return raw ? sanitizeList(JSON.parse(raw)) : [];
  } catch {
    return [];
  }
}

const nameTaken = (list, name, exceptId) =>
  list.some((p) => p.id !== exceptId && p.name.toLowerCase() === name.toLowerCase());

export function createPlaylist(list, name, firstTrack) {
  const n = str(name, MAX_NAME);
  if (!n) return { error: "Nama playlist tidak boleh kosong." };
  if (list.length >= MAX_PLAYLISTS) return { error: `Maksimal ${MAX_PLAYLISTS} playlist.` };
  if (nameTaken(list, n)) return { error: "Sudah ada playlist dengan nama itu." };
  const track = firstTrack ? toPlaylistTrack(firstTrack) : null;
  const playlist = { id: newId(), name: n, createdAt: Date.now(), tracks: track ? [track] : [] };
  return { list: persist([...list, playlist]), playlist };
}

// Membuat playlist baru berisi banyak lagu sekaligus (impor dari Spotify / YouTube Music).
// Nama yang sudah dipakai ditambah " (2)", " (3)", dst.
export function createImportedPlaylist(list, name, tracks, cover) {
  if (list.length >= MAX_PLAYLISTS) return { error: `Maksimal ${MAX_PLAYLISTS} playlist.` };
  const base = str(name, MAX_NAME) || "Playlist Spotify";
  let n = base;
  for (let i = 2; nameTaken(list, n); i++) n = `${base.slice(0, MAX_NAME - 5)} (${i})`;
  const seen = new Set();
  const out = [];
  for (const raw of Array.isArray(tracks) ? tracks : []) {
    const t = toPlaylistTrack({ source: "spotify", ...raw }); // raw.source (mis. "youtube") menggantikan bawaan
    if (!t || seen.has(t.id)) continue;
    seen.add(t.id);
    out.push(t);
    if (out.length >= MAX_TRACKS) break;
  }
  if (!out.length) return { error: "Tidak ada lagu yang bisa diimpor." };
  const coverUrl = httpsOrNull(cover);
  const playlist = { id: newId(), name: n, createdAt: Date.now(), ...(coverUrl ? { cover: coverUrl } : {}), tracks: out };
  return { list: persist([...list, playlist]), playlist, count: out.length };
}

// Dipakai pemutar: begitu link lagu berhasil diambil/diperbarui, link stream +
// sampul aslinya ikut disimpan ke SEMUA playlist yang memuat lagu itu (lagu impor
// Spotify awalnya hanya punya sampul playlist). Langsung menulis ke localStorage
// lalu memberi tahu hook usePlaylists lewat event supaya tampilan ikut diperbarui.
export const PLAYLISTS_CHANGED_EVENT = "koyen-playlists-changed";

export function updatePlaylistTrackData(trackId, { thumbnail, streamUrl, resolvedAt } = {}) {
  if (typeof window === "undefined" || !trackId) return false;
  const thumb = httpsOrNull(thumbnail);
  const stream = cleanStreamUrl(streamUrl);
  if (!thumb && !stream) return false;
  const list = loadPlaylists();
  let changed = false;
  const next = list.map((p) => ({
    ...p,
    tracks: p.tracks.map((t) => {
      if (t.id !== trackId) return t;
      const patch = {};
      if (thumb && t.thumbnail !== thumb) patch.thumbnail = thumb;
      if (stream && t.streamUrl !== stream) {
        patch.streamUrl = stream;
        patch.resolvedAt = Number.isFinite(resolvedAt) ? resolvedAt : Date.now();
      }
      if (!Object.keys(patch).length) return t;
      changed = true;
      return { ...t, ...patch };
    }),
  }));
  if (!changed) return false;
  persist(next);
  try {
    window.dispatchEvent(new Event(PLAYLISTS_CHANGED_EVENT));
  } catch {
    // abaikan
  }
  return true;
}

export function renamePlaylist(list, id, name) {
  const n = str(name, MAX_NAME);
  if (!n) return { error: "Nama playlist tidak boleh kosong." };
  if (nameTaken(list, n, id)) return { error: "Sudah ada playlist dengan nama itu." };
  return { list: persist(list.map((p) => (p.id === id ? { ...p, name: n } : p))) };
}

export function deletePlaylist(list, id) {
  return { list: persist(list.filter((p) => p.id !== id)) };
}

export function addTrackToPlaylist(list, playlistId, track) {
  const t = toPlaylistTrack(track);
  if (!t) return { error: "Data lagu tidak lengkap." };
  const target = list.find((p) => p.id === playlistId);
  if (!target) return { error: "Playlist tidak ditemukan." };
  if (target.tracks.some((x) => x.id === t.id)) return { list, added: false };
  if (target.tracks.length >= MAX_TRACKS) return { error: `Satu playlist maksimal ${MAX_TRACKS} lagu.` };
  const next = list.map((p) => (p.id === playlistId ? { ...p, tracks: [...p.tracks, t] } : p));
  return { list: persist(next), added: true };
}

export function removeTrackFromPlaylist(list, playlistId, trackId) {
  const next = list.map((p) =>
    p.id === playlistId ? { ...p, tracks: p.tracks.filter((t) => t.id !== trackId) } : p
  );
  return { list: persist(next) };
}

// Link stream tidak ikut diekspor (cepat kedaluwarsa & tidak berguna di perangkat lain).
export function exportPlaylists(list) {
  const playlists = list.map((p) => ({ ...p, tracks: p.tracks.map(withoutStream) }));
  return JSON.stringify({ app: "koyen-music", version: 1, exportedAt: new Date().toISOString(), playlists }, null, 2);
}

// Menggabungkan playlist dari file ekspor. Playlist impor selalu dibuat baru
// (id baru); kalau namanya sudah dipakai ditambah " (2)", " (3)", dst.
export function importPlaylists(list, text) {
  if (typeof text !== "string" || !text.trim()) return { error: "File kosong." };
  if (text.length > MAX_IMPORT_CHARS) return { error: "File terlalu besar." };
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    return { error: "File bukan playlist yang valid." };
  }
  const incoming = sanitizeList(Array.isArray(data) ? data : data?.playlists);
  if (!incoming.length) return { error: "File tidak berisi playlist yang valid." };

  let next = [...list];
  let added = 0;
  for (const p of incoming) {
    if (next.length >= MAX_PLAYLISTS) break;
    let name = p.name;
    for (let i = 2; nameTaken(next, name); i++) name = `${p.name.slice(0, MAX_NAME - 5)} (${i})`;
    // Link stream dari file tidak dipercaya/dipakai; diambil lagi saat lagu diputar.
    next.push({ ...p, tracks: p.tracks.map(withoutStream), id: newId(), name });
    added++;
  }
  if (!added) return { error: `Maksimal ${MAX_PLAYLISTS} playlist.` };
  return { list: persist(next), added };
}
