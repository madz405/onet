"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { Download, Play, Pause } from "lucide-react";
import PhoneFrame from "@/components/PhoneFrame";
import { getPlatform } from "@/lib/platforms";

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
  const filename = `${result.platform}-${slug(result.title || media.label)}-${index + 1}.${extFor(
    media.type
  )}`;
  const params = new URLSearchParams({ url: media.url, filename });
  return `/api/fetch-media?${params.toString()}`;
}

export default function MediaResult({ result }) {
  const [thumbFailed, setThumbFailed] = useState(false);
  if (!result) return null;
  const { title, author, thumbnail, media = [] } = result;
  const platformInfo = getPlatform(result.platform);

  const usePhoneFrame =
    (result.platform === "tiktok" || result.platform === "instagram") &&
    media.some((m) => m.type === "image");
  const photoItems = usePhoneFrame ? media.filter((m) => m.type === "image") : [];
  const mainVideo = media.find((m) => m.type === "video");
  const mainAudio = media.find((m) => m.type === "audio");

  return (
    <div className="animate-rise space-y-4">
      {(thumbnail || title) && !usePhoneFrame && (
        <div className="flex gap-3 rounded-xl border border-white/8 bg-ink-950/60 p-3">
          {(thumbnail || platformInfo?.logo) && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={thumbnail && !thumbFailed ? thumbnail : platformInfo?.logo}
              alt=""
              className="h-16 w-16 flex-shrink-0 rounded-lg object-cover"
              referrerPolicy="no-referrer"
              onError={() => setThumbFailed(true)}
            />
          )}
          <div className="min-w-0">
            {title && <p className="break-words text-sm font-medium text-white">{title}</p>}
            {author && <p className="break-words text-xs text-white/50">{author}</p>}
          </div>
        </div>
      )}

      {media.length === 0 && (
        <p className="rounded-xl border border-white/8 bg-ink-950/60 p-4 text-sm text-white/60">
          Tidak ada media yang bisa diunduh dari link ini.
        </p>
      )}

      {usePhoneFrame && (
        <div className="flex gap-3 overflow-x-auto pb-1">
          {photoItems.map((m, i) => (
            <PhoneFrame key={i} className="w-32">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={m.url} alt="" className="aspect-[9/16] w-full object-cover" referrerPolicy="no-referrer" />
            </PhoneFrame>
          ))}
        </div>
      )}

      {!usePhoneFrame && mainVideo && (
        <video controls className="w-full rounded-xl border border-white/8 bg-black" src={mainVideo.url} />
      )}
      {!usePhoneFrame && !mainVideo && media.some((m) => m.type === "image") && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={media.find((m) => m.type === "image")?.url}
          alt=""
          className="w-full rounded-xl border border-white/8"
          referrerPolicy="no-referrer"
        />
      )}

      {/* Pemutar audio: muncul untuk hasil musik (YouTube MP3, Spotify,
          SoundCloud, Apple Music) maupun audio latar pada slide TikTok. */}
      {mainAudio && <AudioPlayer src={mainAudio.url} />}

      <div className="flex flex-col gap-2">
        {media.map((m, i) => (
          <a
            key={i}
            href={downloadHref(result, m, i)}
            className="flex items-center justify-between rounded-xl border border-white/8 bg-white/5 px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-signal-500 hover:text-ink-950"
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
