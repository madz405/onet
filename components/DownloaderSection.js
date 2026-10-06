"use client";

import { useMemo, useState } from "react";
import { Link2, Loader2, ClipboardPaste, X } from "lucide-react";
import { PLATFORMS, getPlatform } from "@/lib/platforms";
import { detectPlatformId, extractUrl } from "@/lib/detectPlatform";
import PlatformCard from "@/components/PlatformCard";
import DownloaderModal from "@/components/DownloaderModal";
import MediaResult from "@/components/MediaResult";
import TurnstileWidget from "@/components/TurnstileWidget";
import DownloadHistory from "@/components/DownloadHistory";
import { addDownloadHistory } from "@/lib/downloadHistory";

export default function DownloaderSection() {
  const [active, setActive] = useState(null);

  // Kolom link universal
  const [input, setInput] = useState("");
  const [format, setFormat] = useState("video");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);
  const [token, setToken] = useState("");
  const [tsReset, setTsReset] = useState(0);

  const detectedId = useMemo(() => detectPlatformId(input), [input]);
  const detected = detectedId ? getPlatform(detectedId) : null;
  const hasInput = input.trim().length > 0;

  // Memproses satu link. Dipakai oleh tombol "Proses link" dan tombol
  // "Unduh lagi" di riwayat (yang mengirim platform & format tersimpan).
  async function run(rawInput, opts = {}) {
    setError("");
    setResult(null);

    const url = extractUrl(rawInput);
    if (!url) {
      setError("Tempel link yang valid, misalnya https://vt.tiktok.com/...");
      return;
    }
    const platformId = opts.platformId || detectPlatformId(rawInput);
    const platform = platformId ? getPlatform(platformId) : null;
    if (!platform) {
      setError(
        "Platform dari link ini belum dikenali. Pilih platformnya manual dari daftar di bawah."
      );
      return;
    }

    if (!token) {
      setError("Verifikasi keamanan belum selesai. Tunggu sebentar lalu coba lagi.");
      return;
    }

    const usedFormat = opts.format || format;
    setLoading(true);
    try {
      const res = await fetch("/api/download", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ platform: platform.id, url, format: usedFormat, turnstileToken: token }),
      });
      const data = await res.json();
      if (!data.status) throw new Error(data.message || "Gagal memproses link.");
      setResult(data);
      addDownloadHistory({
        url,
        platform: platform.id,
        format: platform.hasFormat ? usedFormat : null,
        result: data,
      });
    } catch (err) {
      setError(err.message || "Terjadi kesalahan.");
    } finally {
      setLoading(false);
      // Token Turnstile sekali pakai: minta yang baru untuk proses berikutnya.
      setToken("");
      setTsReset((n) => n + 1);
    }
  }

  function handleSubmit(e) {
    e.preventDefault();
    run(input);
  }

  // "Unduh lagi" dari riwayat: isi kolom, gulir ke atas, lalu proses ulang.
  function reprocess(item) {
    setInput(item.url);
    if (item.format) setFormat(item.format);
    window.scrollTo({ top: 0, behavior: "smooth" });
    run(item.url, { platformId: item.platform, format: item.format || undefined });
  }

  async function handlePaste() {
    try {
      const text = await navigator.clipboard.readText();
      if (text) setInput(text);
    } catch {
      /* izin clipboard ditolak, user bisa tempel manual */
    }
  }

  function clearAll() {
    setInput("");
    setError("");
    setResult(null);
  }

  return (
    <>
      <form onSubmit={handleSubmit} className="mb-8 space-y-3">
        <div className="relative">
          <Link2 size={16} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-white/40" />
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Tempel link TikTok, Instagram, YouTube, dll..."
            inputMode="url"
            autoComplete="off"
            className="w-full rounded-xl border border-white/10 bg-ink-900/60 py-3 pl-11 pr-12 text-sm text-white placeholder:text-white/30 focus-ring"
          />
          <button
            type="button"
            onClick={hasInput ? clearAll : handlePaste}
            className="absolute right-2 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-lg text-white/40 hover:text-white/80"
            aria-label={hasInput ? "Hapus link" : "Tempel dari clipboard"}
            title={hasInput ? "Hapus" : "Tempel"}
          >
            {hasInput ? <X size={16} /> : <ClipboardPaste size={16} />}
          </button>
        </div>

        {hasInput && (
          <p className="px-1 text-xs text-white/50">
            {detected ? (
              <>
                Terdeteksi: <span className="font-semibold" style={{ color: detected.accent }}>{detected.name}</span>
              </>
            ) : (
              "Platform belum terdeteksi dari link ini."
            )}
          </p>
        )}

        {detected?.hasFormat && (
          <div className="flex gap-2">
            {["video", "audio"].map((f) => (
              <button
                type="button"
                key={f}
                onClick={() => setFormat(f)}
                className={`flex-1 rounded-xl border px-3 py-2 text-sm font-medium transition-colors ${
                  format === f
                    ? "border-signal-500 bg-signal-500/10 text-signal-400"
                    : "border-white/10 text-white/60 hover:bg-white/5"
                }`}
              >
                {f === "video" ? "Video (MP4)" : "Audio (MP3)"}
              </button>
            ))}
          </div>
        )}

        <TurnstileWidget onToken={setToken} resetKey={tsReset} />

        <button
          type="submit"
          disabled={loading}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-signal-500 px-6 py-3 text-sm font-semibold text-ink-950 disabled:opacity-60"
        >
          {loading && <Loader2 size={16} className="animate-spin" />}
          {loading ? "Memproses..." : "Proses link"}
        </button>

        {error && (
          <p className="rounded-xl border border-flare-500/30 bg-flare-500/10 px-4 py-3 text-sm text-flare-400">
            {error}
          </p>
        )}
      </form>

      {result && (
        <div className="-mt-4 mb-8">
          <MediaResult result={result} />
        </div>
      )}

      <p className="mb-3 text-sm font-medium text-white/50">Atau pilih platform manual</p>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {PLATFORMS.map((platform) => (
          <PlatformCard key={platform.id} platform={platform} onClick={() => setActive(platform)} />
        ))}
      </div>

      <DownloadHistory onReprocess={reprocess} />

      {active && <DownloaderModal platform={active} onClose={() => setActive(null)} />}
    </>
  );
}
