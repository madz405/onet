// Playlist musik, disimpan di localStorage browser (per-perangkat, tanpa login).
//
// Yang disimpan per lagu hanya DATA lagunya (judul, artis, sampul, URL asal,
// kata kunci), BUKAN link stream. Link stream cepat kedaluwarsa, jadi saat
// lagu dari playlist diputar, pemutar (MusicPlayerProvider) mengambil link
// baru dari URL asal lewat /api/music (action "resolve").
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

function newId() {
  return `pl_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

// Bentuk lagu yang disimpan di playlist (membuang streamUrl & field lain).
// Mengembalikan null kalau datanya tidak layak disimpan.
export function toPlaylistTrack(t) {
  if (!t || typeof t !== "object") return null;
  const source = SOURCES.has(t.source) ? t.source : null;
  const title = str(t.title, 200);
  if (!source || !title) return null;
  const artist = str(t.artist, 120);
  return {
    id: str(t.id, 400) || makeTrackId({ source, title, artist }),
    source,
    title,
    artist,
    thumbnail: httpsOrNull(t.thumbnail),
    pageUrl: httpsOrNull(t.pageUrl),
    searchQuery: str(t.searchQuery, 250),
    query: str(t.query, 200),
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
  return {
    id: str(p.id, 80) || newId(),
    name,
    createdAt: Number.isFinite(p.createdAt) ? p.createdAt : Date.now(),
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
    // localStorage penuh/diblokir (mode private, dll) — abaikan.
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

export function exportPlaylists(list) {
  return JSON.stringify({ app: "koyen-music", version: 1, exportedAt: new Date().toISOString(), playlists: list }, null, 2);
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
    next.push({ ...p, id: newId(), name });
    added++;
  }
  if (!added) return { error: `Maksimal ${MAX_PLAYLISTS} playlist.` };
  return { list: persist(next), added };
}
