"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import Modal from "@/components/Modal";
import MediaResult from "@/components/MediaResult";

export default function DownloaderModal({ platform, onClose }) {
  const [url, setUrl] = useState("");
  const [format, setFormat] = useState("video");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!url.trim()) return;
    setLoading(true);
    setError("");
    setResult(null);
    try {
      const res = await fetch("/api/download", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ platform: platform.id, url: url.trim(), format }),
      });
      const data = await res.json();
      if (!data.status) throw new Error(data.message || "Gagal memproses link.");
      setResult(data);
    } catch (err) {
      setError(err.message || "Terjadi kesalahan.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal title={`Download dari ${platform.name}`} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-3">
        <input
          type="url"
          required
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder={platform.placeholder}
          className="w-full rounded-xl border border-white/10 bg-ink-950 px-4 py-3 text-sm text-white placeholder:text-white/30 focus-ring"
        />

        {platform.hasFormat && (
          <div className="flex gap-2">
            {["video", "audio"].map((f) => (
              <button
                type="button"
                key={f}
                onClick={() => setFormat(f)}
                className={`flex-1 rounded-xl border px-3 py-2 text-sm font-medium capitalize transition-colors ${
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

        <button
          type="submit"
          disabled={loading}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-signal-500 px-4 py-3 text-sm font-semibold text-ink-950 transition-transform hover:scale-[1.01] disabled:opacity-60 disabled:hover:scale-100"
        >
          {loading && <Loader2 size={16} className="animate-spin" />}
          {loading ? "Memproses..." : "Proses link"}
        </button>
      </form>

      {error && (
        <p className="mt-4 rounded-xl border border-flare-500/30 bg-flare-500/10 px-4 py-3 text-sm text-flare-400">
          {error}
        </p>
      )}

      {result && <div className="mt-5"><MediaResult result={result} /></div>}
    </Modal>
  );
}
