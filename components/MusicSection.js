"use client";

import { useEffect, useRef, useState } from "react";
import {
  Search,
  Play,
  Pause,
  Download,
  Loader2,
  Music2,
  SkipBack,
  SkipForward,
  Repeat,
  Repeat1,
  Shuffle,
  Trash2,
  History,
} from "lucide-react";
import {
  loadMusicHistory,
  addToMusicHistory,
  removeFromMusicHistory,
  makeTrackId,
} from "@/lib/musicHistory";

const SOURCES = [
  { id: "youtube", label: "YouTube" },
  { id: "spotify", label: "Spotify" },
  { id: "soundcloud", label: "SoundCloud" },
];

function sourceLabel(id) {
  return SOURCES.find((s) => s.id === id)?.label || "YouTube";
}

// Urutan siklus tombol mode tiap diklik.
const NEXT_MODE = { sequential: "repeat", repeat: "shuffle", shuffle: "sequential" };

function formatTime(sec) {
  if (!sec || Number.isNaN(sec) || sec < 0) return "0:00";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60)
    .toString()
    .padStart(2, "0");
  return `${m}:${s}`;
}

function slug(text) {
  return (text || "lagu")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 50) || "lagu";
}

export default function MusicSection() {
  const [source, setSource] = useState("youtube");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [track, setTrack] = useState(null);
  const [history, setHistory] = useState([]);
  const [playMode, setPlayMode] = useState("sequential"); // sequential | repeat | shuffle
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const audioRef = useRef(null);

  // Muat riwayat tersimpan begitu halaman dibuka (termasuk setelah refresh).
  useEffect(() => {
    setHistory(loadMusicHistory());
  }, []);

  useEffect(() => {
    if (!track) return;
    setProgress(0);
    setIsPlaying(true);
    const t = setTimeout(() => audioRef.current?.play().catch(() => {}), 50);
    return () => clearTimeout(t);
  }, [track]);

  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = volume;
  }, [volume]);

  function playTrack(t) {
    setError("");
    setTrack(t);
  }

  async function handleSearch(e) {
    e.preventDefault();
    if (!query.trim()) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/music", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source, query: query.trim() }),
      });
      const data = await res.json();
      if (!data.status || !data.streamUrl) throw new Error(data.message || "Lagu tidak ditemukan.");

      const newTrack = {
        id: makeTrackId(data),
        source: data.source,
        title: data.title,
        artist: data.artist,
        thumbnail: data.thumbnail,
        streamUrl: data.streamUrl,
      };
      setHistory((h) => addToMusicHistory(h, newTrack));
      playTrack(newTrack);
    } catch (err) {
      setError(err.message || "Lagu tidak ditemukan.");
    } finally {
      setLoading(false);
    }
  }

  function handleDeleteHistory(id) {
    setHistory((h) => removeFromMusicHistory(h, id));
  }

  function togglePlay() {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play().catch(() => {});
    }
    setIsPlaying((v) => !v);
  }

  const currentIndex = track ? history.findIndex((t) => t.id === track.id) : -1;

  function playByOffset(offset) {
    if (!history.length) return;
    const base = currentIndex === -1 ? 0 : currentIndex;
    const nextIndex = (base + offset + history.length) % history.length;
    playTrack(history[nextIndex]);
  }

  function playRandom() {
    if (!history.length) return;
    if (history.length === 1) return playTrack(history[0]);
    let idx = Math.floor(Math.random() * history.length);
    while (idx === currentIndex) idx = Math.floor(Math.random() * history.length);
    playTrack(history[idx]);
  }

  function handleEnded() {
    if (playMode === "repeat") {
      if (audioRef.current) {
        audioRef.current.currentTime = 0;
        audioRef.current.play().catch(() => {});
      }
      return;
    }
    if (playMode === "shuffle") return playRandom();
    // sequential: lanjut ke item berikutnya di riwayat, berhenti kalau sudah di ujung.
    if (currentIndex > -1 && currentIndex < history.length - 1) {
      playTrack(history[currentIndex + 1]);
    } else {
      setIsPlaying(false);
    }
  }

  const ModeIcon = playMode === "repeat" ? Repeat1 : playMode === "shuffle" ? Shuffle : Repeat;
  const modeLabel =
    playMode === "repeat" ? "Ulangi satu lagu" : playMode === "shuffle" ? "Acak" : "Berurutan";

  const downloadHref = track
    ? `/api/fetch-media?${new URLSearchParams({
        url: track.streamUrl,
        filename: `${slug(track.title)}.mp3`,
      }).toString()}`
    : "#";

  return (
    <div>
      <form onSubmit={handleSearch} className="flex flex-col gap-3 sm:flex-row">
        <div className="flex rounded-xl border border-white/10 bg-ink-900/60 p-1">
          {SOURCES.map((s) => (
            <button
              type="button"
              key={s.id}
              onClick={() => setSource(s.id)}
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
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Cari judul lagu atau nama artis..."
            className="w-full rounded-xl border border-white/10 bg-ink-900/60 py-3 pl-11 pr-4 text-sm text-white placeholder:text-white/30 focus-ring"
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="flex items-center justify-center gap-2 rounded-xl bg-signal-500 px-6 py-3 text-sm font-semibold text-ink-950 disabled:opacity-60"
        >
          {loading ? <Loader2 size={16} className="animate-spin" /> : "Cari"}
        </button>
      </form>

      {error && (
        <p className="mt-4 rounded-xl border border-flare-500/30 bg-flare-500/10 px-4 py-3 text-sm text-flare-400">
          {error}
        </p>
      )}

      {!track && !error && history.length === 0 && (
        <div className="mt-14 flex flex-col items-center gap-3 text-center text-white/40">
          <Music2 size={32} />
          <p className="max-w-sm text-sm">
            Ketik judul lagu, pilih sumbernya, lalu tekan cari. Lagu yang ketemu bisa langsung diputar
            atau diunduh, dan otomatis tersimpan di riwayat.
          </p>
        </div>
      )}

      {track && (
        <div className="mx-auto mt-8 max-w-sm animate-rise overflow-hidden rounded-[2rem] border border-white/8 bg-ink-900/80 p-5 shadow-glow">
          <audio
            ref={audioRef}
            src={track.streamUrl}
            onTimeUpdate={(e) => setProgress(e.currentTarget.currentTime)}
            onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
            onEnded={handleEnded}
            onError={() => setError("Link lagu ini sudah tidak bisa diputar, coba cari ulang.")}
          />

          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={track.thumbnail}
            alt=""
            referrerPolicy="no-referrer"
            className="aspect-square w-full rounded-2xl object-cover"
          />

          <div className="mt-4 min-w-0">
            <p className="text-xs font-medium uppercase tracking-wide text-signal-400">
              {sourceLabel(track.source)}
            </p>
            <h2 className="mt-0.5 truncate font-display text-lg font-semibold text-white">{track.title}</h2>
            <p className="truncate text-sm text-white/50">{track.artist}</p>
          </div>

          <div className="mt-4">
            <input
              type="range"
              min={0}
              max={duration || 0}
              value={progress}
              onChange={(e) => {
                const val = Number(e.target.value);
                if (audioRef.current) audioRef.current.currentTime = val;
                setProgress(val);
              }}
              className="h-1 w-full accent-signal-500"
            />
            <div className="mt-1 flex justify-between text-[11px] tabular-nums text-white/40">
              <span>{formatTime(progress)}</span>
              <span>-{formatTime((duration || 0) - progress)}</span>
            </div>
          </div>

          <div className="mt-3 flex items-center justify-center gap-4">
            <a
              href={downloadHref}
              className="grid h-11 w-11 flex-shrink-0 place-items-center rounded-full text-white/40 hover:text-white/70"
              aria-label="Unduh lagu"
              title="Unduh lagu"
            >
              <Download size={20} />
            </a>
            <button
              onClick={() => playByOffset(-1)}
              disabled={history.length < 2}
              className="grid h-11 w-11 place-items-center text-white/70 hover:text-white disabled:opacity-30"
              aria-label="Lagu sebelumnya"
            >
              <SkipBack size={22} />
            </button>
            <button
              onClick={togglePlay}
              className="grid h-14 w-14 place-items-center rounded-full bg-signal-500 text-ink-950"
              aria-label={isPlaying ? "Jeda" : "Putar"}
            >
              {isPlaying ? <Pause size={24} /> : <Play size={24} className="ml-0.5" />}
            </button>
            <button
              onClick={() => playByOffset(1)}
              disabled={history.length < 2}
              className="grid h-11 w-11 place-items-center text-white/70 hover:text-white disabled:opacity-30"
              aria-label="Lagu berikutnya"
            >
              <SkipForward size={22} />
            </button>
            <button
              onClick={() => setPlayMode((m) => NEXT_MODE[m])}
              className={`grid h-11 w-11 place-items-center rounded-full ${
                playMode === "sequential" ? "text-white/40 hover:text-white/70" : "text-signal-400"
              }`}
              aria-label={`Mode putar: ${modeLabel}`}
              title={modeLabel}
            >
              <ModeIcon size={20} />
            </button>
          </div>

          <div className="mt-5 flex items-center gap-3">
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={volume}
              onChange={(e) => setVolume(Number(e.target.value))}
              className="h-1 w-full accent-signal-500"
            />
          </div>
        </div>
      )}

      {history.length > 0 && (
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
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={t.thumbnail}
                  alt=""
                  referrerPolicy="no-referrer"
                  className="h-11 w-11 flex-shrink-0 rounded-lg object-cover"
                />
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
                  onClick={() => handleDeleteHistory(t.id)}
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
    </div>
  );
}
