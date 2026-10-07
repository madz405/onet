"use client";

import { useEffect, useRef, useState } from "react";
import { Upload, Loader2, Download, ChevronUp, ChevronDown, X, FileText } from "lucide-react";
import Modal from "@/components/Modal";
import { formatBytes } from "@/lib/imageTools";
import { QUALITIES, imagesToPdf, mergePdfs } from "@/lib/pdfTools";

const FIELD =
  "w-full rounded-xl border border-white/10 bg-ink-950 px-4 py-3 text-sm text-white placeholder:text-white/30 focus-ring";

const MAX_ITEMS = 50;
const MAX_TOTAL_BYTES = 200 * 1024 * 1024;

const isPdf = (f) => f.type === "application/pdf" || /\.pdf$/i.test(f.name);

export default function PdfModal({ tool, onClose }) {
  const [mode, setMode] = useState("images"); // "images" | "merge"
  const [images, setImages] = useState([]);
  const [pdfs, setPdfs] = useState([]);
  const [pageSize, setPageSize] = useState("a4");
  const [orientation, setOrientation] = useState("auto");
  const [margin, setMargin] = useState("small");
  const [quality, setQuality] = useState("medium");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState("");
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const nextId = useRef(1);
  const latest = useRef({ images, result });
  latest.current = { images, result };

  // Bersihkan object URL saat modal ditutup.
  useEffect(
    () => () => {
      latest.current.images.forEach((i) => i.thumb && URL.revokeObjectURL(i.thumb));
      if (latest.current.result) URL.revokeObjectURL(latest.current.result.url);
    },
    []
  );

  function clearResult() {
    setResult((r) => {
      if (r) URL.revokeObjectURL(r.url);
      return null;
    });
  }

  function switchMode(next) {
    if (next === mode || busy) return;
    setMode(next);
    setError("");
    clearResult();
  }

  function addFiles(e) {
    const picked = Array.from(e.target.files || []);
    e.target.value = "";
    if (!picked.length) return;
    const wanted = mode === "images" ? picked.filter((f) => f.type.startsWith("image/")) : picked.filter(isPdf);
    const list = mode === "images" ? images : pdfs;
    const room = MAX_ITEMS - list.length;
    const accepted = wanted.slice(0, Math.max(0, room));

    const notes = [];
    if (wanted.length < picked.length) {
      notes.push(mode === "images" ? "File yang bukan gambar dilewati." : "File yang bukan PDF dilewati.");
    }
    if (wanted.length > accepted.length) notes.push(`Maksimal ${MAX_ITEMS} file.`);
    const total = [...list.map((i) => i.file), ...accepted].reduce((s, f) => s + f.size, 0);
    if (total > MAX_TOTAL_BYTES) {
      setError("Total ukuran file lebih dari 200 MB, kurangi dulu supaya HP tidak kehabisan memori.");
      return;
    }
    setError(notes.join(" "));
    clearResult();

    const items = accepted.map((file) => ({
      id: nextId.current++,
      file,
      thumb: mode === "images" ? URL.createObjectURL(file) : null,
    }));
    (mode === "images" ? setImages : setPdfs)((prev) => [...prev, ...items]);
  }

  function move(index, dir) {
    const setter = mode === "images" ? setImages : setPdfs;
    setter((prev) => {
      const j = index + dir;
      if (j < 0 || j >= prev.length) return prev;
      const next = [...prev];
      [next[index], next[j]] = [next[j], next[index]];
      return next;
    });
    clearResult();
  }

  function remove(index) {
    const setter = mode === "images" ? setImages : setPdfs;
    setter((prev) => {
      prev[index]?.thumb && URL.revokeObjectURL(prev[index].thumb);
      return prev.filter((_, i) => i !== index);
    });
    clearResult();
  }

  const list = mode === "images" ? images : pdfs;
  const minItems = mode === "images" ? 1 : 2;

  async function handleSubmit(e) {
    e.preventDefault();
    if (busy || list.length < minItems) return;
    clearResult();
    setError("");
    setBusy(true);
    const onProgress = (i, n) => setProgress(`Memproses ${i} dari ${n}...`);
    await new Promise((r) => setTimeout(r, 0));
    try {
      const files = list.map((i) => i.file);
      const out =
        mode === "images"
          ? await imagesToPdf(files, { pageSize, orientation, margin, quality, onProgress })
          : await mergePdfs(files, { onProgress });
      setResult({
        url: URL.createObjectURL(out.blob),
        size: out.blob.size,
        pages: out.pages,
        name: mode === "images" ? "gambar-ke-pdf.pdf" : "gabungan.pdf",
      });
    } catch (err) {
      setError(err.message || "Gagal membuat PDF. Coba dengan file lebih sedikit atau lebih kecil.");
    } finally {
      setBusy(false);
      setProgress("");
    }
  }

  return (
    <Modal title={tool.name} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-2">
          {[
            { id: "images", label: "Gambar ke PDF" },
            { id: "merge", label: "Gabung PDF" },
          ].map((t) => (
            <button
              type="button"
              key={t.id}
              onClick={() => switchMode(t.id)}
              className={`rounded-xl border px-3 py-2 text-sm font-medium transition-colors ${
                mode === t.id
                  ? "border-signal-500 bg-signal-500/10 text-signal-400"
                  : "border-white/10 text-white/60 hover:bg-white/5"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <label className="flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed border-white/15 px-4 py-6 text-center text-sm text-white/60 hover:border-white/30 hover:text-white/80">
          <Upload size={22} />
          {mode === "images" ? "Tambah gambar" : "Tambah file PDF"}
          <input
            type="file"
            multiple
            accept={mode === "images" ? "image/*" : "application/pdf,.pdf"}
            onChange={addFiles}
            className="hidden"
          />
        </label>

        {list.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs text-white/50">
              {list.length} file · urutan di bawah = urutan halaman. Pakai panah untuk mengatur.
            </p>
            {list.map((item, i) => (
              <div key={item.id} className="flex items-center gap-2 rounded-xl border border-white/10 p-2">
                {item.thumb ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={item.thumb} alt="" className="h-10 w-10 flex-shrink-0 rounded-lg object-cover" />
                ) : (
                  <span className="grid h-10 w-10 flex-shrink-0 place-items-center rounded-lg bg-white/5 text-white/50">
                    <FileText size={18} />
                  </span>
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-white/80">
                    {i + 1}. {item.file.name}
                  </p>
                  <p className="text-xs text-white/40">{formatBytes(item.file.size)}</p>
                </div>
                <button
                  type="button"
                  onClick={() => move(i, -1)}
                  disabled={i === 0}
                  aria-label="Naikkan"
                  className="rounded-lg p-1.5 text-white/60 hover:bg-white/5 disabled:opacity-30"
                >
                  <ChevronUp size={16} />
                </button>
                <button
                  type="button"
                  onClick={() => move(i, 1)}
                  disabled={i === list.length - 1}
                  aria-label="Turunkan"
                  className="rounded-lg p-1.5 text-white/60 hover:bg-white/5 disabled:opacity-30"
                >
                  <ChevronDown size={16} />
                </button>
                <button
                  type="button"
                  onClick={() => remove(i)}
                  aria-label="Hapus"
                  className="rounded-lg p-1.5 text-flare-400 hover:bg-white/5"
                >
                  <X size={16} />
                </button>
              </div>
            ))}
          </div>
        )}

        {mode === "images" && (
          <div className="grid grid-cols-2 gap-3">
            <Select label="Ukuran halaman" value={pageSize} onChange={setPageSize}
              options={[["a4", "A4"], ["letter", "Letter"], ["fit", "Sesuai gambar"]]} />
            {pageSize !== "fit" && (
              <Select label="Orientasi" value={orientation} onChange={setOrientation}
                options={[["auto", "Otomatis"], ["portrait", "Potret"], ["landscape", "Lanskap"]]} />
            )}
            <Select label="Margin" value={margin} onChange={setMargin}
              options={[["none", "Tanpa margin"], ["small", "Kecil"], ["medium", "Sedang"]]} />
            <Select label="Kualitas gambar" value={quality} onChange={setQuality}
              options={Object.entries(QUALITIES).map(([k, v]) => [k, v.label])} />
          </div>
        )}

        <button
          type="submit"
          disabled={busy || list.length < minItems}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-signal-500 px-4 py-3 text-sm font-semibold text-ink-950 transition-transform hover:scale-[1.01] disabled:opacity-50 disabled:hover:scale-100"
        >
          {busy ? (
            <>
              <Loader2 size={16} className="animate-spin" />
              {progress || "Memproses..."}
            </>
          ) : mode === "images" ? (
            "Buat PDF"
          ) : (
            "Gabung jadi satu PDF"
          )}
        </button>
        {mode === "merge" && list.length === 1 && (
          <p className="text-xs text-white/40">Tambahkan minimal 2 file PDF untuk digabung.</p>
        )}

        {error && (
          <p className="rounded-xl border border-flare-500/30 bg-flare-500/10 px-4 py-3 text-sm text-flare-400">
            {error}
          </p>
        )}

        {result && (
          <div className="animate-rise space-y-2 rounded-xl border border-signal-500/30 bg-signal-500/10 p-3">
            <p className="text-sm text-white/80">
              PDF siap: {result.pages} halaman · {formatBytes(result.size)}
            </p>
            <a
              href={result.url}
              download={result.name}
              className="flex items-center justify-center gap-2 rounded-xl bg-signal-500 px-4 py-3 text-sm font-semibold text-ink-950 hover:scale-[1.01]"
            >
              <Download size={16} />
              Unduh PDF
            </a>
          </div>
        )}

        <p className="text-xs text-white/40">File diproses di perangkatmu dan tidak diunggah ke server.</p>
      </form>
    </Modal>
  );
}

function Select({ label, value, onChange, options }) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-medium text-white/50">{label}</label>
      <select value={value} onChange={(e) => onChange(e.target.value)} className={FIELD}>
        {options.map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </select>
    </div>
  );
}
