"use client";

import { useEffect, useRef, useState } from "react";
import { Upload, Loader2, Download } from "lucide-react";
import Modal from "@/components/Modal";
import { compressImage, extForMime, formatBytes } from "@/lib/imageTools";

const FIELD =
  "w-full rounded-xl border border-white/10 bg-ink-950 px-4 py-3 text-sm text-white placeholder:text-white/30 focus-ring";

const FORMATS = [
  { value: "image/jpeg", label: "JPG (paling kecil untuk foto)" },
  { value: "image/webp", label: "WebP (kecil, modern)" },
  { value: "image/png", label: "PNG (transparan, ukuran besar)" },
];
const SIZES = [
  { value: 0, label: "Ukuran asli" },
  { value: 2560, label: "2560 px" },
  { value: 1920, label: "1920 px (Full HD)" },
  { value: 1280, label: "1280 px" },
  { value: 1024, label: "1024 px" },
  { value: 800, label: "800 px" },
  { value: 640, label: "640 px" },
];
const MAX_FILES = 20;
const MAX_FILE_BYTES = 40 * 1024 * 1024;

const baseName = (name) => name.replace(/\.[^.]+$/, "") || "gambar";

export default function CompressModal({ tool, onClose }) {
  const [files, setFiles] = useState([]);
  const [mime, setMime] = useState("image/jpeg");
  const [quality, setQuality] = useState(80);
  const [maxSide, setMaxSide] = useState(0);
  const [target, setTarget] = useState("");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState("");
  const [results, setResults] = useState([]);
  const [error, setError] = useState("");
  const urlsRef = useRef([]);

  const targetKB = Math.round(Number(target)) > 0 ? Math.round(Number(target)) : 0;
  const isPng = mime === "image/png";

  function revokeAll() {
    urlsRef.current.forEach((u) => URL.revokeObjectURL(u));
    urlsRef.current = [];
  }
  useEffect(() => revokeAll, []);

  function handleFiles(e) {
    const picked = Array.from(e.target.files || []);
    e.target.value = "";
    if (!picked.length) return;
    const images = picked.filter((f) => f.type.startsWith("image/"));
    revokeAll();
    setResults([]);
    setProgress("");
    if (!images.length) {
      setFiles([]);
      setError("Pilih file gambar (JPG, PNG, WebP, dan sejenisnya).");
      return;
    }
    const tooBig = images.filter((f) => f.size > MAX_FILE_BYTES).length;
    const ok = images.filter((f) => f.size <= MAX_FILE_BYTES).slice(0, MAX_FILES);
    setFiles(ok);
    const notes = [];
    if (images.length < picked.length) notes.push("File yang bukan gambar dilewati.");
    if (tooBig) notes.push(`${tooBig} gambar lebih dari 40 MB dilewati.`);
    if (images.length - tooBig > MAX_FILES) notes.push(`Maksimal ${MAX_FILES} gambar sekali proses.`);
    setError(notes.join(" "));
  }

  async function handleCompress(e) {
    e.preventDefault();
    if (!files.length || busy) return;
    revokeAll();
    setResults([]);
    setError("");
    setBusy(true);
    const out = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      setProgress(`Memproses ${i + 1} dari ${files.length}...`);
      // Beri kesempatan browser menggambar ulang antar file supaya halaman tidak macet.
      await new Promise((r) => setTimeout(r, 0));
      try {
        const r = await compressImage(file, { mime, quality: quality / 100, maxSide, targetKB });
        const url = URL.createObjectURL(r.blob);
        urlsRef.current.push(url);
        out.push({
          id: `${i}-${file.name}`,
          name: `${baseName(file.name)}-kompres.${extForMime(r.blob.type)}`,
          original: file.size,
          size: r.blob.size,
          w: r.w,
          h: r.h,
          ok: r.ok,
          url,
        });
      } catch (err) {
        out.push({ id: `${i}-${file.name}`, name: file.name, error: err.message || "Gagal memproses gambar." });
      }
      setResults([...out]);
    }
    setProgress("");
    setBusy(false);
  }

  function downloadAll() {
    results
      .filter((r) => r.url)
      .forEach((r, i) =>
        setTimeout(() => {
          const a = Object.assign(document.createElement("a"), { href: r.url, download: r.name });
          a.click();
        }, i * 300)
      );
  }

  const done = results.filter((r) => r.url);

  return (
    <Modal title={tool.name} onClose={onClose}>
      <form onSubmit={handleCompress} className="space-y-4">
        <label className="flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed border-white/15 px-4 py-8 text-center text-sm text-white/60 hover:border-white/30 hover:text-white/80">
          <Upload size={22} />
          {files.length
            ? `${files.length} gambar dipilih (${formatBytes(files.reduce((s, f) => s + f.size, 0))})`
            : "Pilih satu atau beberapa gambar"}
          <input type="file" accept="image/*" multiple onChange={handleFiles} className="hidden" />
        </label>

        <div>
          <label className="mb-1.5 block text-xs font-medium text-white/50">Format hasil</label>
          <select value={mime} onChange={(e) => setMime(e.target.value)} className={FIELD}>
            {FORMATS.map((f) => (
              <option key={f.value} value={f.value}>
                {f.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-medium text-white/50">Ukuran sisi terpanjang</label>
          <select value={maxSide} onChange={(e) => setMaxSide(Number(e.target.value))} className={FIELD}>
            {SIZES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-medium text-white/50">
            Target ukuran file (KB, opsional)
          </label>
          <input
            type="number"
            inputMode="numeric"
            min="1"
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            placeholder="Contoh: 200"
            className={FIELD}
          />
          <p className="mt-1.5 text-xs text-white/40">
            {isPng && targetKB
              ? "PNG tidak punya pengaturan kualitas, jadi gambar akan diperkecil bertahap sampai muat."
              : "Kualitas diturunkan otomatis sampai ukuran di bawah target. Kalau masih besar, gambar diperkecil."}
          </p>
        </div>

        {!isPng && !targetKB && (
          <div>
            <label className="mb-1.5 flex justify-between text-xs font-medium text-white/50">
              <span>Kualitas</span>
              <span>{quality}%</span>
            </label>
            <input
              type="range"
              min="40"
              max="95"
              value={quality}
              onChange={(e) => setQuality(Number(e.target.value))}
              className="w-full accent-signal-500"
            />
          </div>
        )}

        <button
          type="submit"
          disabled={!files.length || busy}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-signal-500 px-4 py-3 text-sm font-semibold text-ink-950 transition-transform hover:scale-[1.01] disabled:opacity-50 disabled:hover:scale-100"
        >
          {busy ? (
            <>
              <Loader2 size={16} className="animate-spin" />
              {progress}
            </>
          ) : (
            "Kompres gambar"
          )}
        </button>

        {error && (
          <p className="rounded-xl border border-flare-500/30 bg-flare-500/10 px-4 py-3 text-sm text-flare-400">
            {error}
          </p>
        )}

        {results.length > 0 && (
          <div className="animate-rise space-y-2">
            {results.map((r) =>
              r.error ? (
                <p key={r.id} className="rounded-xl border border-flare-500/30 bg-flare-500/10 px-3 py-2 text-xs text-flare-400">
                  {r.name}: {r.error}
                </p>
              ) : (
                <div key={r.id} className="rounded-xl border border-white/10 p-3">
                  <p className="truncate text-sm text-white/80">{r.name}</p>
                  <p className="mt-0.5 text-xs text-white/50">
                    {formatBytes(r.original)} → {formatBytes(r.size)} ·{" "}
                    {r.size < r.original ? `hemat ${Math.round((1 - r.size / r.original) * 100)}%` : "tidak lebih kecil"} ·{" "}
                    {r.w}×{r.h}
                  </p>
                  {r.ok === false && (
                    <p className="mt-1 text-xs text-amber-300">
                      Target {targetKB} KB belum tercapai, ini hasil terkecil yang bisa dibuat.
                    </p>
                  )}
                  {r.size >= r.original && (
                    <p className="mt-1 text-xs text-amber-300">
                      Gambar ini sudah cukup kecil. Pakai file aslinya, atau turunkan kualitas dan ukurannya.
                    </p>
                  )}
                  <a
                    href={r.url}
                    download={r.name}
                    className="mt-2 flex items-center justify-center gap-2 rounded-xl border border-white/10 px-3 py-2 text-sm text-white/80 hover:bg-white/5"
                  >
                    <Download size={15} />
                    Unduh
                  </a>
                </div>
              )
            )}
            {done.length > 1 && !busy && (
              <button
                type="button"
                onClick={downloadAll}
                className="w-full rounded-xl bg-signal-500 px-4 py-3 text-sm font-semibold text-ink-950 hover:scale-[1.01]"
              >
                Unduh semua ({done.length})
              </button>
            )}
          </div>
        )}

        <p className="text-xs text-white/40">Gambar diproses di perangkatmu dan tidak diunggah ke server.</p>
      </form>
    </Modal>
  );
}
