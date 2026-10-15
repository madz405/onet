"use client";

// Pop up pemutar musik kecil selama ada lagu yang sedang dimuat.
// - Di halaman Downloader ("/"), Tools, Chat AI, Temp Mail, dan Dukungan: menempel
//   di ATAS halaman; mengetuk judul/cover membuka halaman Musik.
// - Di halaman Musik ("/musik"): menempel di BAWAH layar; mengetuk judul/cover
//   membuka pemutar penuh (components/FullPlayer.js, pop up dari bawah ke atas)
//   yang bisa ditutup kembali menjadi mini player ini.
// Warna/permukaan memakai token tema (ink/signal/glass), jadi otomatis
// mengikuti tema yang dipilih di ThemeSwitcher.

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Play, Pause, SkipBack, SkipForward, Music2, X } from "lucide-react";
import { useMusicPlayer } from "@/components/MusicPlayerProvider";
import MarqueeText from "@/components/MarqueeText";
import FullPlayer from "@/components/FullPlayer";

const VISIBLE_ON = ["/", "/tools", "/chat", "/tempmail", "/dukungan", "/musik"];

export default function MiniPlayer() {
  const pathname = usePathname();
  const {
    track,
    listLength,
    isPlaying,
    progress,
    duration,
    playerOpen,
    setPlayerOpen,
    togglePlay,
    stopPlayback,
    playByOffset,
  } = useMusicPlayer();

  // Pemutar penuh selalu dipasang (hanya digeser keluar layar saat tertutup)
  // supaya animasi buka/tutupnya mulus.
  const full = <FullPlayer />;

  if (!track || !VISIBLE_ON.includes(pathname)) return full;
  if (pathname === "/musik" && playerOpen) return full;

  const onMusicPage = pathname === "/musik";
  const pct = duration ? Math.min(100, (progress / duration) * 100) : 0;
  const canSkip = listLength > 1;

  const info = (
    <>
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
      <span className="min-w-0 flex-1 text-left">
        <MarqueeText text={track.title} className="text-sm font-medium text-white" />
        <span className="block truncate text-xs text-white/50">{track.artist}</span>
      </span>
    </>
  );

  return (
    <>
      {full}
      <div
        className={
          onMusicPage
            ? // Di halaman Musik: menempel di bawah layar (di atas area gesture HP).
              "pointer-events-none fixed inset-x-0 bottom-0 z-30 flex justify-center px-4 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))]"
            : // top-[72px] = tinggi navbar (h-16 = 64px) + jarak 8px. Fixed supaya tetap
              // terlihat walau halaman di-scroll; pointer-events-none di pembungkus agar
              // area kosong di kiri/kanan kartu tidak menghalangi klik ke konten.
              "pointer-events-none fixed inset-x-0 top-[72px] z-30 flex justify-center px-4"
        }
      >
        <div className="glass-surface-solid pointer-events-auto relative w-full max-w-md animate-rise overflow-hidden rounded-2xl border border-white/10 bg-ink-900/95 shadow-glow backdrop-blur">
          <div className="flex items-center gap-3 p-2.5 pr-3">
            {onMusicPage ? (
              <button
                type="button"
                onClick={() => setPlayerOpen(true)}
                className="flex min-w-0 flex-1 items-center gap-3"
                aria-label="Buka pemutar penuh"
              >
                {info}
              </button>
            ) : (
              <Link href="/musik" className="flex min-w-0 flex-1 items-center gap-3" aria-label="Buka halaman musik">
                {info}
              </Link>
            )}

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
    </>
  );
}
