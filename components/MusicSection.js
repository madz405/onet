"use client";

import { useRef, useState } from "react";
import {
  Search,
  Play,
  Loader2,
  Music2,
  Trash2,
  History,
  Volume2,
  ListPlus,
  X,
} from "lucide-react";
import { makeTrackId } from "@/lib/musicHistory";
import PlaylistTab from "@/components/PlaylistTab";
import AddToPlaylistModal from "@/components/AddToPlaylistModal";
import usePlaylists from "@/lib/usePlaylists";
import { useMusicPlayer } from "@/components/MusicPlayerProvider";

const SOURCES = [
  { id: "youtube", label: "YouTube" },
  { id: "spotify", label: "Spotify" },
  { id: "soundcloud", label: "SoundCloud" },
];

function sourceLabel(id) {
  return SOURCES.find((s) => s.id === id)?.label || "YouTube";
}

function formatTime(sec) {
  if (!sec || Number.isNaN(sec) || sec < 0) return "0:00";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60)
    .toString()
    .padStart(2, "0");
  return `${m}:${s}`;
}

export default function MusicSection() {
  const [source, setSource] = useState("youtube");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  // Alur dua langkah: cari -> daftar hasil -> user memilih lagu -> baru ambil link.
  const [results, setResults] = useState([]);
  const [searchedQuery, setSearchedQuery] = useState("");
  const [resolvingUrl, setResolvingUrl] = useState(null);
  const [tab, setTab] = useState("cari"); // cari | playlist
  const pl = usePlaylists();
  const searchInputRef = useRef(null);
  const searchSeq = useRef(0); // mencegah hasil lama menimpa pencarian yang lebih baru
  // Semua state pemutaran (audio, lagu aktif, riwayat, mode, progres) ada di
  // MusicPlayerProvider supaya lagu tetap jalan saat pindah halaman.
  const {
    track,
    history,
    isPlaying,
    playbackError,
    refreshing,
    setPlaylistTarget: setAddTarget,
    playlistTarget: addTarget,
    playTrack,
    addAndPlay,
    removeFromHistory,
  } = useMusicPlayer();

  async function runSearch(src = source, text = query) {
    const q = text.trim();
    if (!q) return;
    const seq = ++searchSeq.current;
    setLoading(true);
    setError("");
    setResults([]);
    try {
      const res = await fetch("/api/music", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "search", source: src, query: q }),
      });
      const data = await res.json();
      if (seq !== searchSeq.current) return;
      if (!data.status || !Array.isArray(data.results) || !data.results.length) {
        throw new Error(data.message || "Lagu tidak ditemukan.");
      }
      setResults(data.results);
      setSearchedQuery(q);
    } catch (err) {
      if (seq === searchSeq.current) setError(err.message || "Lagu tidak ditemukan.");
    } finally {
      if (seq === searchSeq.current) setLoading(false);
    }
  }

  function handleSearch(e) {
    e.preventDefault();
    runSearch();
  }

  function changeSource(id) {
    if (id === source) return;
    setSource(id);
    setResults([]);
    setError("");
    if (query.trim()) runSearch(id, query); // hasil milik sumber lama tidak relevan lagi
    else {
      searchSeq.current++;
      setLoading(false);
    }
  }

  // Lagu dipilih dari daftar hasil: ambil link stream-nya, lalu putar.
  async function handlePick(item) {
    if (resolvingUrl) return;
    setResolvingUrl(item.url);
    setError("");
    try {
      const res = await fetch("/api/music", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "resolve", source, url: item.url, query: item.query }),
      });
      const data = await res.json();
      if (!data.status || !data.streamUrl) throw new Error(data.message || "Gagal mengambil lagu.");

      const title = item.title || data.title;
      const artist = item.artist || data.artist || "";
      addAndPlay({
        id: makeTrackId({ source, title, artist }),
        source,
        title,
        artist,
        thumbnail: item.thumbnail || data.thumbnail || null,
        streamUrl: data.streamUrl,
        query: searchedQuery,
        pageUrl: item.url, // dipakai pemutar untuk mengambil ulang link yang kedaluwarsa
        searchQuery: item.query,
        resolvedAt: Date.now(),
      });
    } catch (err) {
      setError(err.message || "Gagal mengambil lagu.");
    } finally {
      setResolvingUrl(null);
    }
  }

  // Data lagu dari satu hasil pencarian, untuk disimpan ke playlist.
  function songFromResult(r) {
    const artist = r.artist || "";
    return {
      id: makeTrackId({ source, title: r.title, artist }),
      source,
      title: r.title,
      artist,
      thumbnail: r.thumbnail || null,
      pageUrl: r.url,
      searchQuery: r.query,
      query: searchedQuery,
    };
  }

  return (
    // pb-24: ruang untuk mini player yang menempel di bawah layar selama ada lagu.
    <div className={track ? "pb-24" : ""}>
      <div className="mb-4 flex rounded-xl border border-white/10 bg-ink-900/60 p-1" role="tablist">
        {[
          { id: "cari", label: "Cari" },
          { id: "playlist", label: "Playlist" },
        ].map((t) => (
          <button
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex-1 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              tab === t.id ? "bg-signal-500 text-ink-950" : "text-white/60 hover:text-white"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "cari" && (
      <form onSubmit={handleSearch} className="flex flex-col gap-3 sm:flex-row">
        <div className="flex rounded-xl border border-white/10 bg-ink-900/60 p-1">
          {SOURCES.map((s) => (
            <button
              type="button"
              key={s.id}
              onClick={() => changeSource(s.id)}
              className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                source === s.id ? "bg-signal-500 text-ink-950" : "text-white/60 hover:text-white"
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
        <div className="relative flex-1">
          <Search size={16} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-white/40" />
          <input
            ref={searchInputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Cari judul lagu atau nama artis..."
            className="w-full rounded-xl border border-white/10 bg-ink-900/60 py-3 pl-11 pr-11 text-sm text-white placeholder:text-white/30 focus-ring"
          />
          {query && (
            <button
              type="button"
              onClick={() => {
                setQuery("");
                searchInputRef.current?.focus();
              }}
              aria-label="Hapus teks pencarian"
              title="Hapus"
              className="absolute right-2 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-full text-white/50 hover:text-white"
            >
              <X size={16} />
            </button>
          )}
        </div>
        <button
          type="submit"
          disabled={loading}
          className="flex items-center justify-center gap-2 rounded-xl bg-signal-500 px-6 py-3 text-sm font-semibold text-ink-950 disabled:opacity-60"
        >
          {loading ? <Loader2 size={16} className="animate-spin" /> : "Cari"}
        </button>
      </form>
      )}

      {refreshing && !error && (
        <p className="mt-4 flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/70">
          <Loader2 size={14} className="animate-spin" />
          Link lagu sudah kedaluwarsa, mengambil link baru...
        </p>
      )}

      {((tab === "cari" && error) || playbackError) && (
        <p className="mt-4 rounded-xl border border-flare-500/30 bg-flare-500/10 px-4 py-3 text-sm text-flare-400">
          {(tab === "cari" && error) || playbackError}
        </p>
      )}

      {tab === "cari" && loading && (
        <p className="mt-6 flex items-center gap-2 text-sm text-white/50">
          <Loader2 size={14} className="animate-spin" />
          Mencari di {sourceLabel(source)}...
        </p>
      )}

      {tab === "cari" && results.length > 0 && (
        <div className="mt-6">
          <p className="mb-3 truncate text-sm font-medium text-white/50">
            Hasil untuk &quot;{searchedQuery}&quot; di {sourceLabel(source)}
          </p>
          <div className="space-y-2">
            {results.map((r) => {
              const isCurrent = track?.pageUrl === r.url;
              const busy = resolvingUrl === r.url;
              return (
                <div
                  key={r.url}
                  className={`flex items-center gap-1 rounded-2xl border pr-2 transition-colors ${
                    isCurrent ? "border-signal-500/40 bg-signal-500/5" : "border-white/8 bg-ink-900/60 hover:bg-white/5"
                  } ${resolvingUrl && !busy ? "opacity-50" : ""}`}
                >
                  <button
                    type="button"
                    onClick={() => handlePick(r)}
                    disabled={Boolean(resolvingUrl)}
                    aria-label={`Putar ${r.title}`}
                    className="flex min-w-0 flex-1 items-center gap-3 px-3 py-2.5 text-left disabled:cursor-wait"
                  >
                    {r.thumbnail ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={r.thumbnail}
                        alt=""
                        referrerPolicy="no-referrer"
                        loading="lazy"
                        className="h-14 w-14 flex-shrink-0 rounded-xl object-cover"
                      />
                    ) : (
                      <span className="grid h-14 w-14 flex-shrink-0 place-items-center rounded-xl bg-white/5 text-white/30">
                        <Music2 size={20} />
                      </span>
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-white">{r.title}</span>
                      <span className="block truncate text-xs text-white/50">
                        {[r.artist, r.duration ? formatTime(r.duration) : null].filter(Boolean).join(" · ")}
                      </span>
                    </span>
                    <span
                      className={`grid h-10 w-10 flex-shrink-0 place-items-center rounded-full ${
                        isCurrent ? "bg-signal-500 text-ink-950" : "bg-white/10 text-white"
                      }`}
                    >
                      {busy ? (
                        <Loader2 size={16} className="animate-spin" />
                      ) : isCurrent && isPlaying ? (
                        <Volume2 size={16} />
                      ) : (
                        <Play size={16} className="ml-0.5" />
                      )}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setAddTarget(songFromResult(r))}
                    aria-label={`Tambah ${r.title} ke playlist`}
                    title="Tambah ke playlist"
                    className="grid h-9 w-9 flex-shrink-0 place-items-center rounded-full text-white/50 hover:bg-white/10 hover:text-white"
                  >
                    <ListPlus size={18} />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {tab === "cari" && !track && !error && !playbackError && history.length === 0 && results.length === 0 && !loading && (
        <div className="mt-14 flex flex-col items-center gap-3 text-center text-white/40">
          <Music2 size={32} />
          <p className="max-w-sm text-sm">
            Ketik judul lagu, pilih sumbernya, lalu tekan cari. Pilih lagu yang kamu mau dari daftar hasil,
            lalu lagunya langsung diputar dan bisa diunduh. Lagu yang dipilih tersimpan di riwayat.
          </p>
        </div>
      )}

      {tab === "playlist" && (
        <div className="mt-2">
          <PlaylistTab pl={pl} />
        </div>
      )}

      {tab === "cari" && history.length > 0 && (
        <div className="mt-10">
          <div className="mb-3 flex items-center gap-2 text-sm font-medium text-white/50">
            <History size={16} />
            Riwayat pencarian
          </div>
          <div className="space-y-2">
            {history.map((t) => (
              <div
                key={t.id}
                className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 transition-colors ${
                  track?.id === t.id ? "border-signal-500/40 bg-signal-500/5" : "border-white/8 bg-ink-900/60"
                }`}
              >
                {t.thumbnail ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={t.thumbnail}
                    alt=""
                    referrerPolicy="no-referrer"
                    className="h-11 w-11 flex-shrink-0 rounded-lg object-cover"
                  />
                ) : (
                  <span className="grid h-11 w-11 flex-shrink-0 place-items-center rounded-lg bg-white/5 text-white/30">
                    <Music2 size={16} />
                  </span>
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-white">{t.title}</p>
                  <p className="truncate text-xs text-white/40">
                    {sourceLabel(t.source)} · {t.artist}
                  </p>
                </div>
                <button
                  onClick={() => playTrack(t)}
                  className="grid h-9 w-9 flex-shrink-0 place-items-center rounded-full bg-signal-500 text-ink-950"
                  aria-label={`Putar ${t.title}`}
                >
                  <Play size={15} className="ml-0.5" />
                </button>
                <button
                  onClick={() => setAddTarget(t)}
                  className="grid h-9 w-9 flex-shrink-0 place-items-center rounded-full text-white/40 hover:bg-white/10 hover:text-white"
                  aria-label={`Tambah ${t.title} ke playlist`}
                  title="Tambah ke playlist"
                >
                  <ListPlus size={16} />
                </button>
                <button
                  onClick={() => removeFromHistory(t.id)}
                  className="grid h-9 w-9 flex-shrink-0 place-items-center rounded-full text-white/40 hover:bg-flare-500/10 hover:text-flare-400"
                  aria-label={`Hapus ${t.title} dari riwayat`}
                >
                  <Trash2 size={15} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {addTarget && <AddToPlaylistModal song={addTarget} pl={pl} onClose={() => setAddTarget(null)} />}
    </div>
  );
}
