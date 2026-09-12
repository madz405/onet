"use client";

import { Download } from "lucide-react";
import PhoneFrame from "@/components/PhoneFrame";

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
  if (!result) return null;
  const { title, author, thumbnail, media = [] } = result;

  const usePhoneFrame =
    (result.platform === "tiktok" || result.platform === "instagram") &&
    media.some((m) => m.type === "image");
  const photoItems = usePhoneFrame ? media.filter((m) => m.type === "image") : [];
  const mainVideo = media.find((m) => m.type === "video");

  return (
    <div className="animate-rise space-y-4">
      {(thumbnail || title) && !usePhoneFrame && (
        <div className="flex gap-3 rounded-xl border border-white/8 bg-ink-950/60 p-3">
          {thumbnail && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={thumbnail}
              alt=""
              className="h-16 w-16 flex-shrink-0 rounded-lg object-cover"
              referrerPolicy="no-referrer"
            />
          )}
          <div className="min-w-0">
            {title && <p className="truncate text-sm font-medium text-white">{title}</p>}
            {author && <p className="truncate text-xs text-white/50">{author}</p>}
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
