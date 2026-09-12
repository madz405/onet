"use client";

import { useEffect, useRef, useState } from "react";
import {
  Search,
  Play,
  Pause,
  Download,
  Loader2,
  Music2,
  RotateCcw,
  RotateCw,
  Volume1,
  Volume2,
} from "lucide-react";

const SOURCES = [
  { id: "youtube", label: "YouTube" },
  { id: "spotify", label: "Spotify" },
];

const SEEK_SECONDS = 10;

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
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const audioRef = useRef(null);

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

  function seek(delta) {
    if (!audioRef.current) return;
    const next = Math.min(Math.max(audioRef.current.currentTime + delta, 0), duration || 0);
    audioRef.current.currentTime = next;
    setProgress(next);
  }

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
        <div className="mx-auto mt-8 max-w-sm animate-rise overflow-hidden rounded-[2rem] border border-white/8 bg-ink-900/80 p-5 shadow-glow">
          <audio
            ref={audioRef}
            src={track.streamUrl}
            onTimeUpdate={(e) => setProgress(e.currentTarget.currentTime)}
            onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
            onEnded={() => setIsPlaying(false)}
          />

          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={track.thumbnail}
            alt=""
            referrerPolicy="no-referrer"
            className="aspect-square w-full rounded-2xl object-cover"
          />

          <div className="mt-4 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-medium uppercase tracking-wide text-signal-400">
                {track.source === "spotify" ? "Spotify" : "YouTube"}
              </p>
              <h2 className="mt-0.5 truncate font-display text-lg font-semibold text-white">{track.title}</h2>
              <p className="truncate text-sm text-white/50">{track.artist}</p>
            </div>
            <a
              href={downloadHref}
              className="grid h-10 w-10 flex-shrink-0 place-items-center rounded-full border border-white/15 text-white/70 hover:border-signal-500 hover:text-signal-400"
              aria-label="Unduh lagu"
            >
              <Download size={16} />
            </a>
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

          <div className="mt-3 flex items-center justify-center gap-8">
            <button
              onClick={() => seek(-SEEK_SECONDS)}
              className="relative grid h-11 w-11 place-items-center text-white/70 hover:text-white"
              aria-label={`Mundur ${SEEK_SECONDS} detik`}
            >
              <RotateCcw size={26} />
              <span className="pointer-events-none absolute text-[9px] font-semibold">{SEEK_SECONDS}</span>
            </button>
            <button
              onClick={togglePlay}
              className="grid h-14 w-14 place-items-center rounded-full bg-signal-500 text-ink-950"
              aria-label={isPlaying ? "Jeda" : "Putar"}
            >
              {isPlaying ? <Pause size={24} /> : <Play size={24} className="ml-0.5" />}
            </button>
            <button
              onClick={() => seek(SEEK_SECONDS)}
              className="relative grid h-11 w-11 place-items-center text-white/70 hover:text-white"
              aria-label={`Maju ${SEEK_SECONDS} detik`}
            >
              <RotateCw size={26} />
              <span className="pointer-events-none absolute text-[9px] font-semibold">{SEEK_SECONDS}</span>
            </button>
          </div>

          <div className="mt-5 flex items-center gap-3">
            <Volume1 size={15} className="flex-shrink-0 text-white/40" />
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={volume}
              onChange={(e) => setVolume(Number(e.target.value))}
              className="h-1 w-full accent-signal-500"
            />
            <Volume2 size={15} className="flex-shrink-0 text-white/40" />
          </div>
        </div>
      )}
    </div>
  );
}
