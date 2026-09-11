"use client";

import { Download, ExternalLink } from "lucide-react";

export default function MediaResult({ result }) {
  if (!result) return null;
  const { title, author, thumbnail, media = [] } = result;

  return (
    <div className="animate-rise space-y-4">
      {(thumbnail || title) && (
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

      {media.some((m) => m.type === "video") && (
        <video
          controls
          className="w-full rounded-xl border border-white/8 bg-black"
          src={media.find((m) => m.type === "video")?.url}
        />
      )}
      {!media.some((m) => m.type === "video") && media.some((m) => m.type === "image") && (
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
            href={m.url}
            target="_blank"
            rel="noopener noreferrer"
            download
            className="flex items-center justify-between rounded-xl border border-white/8 bg-white/5 px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-signal-500 hover:text-ink-950"
          >
            <span className="flex items-center gap-2">
              <Download size={16} />
              {m.label}
            </span>
            <ExternalLink size={14} className="opacity-60" />
          </a>
        ))}
      </div>
      <p className="text-xs text-white/40">
        Jika file tidak langsung terunduh, tautan akan terbuka di tab baru — simpan dari sana.
      </p>
    </div>
  );
}
