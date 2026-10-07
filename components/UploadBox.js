"use client";

import { useEffect, useRef, useState } from "react";
import { Upload, Loader2, Copy, Check, ExternalLink } from "lucide-react";
import { EXPIRY_OPTIONS, validateUpload } from "@/lib/uploadRules";
import { uploadFileClient } from "@/lib/clientUpload";

function formatSize(bytes) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  if (bytes < 1024 ** 3) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
}

const FIELD =
  "w-full rounded-xl border border-white/10 bg-ink-950 px-4 py-3 text-sm text-white placeholder:text-white/30 focus-ring";

// Pemilih file + upload ke link. Dipakai oleh tool Uploader dan tool QR
// (mode "File / gambar"). onUploaded dipanggil dengan { url, host, notice, expiry }.
export default function UploadBox({ defaultExpiry = "24h", hint, onUploaded }) {
  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [expiry, setExpiry] = useState(defaultExpiry);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);
  const [copied, setCopied] = useState(false);
  const abortRef = useRef(null);

  useEffect(() => () => previewUrl && URL.revokeObjectURL(previewUrl), [previewUrl]);
  useEffect(() => () => abortRef.current?.abort(), []);

  function handleFile(e) {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    setResult(null);
    setError("");
    setProgress(0);
    setPreviewUrl(URL.createObjectURL(f));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!file || uploading) return;
    const invalid = validateUpload(file.name, file.size, expiry);
    if (invalid) {
      setError(invalid);
      return;
    }
    setError("");
    setResult(null);
    setProgress(0);
    setUploading(true);
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const r = await uploadFileClient(file, { expiry, onProgress: setProgress, signal: controller.signal });
      const full = { ...r, expiry };
      setResult(full);
      onUploaded?.(full);
    } catch (err) {
      setError(err.message === "abort" ? "Upload dibatalkan." : err.message || "Gagal upload file.");
    } finally {
      setUploading(false);
      abortRef.current = null;
    }
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(result.url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard ditolak: link tetap bisa disalin manual dari kolomnya */
    }
  }

  const type = file?.type || "";
  const percent = Math.round(progress * 100);

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <label className="flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed border-white/15 px-4 py-8 text-center text-sm text-white/60 hover:border-white/30 hover:text-white/80">
        <Upload size={22} />
        {file ? (
          <span className="break-all">
            {file.name} <span className="text-white/40">· {formatSize(file.size)}</span>
          </span>
        ) : (
          "Pilih gambar, video, musik, atau file lain"
        )}
        <input type="file" onChange={handleFile} className="hidden" />
      </label>

      {previewUrl && type.startsWith("image/") && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={previewUrl} alt="" className="mx-auto max-h-44 rounded-xl border border-white/10" />
      )}
      {previewUrl && type.startsWith("video/") && (
        <video controls src={previewUrl} className="max-h-52 w-full rounded-xl border border-white/10 bg-black" />
      )}
      {previewUrl && type.startsWith("audio/") && <audio controls src={previewUrl} className="w-full" />}

      <div>
        <label className="mb-1.5 block text-xs font-medium text-white/50">Masa aktif link</label>
        <select value={expiry} onChange={(e) => setExpiry(e.target.value)} className={FIELD}>
          {EXPIRY_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        {hint && <p className="mt-1.5 text-xs text-white/40">{hint}</p>}
      </div>

      {uploading ? (
        <div className="space-y-2">
          <div className="h-2 overflow-hidden rounded-full bg-white/10">
            <div className="h-full rounded-full bg-signal-500 transition-all" style={{ width: `${percent}%` }} />
          </div>
          <div className="flex items-center justify-between text-xs text-white/60">
            <span className="flex items-center gap-2">
              <Loader2 size={14} className="animate-spin" />
              {percent >= 100 ? "Menyelesaikan..." : `Mengunggah ${percent}%`}
            </span>
            <button type="button" onClick={() => abortRef.current?.abort()} className="text-flare-400 hover:underline">
              Batal
            </button>
          </div>
        </div>
      ) : (
        <button
          type="submit"
          disabled={!file}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-signal-500 px-4 py-3 text-sm font-semibold text-ink-950 transition-transform hover:scale-[1.01] disabled:opacity-50 disabled:hover:scale-100"
        >
          Upload jadi link
        </button>
      )}

      {error && (
        <p className="rounded-xl border border-flare-500/30 bg-flare-500/10 px-4 py-3 text-sm text-flare-400">{error}</p>
      )}

      {result && (
        <div className="animate-rise space-y-2 rounded-xl border border-signal-500/30 bg-signal-500/10 p-3">
          <p className="text-xs font-medium text-signal-400">Link siap dibagikan</p>
          <input readOnly value={result.url} onFocus={(e) => e.target.select()} className={FIELD} />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={copyLink}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-white/10 px-3 py-2 text-sm text-white/80 hover:bg-white/5"
            >
              {copied ? <Check size={15} /> : <Copy size={15} />}
              {copied ? "Tersalin" : "Salin link"}
            </button>
            <a
              href={result.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-white/10 px-3 py-2 text-sm text-white/80 hover:bg-white/5"
            >
              <ExternalLink size={15} />
              Buka
            </a>
          </div>
          <p className="text-xs text-white/50">
            Disimpan di {result.host}
            {result.expires ? ` · masa aktif: ${result.expires}` : ""}
          </p>
          {result.notice && <p className="text-xs text-amber-300">{result.notice}</p>}
        </div>
      )}

      <p className="text-xs text-white/40">
        Siapa pun yang punya link bisa membuka file. Jangan upload data pribadi atau rahasia.
      </p>
    </form>
  );
}
