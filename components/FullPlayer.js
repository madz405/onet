"use client";

// Pop up pemutar musik penuh: meluncur dari bawah menutupi seluruh layar, bisa
// ditutup (tombol panah bawah, Esc, atau seret ke bawah) kembali ke mini player.
// Isinya tombol-tombol yang sama dengan pemutar lama di halaman Musik (unduh,
// sebelumnya, putar/jeda, berikutnya, mode putar, progres, volume, tambah ke
// playlist), ditambah tab "Lirik" yang bergulir otomatis sesuai menit lagu.
// Dibuka lewat MiniPlayer (state playerOpen ada di MusicPlayerProvider).

import "./fullplayer.css";
import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import {
  ChevronDown,
  Download,
  ListPlus,
  Loader2,
  Music2,
  Pause,
  Play,
  Repeat,
  Repeat1,
  Shuffle,
  SkipBack,
  SkipForward,
} from "lucide-react";
import MarqueeText from "@/components/MarqueeText";
import { useMusicPlayer } from "@/components/MusicPlayerProvider";

const SOURCE_LABEL = { youtube: "YouTube", spotify: "Spotify", soundcloud: "SoundCloud" };

function formatTime(sec) {
  if (!sec || Number.isNaN(sec) || sec < 0) return "0:00";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60)
    .toString()
    .padStart(2, "0");
  return `${m}:${s}`;
}

function slug(text) {
  return (
    (text || "lagu")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "")
      .slice(0, 50) || "lagu"
  );
}

export default function FullPlayer() {
  const pathname = usePathname();
  const {
    track,
    playMode,
    isPlaying,
    progress,
    duration,
    volume,
    playbackError,
    refreshing,
    listLength,
    playerOpen,
    setPlayerOpen,
    setPlaylistTarget,
    setVolume,
    togglePlay,
    playByOffset,
    seek,
    cycleMode,
  } = useMusicPlayer();

  const [view, setView] = useState("cover"); // cover | lirik
  const [lyrics, setLyrics] = useState({ key: null, state: "idle", synced: [], plain: "", instrumental: false });
  const [retry, setRetry] = useState(0);
  const [dragY, setDragY] = useState(0);
  // Layar lebar (desktop / "situs desktop" di HP): cover & lirik tampil berdampingan.
  const [wide, setWide] = useState(false);

  const cacheRef = useRef(new Map()); // id lagu -> hasil lirik
  const fetchedKeyRef = useRef(null); // id lagu yang lirik-nya sedang/sudah diambil
  const boxRef = useRef(null);
  const lineRefs = useRef([]);
  const userScrollUntil = useRef(0);
  const scrolledOnce = useRef(false);
  const dragStart = useRef(null);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    const sync = () => setWide(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  const trackId = track?.id;
  const showLyrics = view === "lirik" || wide;
  const hasDuration = duration > 0;

  function close() {
    setPlayerOpen(false);
  }

  // Tutup kalau pindah halaman; Esc menutup; scroll halaman di belakang dikunci.
  useEffect(() => {
    setPlayerOpen(false);
  }, [pathname, setPlayerOpen]);

  useEffect(() => {
    if (!playerOpen) return;
    const onKey = (e) => e.key === "Escape" && setPlayerOpen(false);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [playerOpen, setPlayerOpen]);

  // Lagu berganti: kembali ke posisi awal daftar lirik.
  useEffect(() => {
    scrolledOnce.current = false;
    userScrollUntil.current = 0;
  }, [trackId, showLyrics, playerOpen]);

  // Ambil lirik hanya saat tab Lirik dibuka (hemat request). Menunggu durasi lagu
  // terbaca supaya versi lagu yang dipilih lebih tepat (maksimal tunggu 2,5 detik).
  useEffect(() => {
    if (!track || !showLyrics || !playerOpen) return;
    const cached = cacheRef.current.get(trackId);
    if (cached) {
      setLyrics({ key: trackId, ...cached });
      return;
    }
    if (fetchedKeyRef.current === trackId) return;

    const run = () => {
      fetchedKeyRef.current = trackId;
      setLyrics({ key: trackId, state: "loading", synced: [], plain: "", instrumental: false });
      const qs = new URLSearchParams({
        title: track.title || "",
        artist: track.artist || "",
        ...(hasDuration ? { duration: String(Math.round(duration)) } : {}),
      });
      fetch(`/api/lyrics?${qs.toString()}`)
        .then((r) => r.json())
        .then((data) => {
          if (!data?.status) throw new Error("gagal");
          const result = data.found
            ? { state: "found", synced: data.synced || [], plain: data.plain || "", instrumental: false }
            : { state: "none", synced: [], plain: "", instrumental: Boolean(data.instrumental) };
          cacheRef.current.set(trackId, result);
          setLyrics({ key: trackId, ...result });
        })
        .catch(() => {
          if (fetchedKeyRef.current === trackId) fetchedKeyRef.current = null;
          setLyrics({ key: trackId, state: "error", synced: [], plain: "", instrumental: false });
        });
    };

    if (hasDuration) {
      run();
      return;
    }
    const t = setTimeout(run, 2500);
    return () => clearTimeout(t);
  }, [trackId, showLyrics, playerOpen, hasDuration, retry]); // eslint-disable-line react-hooks/exhaustive-deps

  const current =
    lyrics.key === trackId ? lyrics : { state: showLyrics ? "loading" : "idle", synced: [], plain: "", instrumental: false };
  const synced = current.synced;

  // Baris yang sedang dinyanyikan = baris terakhir yang waktunya sudah lewat.
  const activeIdx = useMemo(() => {
    if (!synced.length) return -1;
    const t = progress + 0.2;
    let lo = 0;
    let hi = synced.length - 1;
    let ans = -1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if (synced[mid].t <= t) {
        ans = mid;
        lo = mid + 1;
      } else hi = mid - 1;
    }
    return ans;
  }, [synced, progress]);

  // Gulirkan baris aktif ke tengah. Berhenti 3,5 detik kalau user menggulir sendiri.
  useEffect(() => {
    if (!showLyrics || !playerOpen || activeIdx < 0) return;
    if (Date.now() < userScrollUntil.current) return;
    const box = boxRef.current;
    const el = lineRefs.current[activeIdx];
    if (!box || !el) return;
    box.scrollTo({
      top: el.offsetTop - box.clientHeight / 2 + el.offsetHeight / 2,
      behavior: scrolledOnce.current ? "smooth" : "auto",
    });
    scrolledOnce.current = true;
  }, [activeIdx, showLyrics, playerOpen, current.state]);

  if (!track) return null;

  const ModeIcon = playMode === "repeat" ? Repeat1 : playMode === "shuffle" ? Shuffle : Repeat;
  const modeLabel = playMode === "repeat" ? "Ulangi satu lagu" : playMode === "shuffle" ? "Acak" : "Berurutan";
  const downloadHref = `/api/fetch-media?${new URLSearchParams({
    url: track.streamUrl,
    filename: `${slug(track.title)}.mp3`,
  }).toString()}`;

  // Seret panel header ke bawah untuk menutup.
  const touch = {
    onTouchStart: (e) => {
      dragStart.current = e.touches[0].clientY;
    },
    onTouchMove: (e) => {
      if (dragStart.current == null) return;
      setDragY(Math.max(0, e.touches[0].clientY - dragStart.current));
    },
    onTouchEnd: () => {
      if (dragY > 110) close();
      dragStart.current = null;
      setDragY(0);
    },
  };

  const holdAutoScroll = () => {
    userScrollUntil.current = Date.now() + 3500;
  };

  return (
    <div
      className="fullplayer"
      data-open={playerOpen ? "true" : "false"}
      aria-hidden={!playerOpen}
      role="dialog"
      aria-label="Pemutar musik"
      style={dragY > 0 ? { transform: `translateY(${dragY}px)`, transition: "none" } : undefined}
    >
      {track.thumbnail && (
        <div className="fp-bg" aria-hidden="true">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={track.thumbnail} alt="" referrerPolicy="no-referrer" />
        </div>
      )}

      <div className="fp-body">
        <div {...touch} className="flex-shrink-0 touch-pan-x">
          <div className="flex items-center justify-between gap-2 px-4 pt-[calc(0.75rem+env(safe-area-inset-top,0px))] md:px-8 md:pt-[calc(1.25rem+env(safe-area-inset-top,0px))]">
            <button
              type="button"
              onClick={close}
              className="grid h-11 w-11 place-items-center rounded-full text-white/80 hover:bg-white/10 hover:text-white"
              aria-label="Tutup pemutar penuh"
              title="Tutup"
            >
              <ChevronDown size={28} />
            </button>
            <div className="min-w-0 text-center">
              <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-white/50">Sedang diputar</p>
              <p className="truncate text-sm font-medium text-white">{SOURCE_LABEL[track.source] || "YouTube"}</p>
            </div>
            <button
              type="button"
              onClick={() => setPlaylistTarget(track)}
              aria-label="Tambah ke playlist"
              title="Tambah ke playlist"
              className="grid h-11 w-11 place-items-center rounded-full text-white/60 hover:bg-white/10 hover:text-white"
            >
              <ListPlus size={22} />
            </button>
          </div>

          <div className="mx-auto mt-2 flex w-56 rounded-xl md:hidden border border-white/10 bg-white/5 p-1" role="tablist">
            {[
              { id: "cover", label: "Cover" },
              { id: "lirik", label: "Lirik" },
            ].map((t) => (
              <button
                type="button"
                role="tab"
                key={t.id}
                aria-selected={view === t.id}
                onClick={() => setView(t.id)}
                className={`flex-1 rounded-lg px-4 py-1.5 text-sm font-medium transition-colors ${
                  view === t.id ? "bg-signal-500 text-ink-950" : "text-white/60 hover:text-white"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex min-h-0 flex-1 flex-col md:flex-row md:items-stretch md:gap-12 md:px-10 md:py-6">
          <div
            className={`min-h-0 flex-1 items-center justify-center px-8 py-4 md:flex md:flex-none md:basis-[42%] md:p-0 ${
              view === "cover" ? "flex" : "hidden"
            }`}
          >
            {track.thumbnail ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={track.thumbnail}
                alt=""
                referrerPolicy="no-referrer"
                className="fp-cover fp-cover-size aspect-square rounded-3xl object-cover"
              />
            ) : (
              <div className="fp-cover fp-cover-size grid aspect-square place-items-center rounded-3xl bg-white/5 text-white/30">
                <Music2 size={56} />
              </div>
            )}
          </div>

          <div
            ref={boxRef}
            className={`fp-lyrics relative mt-3 min-h-0 flex-1 overflow-y-auto px-6 md:mt-0 md:block md:px-2 ${
              view === "lirik" ? "block" : "hidden"
            }`}
            onTouchStart={holdAutoScroll}
            onWheel={holdAutoScroll}
            onPointerDown={holdAutoScroll}
          >
            {current.state === "loading" && (
              <p className="flex items-center justify-center gap-2 pt-24 text-sm text-white/60">
                <Loader2 size={16} className="animate-spin" />
                Memuat lirik...
              </p>
            )}

            {current.state === "none" && (
              <p className="px-4 pt-24 text-center text-base font-medium text-white/70">
                {current.instrumental ? "Lagu ini instrumental, tidak ada liriknya." : "Lirik untuk lagu ini tidak ditemukan"}
              </p>
            )}

            {current.state === "error" && (
              <div className="flex flex-col items-center gap-3 px-4 pt-24 text-center">
                <p className="text-sm text-white/70">Gagal memuat lirik.</p>
                <button
                  type="button"
                  onClick={() => setRetry((n) => n + 1)}
                  className="rounded-full bg-signal-500 px-5 py-2 text-sm font-semibold text-ink-950"
                >
                  Coba lagi
                </button>
              </div>
            )}

            {current.state === "found" && synced.length > 0 && (
              <div>
                <div className="h-[34dvh]" aria-hidden="true" />
                {synced.map((line, i) => (
                  <button
                    type="button"
                    key={`${line.t}-${i}`}
                    ref={(el) => {
                      lineRefs.current[i] = el;
                    }}
                    onClick={() => seek(line.t)}
                    data-active={i === activeIdx ? "true" : "false"}
                    className={`fp-line ${i === activeIdx ? "text-white" : i < activeIdx ? "text-white/40" : "text-white/50"}`}
                  >
                    {line.text}
                  </button>
                ))}
                <div className="h-[34dvh]" aria-hidden="true" />
              </div>
            )}

            {current.state === "found" && synced.length === 0 && current.plain && (
              <div className="pb-10 pt-4">
                <p className="mb-4 text-xs text-white/50">Lirik ini belum punya penanda waktu, jadi tidak bergulir otomatis.</p>
                <p className="whitespace-pre-line text-lg font-semibold leading-relaxed text-white">{current.plain}</p>
              </div>
            )}
          </div>
        </div>

        <div className="mx-auto w-full flex-shrink-0 px-6 md:max-w-2xl md:px-0 pb-[calc(1.25rem+env(safe-area-inset-bottom,0px))] pt-3 md:pb-[calc(2rem+env(safe-area-inset-bottom,0px))]">
          <div className="min-w-0">
            <h2 className="font-display text-xl font-semibold text-white md:text-2xl">
              <MarqueeText text={track.title} />
            </h2>
            <p className="truncate text-sm text-white/50">{track.artist}</p>
            {refreshing && !playbackError && (
              <p className="mt-1 flex items-center gap-1.5 text-xs text-white/60">
                <Loader2 size={12} className="animate-spin" />
                Link lagu kedaluwarsa, mengambil link baru...
              </p>
            )}
            {playbackError && <p className="mt-1 text-xs text-flare-400">{playbackError}</p>}
          </div>

          <div className="mt-3">
            <input
              type="range"
              min={0}
              max={duration || 0}
              value={progress}
              onChange={(e) => seek(Number(e.target.value))}
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
              disabled={listLength < 2}
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
              disabled={listLength < 2}
              className="grid h-11 w-11 place-items-center text-white/70 hover:text-white disabled:opacity-30"
              aria-label="Lagu berikutnya"
            >
              <SkipForward size={22} />
            </button>
            <button
              onClick={cycleMode}
              className={`grid h-11 w-11 place-items-center rounded-full ${
                playMode === "sequential" ? "text-white/40 hover:text-white/70" : "text-signal-400"
              }`}
              aria-label={`Mode putar: ${modeLabel}`}
              title={modeLabel}
            >
              <ModeIcon size={20} />
            </button>
          </div>

          <div className="mt-4 flex items-center gap-3">
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
      </div>
    </div>
  );
}
