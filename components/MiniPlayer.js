"use client";

// Pop up pemutar musik kecil yang menempel di atas halaman Downloader ("/"),
// Tools ("/tools"), dan Chat AI ("/chat") selama ada lagu yang sedang dimuat. Tidak tampil di
// halaman Musik (sudah punya pemutar penuh) maupun halaman lain.
// Warna/permukaan memakai token tema (ink/signal/glass), jadi otomatis
// mengikuti tema yang dipilih di ThemeSwitcher.

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Play, Pause, SkipBack, SkipForward, Music2, X } from "lucide-react";
import { useMusicPlayer } from "@/components/MusicPlayerProvider";
import MarqueeText from "@/components/MarqueeText";

const VISIBLE_ON = ["/", "/tools", "/chat"];

export default function MiniPlayer() {
  const pathname = usePathname();
  const { track, history, isPlaying, progress, duration, togglePlay, stopPlayback, playByOffset } =
    useMusicPlayer();

  if (!track || !VISIBLE_ON.includes(pathname)) return null;

  const pct = duration ? Math.min(100, (progress / duration) * 100) : 0;
  const canSkip = history.length > 1;

  return (
    // top-[72px] = tinggi navbar (h-16 = 64px) + jarak 8px. Fixed supaya tetap
    // terlihat walau halaman di-scroll; pointer-events-none di pembungkus agar
    // area kosong di kiri/kanan kartu tidak menghalangi klik ke konten.
    <div className="pointer-events-none fixed inset-x-0 top-[72px] z-30 flex justify-center px-4">
      <div className="glass-surface-solid pointer-events-auto relative w-full max-w-md animate-rise overflow-hidden rounded-2xl border border-white/10 bg-ink-900/95 shadow-glow backdrop-blur">
        <div className="flex items-center gap-3 p-2.5 pr-3">
          <Link href="/musik" className="flex min-w-0 flex-1 items-center gap-3" aria-label="Buka halaman musik">
            {track.thumbnail ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={track.thumbnail}
                alt=""
                referrerPolicy="no-referrer"
                className="h-11 w-11 flex-shrink-0 rounded-xl object-cover"
              />
            ) : (
              <span className="grid h-11 w-11 flex-shrink-0 place-items-center rounded-xl bg-white/5 text-signal-400">
                <Music2 size={18} />
              </span>
            )}
            <span className="min-w-0 flex-1">
              <MarqueeText text={track.title} className="text-sm font-medium text-white" />
              <span className="block truncate text-xs text-white/50">{track.artist}</span>
            </span>
          </Link>

          <div className="flex flex-shrink-0 items-center gap-0.5">
            <button
              onClick={() => playByOffset(-1)}
              disabled={!canSkip}
              className="grid h-9 w-9 place-items-center rounded-full text-white/70 hover:text-white disabled:opacity-30"
              aria-label="Lagu sebelumnya"
            >
              <SkipBack size={18} />
            </button>
            <button
              onClick={togglePlay}
              className="grid h-10 w-10 place-items-center rounded-full bg-signal-500 text-ink-950"
              aria-label={isPlaying ? "Jeda" : "Putar"}
            >
              {isPlaying ? <Pause size={18} /> : <Play size={18} className="ml-0.5" />}
            </button>
            <button
              onClick={() => playByOffset(1)}
              disabled={!canSkip}
              className="grid h-9 w-9 place-items-center rounded-full text-white/70 hover:text-white disabled:opacity-30"
              aria-label="Lagu berikutnya"
            >
              <SkipForward size={18} />
            </button>
            <span className="mx-0.5 h-5 w-px bg-white/10" aria-hidden="true" />
            <button
              onClick={stopPlayback}
              className="grid h-9 w-9 place-items-center rounded-full text-white/50 hover:text-white"
              aria-label="Hentikan musik"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Garis progres tipis di dasar kartu */}
        <div className="h-0.5 w-full bg-white/10">
          <div className="h-full bg-signal-500 transition-[width] duration-300" style={{ width: `${pct}%` }} />
        </div>
      </div>
    </div>
  );
}
