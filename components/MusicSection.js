"use client";

import { useEffect, useRef, useState } from "react";
import { Search, Play, Pause, Download, Loader2, Music2 } from "lucide-react";

const SOURCES = [
  { id: "youtube", label: "YouTube" },
  { id: "spotify", label: "Spotify" },
];

function formatTime(sec) {
  if (!sec || Number.isNaN(sec)) return "0:00";
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
  const [track, setTrack] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const audioRef = useRef(null);

  useEffect(() => {
    if (!track) return;
    setIsPlaying(true);
    const t = setTimeout(() => audioRef.current?.play().catch(() => {}), 50);
    return () => clearTimeout(t);
  }, [track]);

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
      setTrack(data);
    } catch (err) {
      setError(err.message || "Lagu tidak ditemukan.");
    } finally {
      setLoading(false);
    }
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

  return (
    <div className={track ? "pb-28" : ""}>
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

      {!track && !error && (
        <div className="mt-14 flex flex-col items-center gap-3 text-center text-white/40">
          <Music2 size={32} />
          <p className="max-w-sm text-sm">
            Ketik judul lagu, pilih sumbernya, lalu tekan cari. Lagu yang ketemu bisa langsung diputar
            atau diunduh.
          </p>
        </div>
      )}

      {track && (
        <div className="mt-8 animate-rise overflow-hidden rounded-3xl border border-white/8 bg-gradient-to-b from-ink-800/80 to-ink-900/40 p-6 sm:p-10">
          <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-end">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={track.thumbnail}
              alt=""
              referrerPolicy="no-referrer"
              className="h-40 w-40 flex-shrink-0 rounded-2xl object-cover shadow-glow sm:h-48 sm:w-48"
            />
            <div className="min-w-0 text-center sm:text-left">
              <p className="text-xs font-medium uppercase tracking-wide text-signal-400">
                {track.source === "spotify" ? "Spotify" : "YouTube"}
              </p>
              <h2 className="mt-1 truncate font-display text-2xl font-semibold text-white">{track.title}</h2>
              <p className="mt-1 truncate text-white/50">{track.artist}</p>
            </div>
          </div>
        </div>
      )}

      {track && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-white/10 bg-ink-900/95 backdrop-blur">
          <audio
            ref={audioRef}
            src={track.streamUrl}
            onTimeUpdate={(e) => setProgress(e.currentTarget.currentTime)}
            onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
            onEnded={() => setIsPlaying(false)}
          />
          <div className="mx-auto flex max-w-6xl items-center gap-4 px-5 py-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={track.thumbnail} alt="" className="h-11 w-11 flex-shrink-0 rounded-lg object-cover" referrerPolicy="no-referrer" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-white">{track.title}</p>
              <div className="mt-1 flex items-center gap-2">
                <span className="w-9 text-right text-[11px] tabular-nums text-white/40">{formatTime(progress)}</span>
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
                  className="h-1 flex-1 accent-signal-500"
                />
                <span className="w-9 text-[11px] tabular-nums text-white/40">{formatTime(duration)}</span>
              </div>
            </div>
            <button
              onClick={togglePlay}
              className="grid h-10 w-10 flex-shrink-0 place-items-center rounded-full bg-signal-500 text-ink-950"
              aria-label={isPlaying ? "Jeda" : "Putar"}
            >
              {isPlaying ? <Pause size={18} /> : <Play size={18} />}
            </button>
            <a
              href={track.streamUrl}
              download
              target="_blank"
              rel="noopener noreferrer"
              className="grid h-10 w-10 flex-shrink-0 place-items-center rounded-full border border-white/15 text-white/70 hover:text-white"
              aria-label="Unduh"
            >
              <Download size={16} />
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
