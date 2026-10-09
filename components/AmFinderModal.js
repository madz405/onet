"use client";

import { useState } from "react";
import { Loader2, ExternalLink, Copy, Check, Eye, Heart, MessageCircle, Share2 } from "lucide-react";
import Modal from "@/components/Modal";

const FIELD =
  "w-full rounded-xl border border-white/10 bg-ink-950 px-4 py-3 text-sm text-white placeholder:text-white/30 focus-ring";

const fmt = (n) => Number(n || 0).toLocaleString("id-ID");

function Stat({ icon: Icon, value }) {
  return (
    <span className="flex items-center gap-1 text-xs text-white/50">
      <Icon size={13} />
      {fmt(value)}
    </span>
  );
}

export default function AmFinderModal({ tool, onClose }) {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);
  const [videoFailed, setVideoFailed] = useState(false);
  const [copied, setCopied] = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!url.trim()) {
      setError("Tempel link TikTok-nya dulu.");
      return;
    }
    setLoading(true);
    setError("");
    setResult(null);
    setVideoFailed(false);
    try {
      const res = await fetch("/api/tools/amfinder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim() }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.status) throw new Error(data?.message || "Gagal mencari preset.");
      setResult(data);
    } catch (err) {
      setError(err.message || "Terjadi kesalahan.");
    } finally {
      setLoading(false);
    }
  }

  async function copyLink(link, key) {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(key);
      setTimeout(() => setCopied(null), 1800);
    } catch {
      // clipboard bisa diblokir browser; tombol "Buka" tetap bisa dipakai
    }
  }

  const v = result?.video;

  return (
    <Modal title={tool.name} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <label className="mb-1.5 block text-xs font-medium text-white/50">Link video TikTok</label>
          <input
            type="url"
            required
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://vt.tiktok.com/..."
            className={FIELD}
          />
          <p className="mt-1.5 text-xs text-white/40">
            Kami cari link preset Alight Motion yang ditaruh di komentar video.
          </p>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-signal-500 px-4 py-3 text-sm font-semibold text-ink-950 transition-transform hover:scale-[1.01] disabled:opacity-50 disabled:hover:scale-100"
        >
          {loading && <Loader2 size={16} className="animate-spin" />}
          {loading ? "Mencari preset..." : "Cari preset"}
        </button>
      </form>

      {error && (
        <p className="mt-4 rounded-xl border border-flare-500/30 bg-flare-500/10 px-4 py-3 text-sm text-flare-400">
          {error}
        </p>
      )}

      {result && (
        <div className="mt-5 animate-rise space-y-4">
          {/* Preview video (bukan untuk diunduh) */}
          <div className="overflow-hidden rounded-2xl border border-white/10 bg-black">
            {v.previewUrl && !videoFailed ? (
              <video
                key={v.previewUrl}
                src={v.previewUrl}
                poster={result.thumbnail || undefined}
                controls
                playsInline
                preload="metadata"
                controlsList="nodownload"
                onError={() => setVideoFailed(true)}
                className="mx-auto max-h-[50vh] w-full bg-black object-contain"
              />
            ) : result.thumbnail ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={result.thumbnail}
                alt="Thumbnail video"
                referrerPolicy="no-referrer"
                className="mx-auto max-h-[50vh] w-full object-contain"
              />
            ) : null}
          </div>
          {videoFailed && v.url && (
            <p className="text-xs text-white/50">
              Preview tidak bisa diputar.{" "}
              <a href={v.url} target="_blank" rel="noopener noreferrer" className="text-signal-400 underline">
                Lihat di TikTok
              </a>
            </p>
          )}

          <div>
            {result.user && (
              <p className="text-sm font-semibold text-white">
                {result.user.displayName}
                {result.user.username && (
                  <span className="ml-1.5 font-normal text-white/40">@{result.user.username}</span>
                )}
              </p>
            )}
            {v.caption && <p className="mt-1 line-clamp-3 text-sm text-white/60">{v.caption}</p>}
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
              <Stat icon={Eye} value={v.views} />
              <Stat icon={Heart} value={v.likes} />
              <Stat icon={MessageCircle} value={v.comments} />
              <Stat icon={Share2} value={v.shares} />
            </div>
          </div>

          {/* Link preset dari komentar */}
          <div>
            <p className="mb-2 text-xs font-medium text-white/50">
              Preset ditemukan ({result.preset.items.length})
              {result.preset.isAuthor ? " · komentar dari pembuat video" : ""}
            </p>
            <div className="space-y-2">
              {result.preset.items.map((item, i) => (
                <div
                  key={`${item.url}-${i}`}
                  className="flex items-center gap-2 rounded-xl border border-white/10 bg-ink-950 p-2 pl-4"
                >
                  <span className="min-w-0 flex-1 truncate text-sm font-medium text-white">{item.label}</span>
                  <button
                    type="button"
                    onClick={() => copyLink(item.url, i)}
                    aria-label={`Salin link ${item.label}`}
                    className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-white/60 hover:bg-white/10 hover:text-white focus-ring"
                  >
                    {copied === i ? <Check size={16} className="text-signal-400" /> : <Copy size={16} />}
                  </button>
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex shrink-0 items-center gap-1.5 rounded-lg bg-signal-500 px-3 py-2 text-xs font-semibold text-ink-950 hover:scale-[1.02]"
                  >
                    <ExternalLink size={14} />
                    Buka
                  </a>
                </div>
              ))}
            </div>
            {result.scanned > 0 && (
              <p className="mt-2 text-xs text-white/40">{fmt(result.scanned)} komentar dipindai.</p>
            )}
          </div>
        </div>
      )}
    </Modal>
  );
}
