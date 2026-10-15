"use client";

// Tab "Playlist" di halaman Musik: daftar playlist (kartu), detail satu
// playlist (putar semua, ubah nama, hapus, hapus lagu), serta ekspor/impor
// file JSON untuk memindahkan playlist antar perangkat.

import { useRef, useState } from "react";
import {
  ArrowLeft,
  Check,
  Download,
  Link2,
  ListMusic,
  Loader2,
  Music2,
  Pencil,
  Play,
  Plus,
  Trash2,
  Upload,
  Volume2,
  X,
} from "lucide-react";
import { useMusicPlayer } from "@/components/MusicPlayerProvider";
import { MAX_NAME } from "@/lib/musicPlaylists";

const FIELD =
  "min-w-0 flex-1 rounded-xl border border-white/10 bg-ink-950 px-4 py-3 text-base text-white placeholder:text-white/30 focus-ring";

const SOURCE_LABEL = { youtube: "YouTube", spotify: "Spotify", soundcloud: "SoundCloud" };

function Thumb({ src, className }) {
  return src ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt="" referrerPolicy="no-referrer" loading="lazy" className={`${className} object-cover`} />
  ) : (
    <span className={`${className} grid place-items-center bg-white/5 text-white/30`}>
      <Music2 size={16} />
    </span>
  );
}

// Kolase 2x2 dari sampul empat lagu pertama.
function Cover({ tracks, cover }) {
  // Playlist hasil impor Spotify: sampulnya sudah berupa kolase album, jadi tampil 1x saja.
  if (cover) {
    return (
      <div className="aspect-square w-full overflow-hidden rounded-xl bg-white/5">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={cover} alt="" referrerPolicy="no-referrer" loading="lazy" className="h-full w-full object-cover" />
      </div>
    );
  }
  const cells = [0, 1, 2, 3].map((i) => tracks[i]?.thumbnail || null);
  return (
    <div className="grid h-[84px] grid-cols-2 gap-0.5 overflow-hidden rounded-xl bg-white/5">
      {cells.map((src, i) =>
        src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img key={i} src={src} alt="" referrerPolicy="no-referrer" loading="lazy" className="h-full w-full object-cover" />
        ) : (
          <span key={i} className="bg-white/5" />
        )
      )}
    </div>
  );
}

export default function PlaylistTab({ pl, scrollToPlayer }) {
  const { track, isPlaying, resolvingId, playFromList } = useMusicPlayer();
  const [openId, setOpenId] = useState(null);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [renaming, setRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const fileRef = useRef(null);
  // Impor playlist dari link Spotify.
  const [spOpen, setSpOpen] = useState(false);
  const [spUrl, setSpUrl] = useState("");
  const [spLoading, setSpLoading] = useState(false);

  const open = pl.playlists.find((p) => p.id === openId) || null;

  function handleCreate(e) {
    e.preventDefault();
    const res = pl.create(newName);
    if (res.error) {
      setError(res.error);
      return;
    }
    setNewName("");
    setCreating(false);
    setError("");
    setOpenId(res.playlist.id);
  }

  function startRename() {
    setRenameValue(open.name);
    setRenaming(true);
    setError("");
  }

  function handleRename(e) {
    e.preventDefault();
    const res = pl.rename(open.id, renameValue);
    if (res.error) {
      setError(res.error);
      return;
    }
    setRenaming(false);
    setError("");
  }

  function handleDelete() {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    pl.remove(open.id);
    setOpenId(null);
    setConfirmDelete(false);
  }

  async function handleSpotifyImport(e) {
    e.preventDefault();
    const link = spUrl.trim();
    if (!link || spLoading) return;
    setSpLoading(true);
    setError("");
    setNotice("");
    try {
      const res = await fetch("/api/spotify-playlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: link }),
      });
      const data = await res.json();
      if (!data?.status) throw new Error(data?.message || "Gagal mengimpor playlist.");
      // Spotify tidak memberi sampul per lagu; sampul playlist dipakai sementara
      // (diganti sampul asli lagu begitu lagunya diputar).
      const out = pl.importTracks(
        data.name,
        data.tracks.map((t) => ({ ...t, thumbnail: data.cover })),
        data.cover
      );
      if (out.error) throw new Error(out.error);
      setSpUrl("");
      setSpOpen(false);
      setOpenId(out.playlist.id);
      setNotice(
        `${out.count} lagu diimpor dari Spotify.${
          out.count >= 100 ? " Spotify hanya membagikan sebagian lagu untuk playlist yang panjang." : ""
        }`
      );
    } catch (err) {
      setError(err.message || "Gagal mengimpor playlist.");
    } finally {
      setSpLoading(false);
    }
  }

  function back() {
    setNotice("");
    setOpenId(null);
    setRenaming(false);
    setConfirmDelete(false);
    setError("");
  }

  function play(list, index) {
    playFromList(list, index);
    scrollToPlayer?.();
  }

  function handleExport() {
    const blob = new Blob([pl.exportJson()], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "playlist-koyen.json";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  async function handleImportFile(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setError("");
    setNotice("");
    if (file.size > 2 * 1024 * 1024) {
      setError("File terlalu besar.");
      return;
    }
    const text = await file.text().catch(() => "");
    const res = pl.importJson(text);
    if (res.error) setError(res.error);
    else setNotice(`${res.added} playlist diimpor.`);
  }

  // ---------- Detail satu playlist ----------
  if (open) {
    return (
      <div>
        <button
          type="button"
          onClick={back}
          className="mb-4 inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/10 px-4 py-2.5 text-sm font-semibold text-white hover:bg-white/20"
        >
          <ArrowLeft size={18} />
          Semua playlist
        </button>

        {renaming ? (
          <form onSubmit={handleRename} className="flex gap-2">
            <input
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value.slice(0, MAX_NAME))}
              maxLength={MAX_NAME}
              aria-label="Nama playlist"
              autoFocus
              className={FIELD}
            />
            <button
              type="submit"
              aria-label="Simpan nama"
              className="grid w-12 flex-shrink-0 place-items-center rounded-xl bg-signal-500 text-ink-950"
            >
              <Check size={18} />
            </button>
            <button
              type="button"
              onClick={() => {
                setRenaming(false);
                setError("");
              }}
              aria-label="Batal"
              className="grid w-12 flex-shrink-0 place-items-center rounded-xl border border-white/15 text-white"
            >
              <X size={18} />
            </button>
          </form>
        ) : (
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="break-words font-display text-xl font-semibold text-white">{open.name}</h2>
              <p className="text-sm text-white/50">{open.tracks.length} lagu</p>
            </div>
            <button
              type="button"
              onClick={startRename}
              aria-label="Ubah nama playlist"
              className="grid h-9 w-9 flex-shrink-0 place-items-center rounded-full text-white/50 hover:bg-white/10 hover:text-white"
            >
              <Pencil size={16} />
            </button>
          </div>
        )}

        {error && (
          <p className="mt-3 rounded-xl border border-flare-500/30 bg-flare-500/10 px-4 py-2.5 text-sm text-flare-400">
            {error}
          </p>
        )}
        {notice && !error && (
          <p className="mt-3 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white/70">{notice}</p>
        )}

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => play(open.tracks, 0)}
            disabled={!open.tracks.length}
            className="flex items-center gap-2 rounded-xl bg-signal-500 px-5 py-2.5 text-sm font-semibold text-ink-950 disabled:opacity-50"
          >
            <Play size={16} />
            Putar semua
          </button>
          <button
            type="button"
            onClick={handleDelete}
            onBlur={() => setConfirmDelete(false)}
            className={`flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-medium ${
              confirmDelete
                ? "border-flare-500/50 bg-flare-500/10 text-flare-400"
                : "border-white/15 text-white/70 hover:bg-white/10"
            }`}
          >
            <Trash2 size={16} />
            {confirmDelete ? "Yakin hapus?" : "Hapus playlist"}
          </button>
        </div>

        {open.tracks.length === 0 ? (
          <div className="mt-10 flex flex-col items-center gap-3 text-center text-white/40">
            <ListMusic size={32} />
            <p className="max-w-xs text-sm">
              Playlist ini masih kosong. Tambahkan lagu lewat tombol di hasil pencarian, pemutar, atau riwayat.
            </p>
          </div>
        ) : (
          <div className="mt-5 space-y-2">
            {open.tracks.map((t, i) => {
              const isCurrent = track?.id === t.id;
              const busy = resolvingId === t.id;
              return (
                <div
                  key={t.id}
                  className={`flex items-center gap-2 rounded-2xl border pr-2 transition-colors ${
                    isCurrent ? "border-signal-500/40 bg-signal-500/5" : "border-white/8 bg-ink-900/60"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => play(open.tracks, i)}
                    aria-label={`Putar ${t.title}`}
                    className="flex min-w-0 flex-1 items-center gap-3 px-3 py-2.5 text-left"
                  >
                    <Thumb src={t.thumbnail} className="h-12 w-12 flex-shrink-0 rounded-xl" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-white">{t.title}</span>
                      <span className="block truncate text-xs text-white/50">
                        {[t.artist, SOURCE_LABEL[t.source]].filter(Boolean).join(" · ")}
                      </span>
                    </span>
                    <span
                      className={`grid h-9 w-9 flex-shrink-0 place-items-center rounded-full ${
                        isCurrent ? "bg-signal-500 text-ink-950" : "bg-white/10 text-white"
                      }`}
                    >
                      {busy ? (
                        <Loader2 size={15} className="animate-spin" />
                      ) : isCurrent && isPlaying ? (
                        <Volume2 size={15} />
                      ) : (
                        <Play size={15} className="ml-0.5" />
                      )}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => pl.removeTrack(open.id, t.id)}
                    aria-label={`Hapus ${t.title} dari playlist`}
                    className="grid h-9 w-9 flex-shrink-0 place-items-center rounded-full text-white/40 hover:bg-flare-500/10 hover:text-flare-400"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // ---------- Daftar semua playlist ----------
  return (
    <div>
      {creating && (
        <form onSubmit={handleCreate} className="mb-4 flex gap-2">
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value.slice(0, MAX_NAME))}
            placeholder="Nama playlist baru"
            maxLength={MAX_NAME}
            aria-label="Nama playlist baru"
            autoFocus
            className={FIELD}
          />
          <button
            type="submit"
            className="flex-shrink-0 rounded-xl bg-signal-500 px-5 py-3 text-sm font-semibold text-ink-950"
          >
            Buat
          </button>
          <button
            type="button"
            onClick={() => {
              setCreating(false);
              setNewName("");
              setError("");
            }}
            aria-label="Batal"
            className="grid w-12 flex-shrink-0 place-items-center rounded-xl border border-white/15 text-white"
          >
            <X size={18} />
          </button>
        </form>
      )}

      {spOpen && (
        <form onSubmit={handleSpotifyImport} className="mb-4">
          <p className="mb-2 text-sm text-white/60">
            Tempel link playlist Spotify (di aplikasi Spotify: titik tiga → Bagikan → Salin link). Playlist harus publik.
          </p>
          <div className="flex gap-2">
            <input
              value={spUrl}
              onChange={(e) => setSpUrl(e.target.value)}
              placeholder="https://open.spotify.com/playlist/..."
              aria-label="Link playlist Spotify"
              autoFocus
              inputMode="url"
              className={FIELD}
            />
            <button
              type="submit"
              disabled={spLoading || !spUrl.trim()}
              className="flex flex-shrink-0 items-center gap-2 rounded-xl bg-signal-500 px-5 py-3 text-sm font-semibold text-ink-950 disabled:opacity-60"
            >
              {spLoading ? <Loader2 size={16} className="animate-spin" /> : "Impor"}
            </button>
            <button
              type="button"
              onClick={() => {
                setSpOpen(false);
                setSpUrl("");
                setError("");
              }}
              aria-label="Batal"
              className="grid w-12 flex-shrink-0 place-items-center rounded-xl border border-white/15 text-white"
            >
              <X size={18} />
            </button>
          </div>
        </form>
      )}

      {error && (
        <p className="mb-4 rounded-xl border border-flare-500/30 bg-flare-500/10 px-4 py-2.5 text-sm text-flare-400">
          {error}
        </p>
      )}
      {notice && !error && (
        <p className="mb-4 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white/70">{notice}</p>
      )}

      <div className="grid grid-cols-2 gap-3">
        {pl.playlists.map((p) => (
          <button
            type="button"
            key={p.id}
            onClick={() => {
              setOpenId(p.id);
              setError("");
              setNotice("");
            }}
            className="rounded-2xl border border-white/8 bg-ink-900/60 p-3 text-left transition-colors hover:bg-white/5"
          >
            <Cover tracks={p.tracks} cover={p.cover} />
            <span className="mt-2 block truncate text-sm font-semibold text-white">{p.name}</span>
            <span className="block text-xs text-white/50">{p.tracks.length} lagu</span>
          </button>
        ))}
        <button
          type="button"
          onClick={() => {
            setCreating(true);
            setError("");
            setNotice("");
          }}
          className="flex min-h-[140px] flex-col items-center justify-center gap-1.5 rounded-2xl border border-dashed border-white/20 text-white/50 hover:bg-white/5 hover:text-white/80"
        >
          <Plus size={22} />
          <span className="text-sm">Buat playlist</span>
        </button>
      </div>

      {pl.playlists.length === 0 && !creating && (
        <p className="mt-6 text-center text-sm text-white/40">
          Belum ada playlist. Buat satu, lalu tambahkan lagu lewat tombol di hasil pencarian atau pemutar.
        </p>
      )}

      <div className="mt-6 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={handleExport}
          disabled={pl.playlists.length === 0}
          className="flex items-center gap-2 rounded-xl border border-white/15 px-4 py-2.5 text-sm font-medium text-white/80 hover:bg-white/10 disabled:opacity-40"
        >
          <Download size={16} />
          Ekspor
        </button>
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="flex items-center gap-2 rounded-xl border border-white/15 px-4 py-2.5 text-sm font-medium text-white/80 hover:bg-white/10"
        >
          <Upload size={16} />
          Impor
        </button>
        <button
          type="button"
          onClick={() => {
            setSpOpen(true);
            setError("");
            setNotice("");
          }}
          className="flex items-center gap-2 rounded-xl border border-white/15 px-4 py-2.5 text-sm font-medium text-white/80 hover:bg-white/10"
        >
          <Link2 size={16} />
          Impor Spotify
        </button>
        <input ref={fileRef} type="file" accept="application/json,.json" onChange={handleImportFile} className="hidden" />
      </div>
    </div>
  );
}
