"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { Download, Play, Pause, ZoomIn } from "lucide-react";
import PhotoLightbox from "@/components/PhotoLightbox";
import { getPlatform } from "@/lib/platforms";

// Platform yang hasil fotonya (slide/carousel) ditampilkan sebagai slide kotak
// + popup zoom. Douyin ikut karena bentuk datanya sama dengan TikTok.
const GALLERY_PLATFORMS = ["tiktok", "instagram", "douyin", "pixiv", "rednote"];

// Platform yang CDN-nya menolak pemutaran langsung dari browser (cek Referer /
// link http yang diblokir sebagai mixed content). Untuk platform ini pratinjau
// video diputar lewat /api/fetch-media?inline=1 (server kita yang menarik
// videonya), sama seperti tombol unduhnya yang memang sudah berhasil.
const PROXY_PREVIEW_PLATFORMS = [
  "douyin",
  "bilibili",
  "rednote",
  // Pemutar audio Spotify/SoundCloud/Apple Music juga diputar lewat server:
  // link dari scraper-nya bisa diunduh lewat server kita tapi sering ditolak
  // kalau diputar langsung oleh browser (Referer/CORS/mixed content).
  "spotify",
  "soundcloud",
  "applemusic",
];

const toHttps = (u) => (typeof u === "string" ? u.replace(/^http:\/\//i, "https://") : u);

function previewSrc(result, media) {
  if (!media?.url) return "";
  if (PROXY_PREVIEW_PLATFORMS.includes(result.platform)) {
    const params = new URLSearchParams({ url: media.url, inline: "1", type: media.type });
    return `/api/fetch-media?${params.toString()}`;
  }
  return toHttps(media.url);
}

// Gambar kecil di kartu judul. Logo platform selalu dipasang sebagai alas,
// lalu thumbnail asli ditumpuk di atasnya HANYA kalau berhasil dimuat (bukan
// gambar kosong/rusak). Jadi kalau thumbnail tidak ada, diblokir CDN, atau
// gagal dimuat, yang tampil logo platform — tidak pernah kotak kosong.
function Thumb({ thumbnail, platformInfo }) {
  const [thumbOk, setThumbOk] = useState(false);
  const [logoFailed, setLogoFailed] = useState(false);

  useEffect(() => {
    setThumbOk(false);
  }, [thumbnail]);

  const showLogo = Boolean(platformInfo?.logo) && !logoFailed;

  return (
    <div className="relative h-16 w-16 flex-shrink-0 overflow-hidden rounded-lg bg-white/5">
      {showLogo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={platformInfo.logo}
          alt=""
          className="h-full w-full object-cover"
          onError={() => setLogoFailed(true)}
        />
      ) : (
        <span className="grid h-full w-full place-items-center text-sm font-semibold text-white/60">
          {platformInfo?.mono || "?"}
        </span>
      )}
      {thumbnail && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={toHttps(thumbnail)}
          alt=""
          className={`absolute inset-0 h-full w-full object-cover transition-opacity ${
            thumbOk ? "opacity-100" : "opacity-0"
          }`}
          referrerPolicy="no-referrer"
          onLoad={(e) => setThumbOk(e.currentTarget.naturalWidth > 1)}
          onError={() => setThumbOk(false)}
        />
      )}
    </div>
  );
}

function extFor(type) {
  if (type === "video") return "mp4";
  if (type === "audio") return "mp3";
  return "jpg";
}

function slug(text) {
  return (text || "media")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 40) || "media";
}

function formatTime(sec) {
  if (!sec || Number.isNaN(sec) || sec < 0) return "0:00";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60)
    .toString()
    .padStart(2, "0");
  return `${m}:${s}`;
}

// Pemutar audio custom biar seragam sama gaya web (bukan tampilan bawaan
// browser yang polos), dipakai untuk hasil musik (YouTube MP3, Spotify,
// SoundCloud, Apple Music) maupun audio latar pada slide TikTok.
function AudioPlayer({ src }) {
  const audioRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);

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
    <div className="flex items-center gap-3 rounded-xl border border-white/8 bg-ink-950/60 p-3">
      <audio
        ref={audioRef}
        src={src}
        onTimeUpdate={(e) => setProgress(e.currentTarget.currentTime)}
        onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
        onEnded={() => setIsPlaying(false)}
      />
      <button
        onClick={togglePlay}
        className="grid h-11 w-11 flex-shrink-0 place-items-center rounded-full bg-signal-500 text-ink-950"
        aria-label={isPlaying ? "Jeda" : "Putar"}
      >
        {isPlaying ? <Pause size={18} /> : <Play size={18} className="ml-0.5" />}
      </button>
      <div className="min-w-0 flex-1">
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
          <span>{formatTime(duration)}</span>
        </div>
      </div>
    </div>
  );
}

// Semua tombol download diarahkan lewat /api/fetch-media supaya file
// langsung terunduh (lihat komentar di route tersebut untuk alasannya),
// bukan membuka tab baru seperti sebelumnya.
function downloadHref(result, media, index) {
  // Link "direct" (YouTube via browser) dibuka langsung oleh browser
  // pengunjung. Server kita tidak ikut menarik file-nya, karena IP server
  // ditolak Vidssave dan link-nya cukup dibuka sekali.
  if (media.direct) return media.url;
  // Scraper boleh menentukan nama file sendiri (media.filename), misalnya
  // TeraBox (ekstensi file bebas) atau gambar Pixiv (png/gif).
  const filename =
    media.filename ||
    `${result.platform}-${slug(result.title || media.label)}-${index + 1}.${extFor(media.type)}`;
  const params = new URLSearchParams({ url: media.url, filename });
  return `/api/fetch-media?${params.toString()}`;
}

export default function MediaResult({ result }) {
  const [lightboxAt, setLightboxAt] = useState(null);

  // Daftar foto untuk galeri + popup. Tiap foto membawa link unduhnya sendiri
  // (index-nya mengacu ke posisi di result.media, bukan di daftar foto).
  const lightboxPhotos = useMemo(() => {
    if (!result) return [];
    return (result.media || [])
      .map((m, idx) => ({ m, idx }))
      .filter(({ m }) => m.type === "image")
      .map(({ m, idx }) => ({ url: m.url, download: downloadHref(result, m, idx) }));
  }, [result]);

  // Hasil baru (link lain diproses) -> tutup popup foto kalau masih terbuka.
  useEffect(() => {
    setLightboxAt(null);
  }, [result]);

  if (!result) return null;
  const { title, author, thumbnail, media = [] } = result;
  const platformInfo = getPlatform(result.platform);

  // Hasil foto (slide TikTok / Douyin / carousel Instagram) ditampilkan sebagai slide
  // kotak yang bisa digeser (lihat .photo-slider & .photo-tile di
  // app/globals.css). Ketuk foto -> popup zoom (components/PhotoLightbox.js).
  const useGallery =
    GALLERY_PLATFORMS.includes(result.platform) && media.some((m) => m.type === "image");
  const photoItems = useGallery ? lightboxPhotos : [];
  const mainVideo = media.find((m) => m.type === "video");
  const mainAudio = media.find((m) => m.type === "audio");

  return (
    <div className="animate-rise space-y-4">
      {(thumbnail || title) && !useGallery && (
        <div className="flex gap-3 rounded-xl border border-white/8 bg-ink-950/60 p-3">
          <Thumb thumbnail={thumbnail} platformInfo={platformInfo} />
          <div className="min-w-0">
            {title && <p className="break-words text-sm font-medium text-white">{title}</p>}
            {author && <p className="break-words text-xs text-white/50">{author}</p>}
          </div>
        </div>
      )}

      {/* Judul/caption untuk hasil foto: tampil kalau ada. Kelasnya sama dengan
          kartu judul hasil video, jadi gayanya otomatis mengikuti tema aktif.
          Thumbnail tidak perlu karena semua fotonya sudah tampil di slide. */}
      {useGallery && (title || author) && (
        <div className="max-h-40 overflow-y-auto whitespace-pre-line rounded-xl border border-white/8 bg-ink-950/60 p-3">
          {title && <p className="break-words text-sm font-medium text-white">{title}</p>}
          {author && <p className="mt-1 break-words text-xs text-white/50">{author}</p>}
        </div>
      )}

      {media.length === 0 && (
        <p className="rounded-xl border border-white/8 bg-ink-950/60 p-4 text-sm text-white/60">
          Tidak ada media yang bisa diunduh dari link ini.
        </p>
      )}

      {useGallery && (
        <div className="space-y-2">
          <div className="photo-slider">
            {photoItems.map((p, i) => (
              <button
                key={i}
                type="button"
                className="photo-tile"
                onClick={() => setLightboxAt(i)}
                aria-label={`Perbesar foto ${i + 1}`}
              >
                <span className="photo-tile-num">{i + 1}</span>
                {/* Tinggi mengikuti rasio asli gambar, jadi tidak ada yang terpotong. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={toHttps(p.url)} alt="" className="photo-tile-img" loading="lazy" referrerPolicy="no-referrer" draggable={false} />
                <span className="photo-tile-zoom" aria-hidden="true">
                  <ZoomIn size={16} />
                </span>
              </button>
            ))}
          </div>
          <p className="text-xs text-white/50">Ketuk foto untuk memperbesar{photoItems.length > 1 ? ", geser untuk lihat foto lain." : "."}</p>
        </div>
      )}

      {lightboxAt !== null && (
        <PhotoLightbox
          photos={lightboxPhotos}
          index={lightboxAt}
          onIndexChange={setLightboxAt}
          onClose={() => setLightboxAt(null)}
        />
      )}

      {!useGallery && mainVideo && !mainVideo.direct && (
        <video
          key={previewSrc(result, mainVideo)}
          controls
          playsInline
          preload="metadata"
          referrerPolicy="no-referrer"
          className="w-full rounded-xl border border-white/8 bg-black"
          src={previewSrc(result, mainVideo)}
        />
      )}
      {!useGallery && !mainVideo && media.some((m) => m.type === "image") && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={toHttps(media.find((m) => m.type === "image")?.url)}
          alt=""
          className="w-full rounded-xl border border-white/8"
          referrerPolicy="no-referrer"
        />
      )}

      {/* Pemutar audio: muncul untuk hasil musik (YouTube MP3, Spotify,
          SoundCloud, Apple Music) maupun audio latar pada slide TikTok. */}
      {mainAudio && !mainAudio.direct && <AudioPlayer src={previewSrc(result, mainAudio)} />}

      <div className="flex flex-col gap-2">
        {media.map((m, i) => (
          <a
            key={i}
            href={downloadHref(result, m, i)}
            className="dl-btn flex items-center justify-between rounded-xl border border-white/8 bg-white/5 px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-signal-500 hover:text-ink-950"
          >
            <span className="flex items-center gap-2">
              <Download size={16} />
              {m.label}
            </span>
          </a>
        ))}
      </div>
    </div>
  );
}
