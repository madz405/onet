"use client";

import { useEffect, useRef, useState } from "react";
import { Maximize2, Minus, Plus } from "lucide-react";

// Perbandingan Sebelum / Sesudah untuk hasil tool "hd" (lihat ToolModal.js, flag
// compare di lib/tools.js).
// - Geser pembatas (sentuh / mouse / keyboard ← →) untuk membandingkan.
// - Tombol + / − (atau Ctrl + roda mouse) untuk zoom DI DALAM slider; saat diperbesar,
//   seret gambar untuk menggeser, seret pegangan bulat untuk memindah pembatas.
// - Tombol layar penuh membuka PhotoLightbox (pratinjau + zoom cubit) lewat onZoom.
// Warna ditulis inline (bukan class text-white / bg-black) karena beberapa tema
// terang di globals.css mengubah class tersebut sehingga teks/ikon jadi tak terlihat.

const MIN_SCALE = 1;
const MAX_SCALE = 6;
const STEP = 1.5;

const clamp = (v, min, max) => Math.min(max, Math.max(min, v));

const PILL = {
  background: "rgba(0,0,0,0.68)",
  color: "#ffffff",
};
const CTRL = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  height: 34,
  minWidth: 34,
  padding: "0 10px",
  borderRadius: 999,
  border: "1px solid rgba(255,255,255,0.35)",
  background: "rgba(255,255,255,0.14)",
  color: "#ffffff",
  fontSize: 12,
  fontWeight: 600,
  cursor: "pointer",
};

export default function CompareSlider({ before, after, onZoom }) {
  const boxRef = useRef(null);
  const mode = useRef(null); // "divider" | "pan" | null
  const panStart = useRef(null);
  const viewRef = useRef({ s: 1, x: 0, y: 0 });
  const [pos, setPos] = useState(50); // posisi pembatas, 0-100 (% dari kiri)
  const [view, setView] = useState({ s: 1, x: 0, y: 0 });
  const [dims, setDims] = useState({ before: null, after: null });

  // Simpan zoom + geser; jaga agar gambar tidak bisa digeser keluar bingkai.
  function applyView(next) {
    const el = boxRef.current;
    let { s, x, y } = next;
    s = clamp(s, MIN_SCALE, MAX_SCALE);
    if (el) {
      const maxX = (el.clientWidth * (s - 1)) / 2;
      const maxY = (el.clientHeight * (s - 1)) / 2;
      x = clamp(x, -maxX, maxX);
      y = clamp(y, -maxY, maxY);
    }
    if (s <= 1) {
      x = 0;
      y = 0;
    }
    const v = { s, x, y };
    viewRef.current = v;
    setView(v);
  }

  // Zoom dengan titik (cx, cy) — relatif terhadap tengah bingkai — tetap diam.
  function zoomAt(newScale, cx = 0, cy = 0) {
    const { s, x, y } = viewRef.current;
    const ns = clamp(newScale, MIN_SCALE, MAX_SCALE);
    const k = ns / s;
    applyView({ s: ns, x: cx - (cx - x) * k, y: cy - (cy - y) * k });
  }

  // Ctrl + roda mouse / cubit trackpad = zoom di desktop (roda biasa tetap scroll halaman).
  useEffect(() => {
    const el = boxRef.current;
    if (!el) return undefined;
    function onWheel(e) {
      if (!e.ctrlKey) return;
      e.preventDefault();
      const r = el.getBoundingClientRect();
      const cx = e.clientX - r.left - r.width / 2;
      const cy = e.clientY - r.top - r.height / 2;
      zoomAt(viewRef.current.s * (e.deltaY < 0 ? 1.15 : 1 / 1.15), cx, cy);
    }
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // PENTING: ukuran dibaca LANGSUNG dari elemen gambar, baru di-set ke state. Kalau
  // e.currentTarget dibaca di dalam fungsi updater setState, nilainya sudah null saat
  // updater dijalankan dan halaman crash ("client-side exception").
  function saveSize(key, img) {
    const w = img?.naturalWidth || 0;
    const h = img?.naturalHeight || 0;
    if (!w || !h) return;
    setDims((d) => ({ ...d, [key]: { w, h } }));
  }

  function moveDivider(clientX) {
    const el = boxRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    if (!rect.width) return;
    setPos(clamp(((clientX - rect.left) / rect.width) * 100, 0, 100));
  }

  function onPointerDown(e) {
    const onHandle = !!e.target.closest?.("[data-handle]");
    e.currentTarget.setPointerCapture?.(e.pointerId);
    if (viewRef.current.s > 1.01 && !onHandle) {
      // Sedang diperbesar: seret = geser gambar.
      mode.current = "pan";
      panStart.current = { px: e.clientX, py: e.clientY, x: viewRef.current.x, y: viewRef.current.y };
    } else {
      mode.current = "divider";
      moveDivider(e.clientX);
    }
  }

  function onPointerMove(e) {
    if (mode.current === "divider") {
      moveDivider(e.clientX);
    } else if (mode.current === "pan" && panStart.current) {
      const p = panStart.current;
      applyView({ s: viewRef.current.s, x: p.x + (e.clientX - p.px), y: p.y + (e.clientY - p.py) });
    }
  }

  function endDrag(e) {
    mode.current = null;
    panStart.current = null;
    e.currentTarget.releasePointerCapture?.(e.pointerId);
  }

  function onKeyDown(e) {
    if (e.key === "ArrowLeft") setPos((p) => clamp(p - 5, 0, 100));
    else if (e.key === "ArrowRight") setPos((p) => clamp(p + 5, 0, 100));
    else if (e.key === "Home") setPos(0);
    else if (e.key === "End") setPos(100);
    else return;
    e.preventDefault();
  }

  const b = dims.before;
  const a = dims.after;
  const scale = b && a ? Math.round((a.w / b.w) * 10) / 10 : null;
  const zoomed = view.s > 1.01;
  const imgTransform = `translate(${view.x}px, ${view.y}px) scale(${view.s})`;

  return (
    <div className="space-y-2">
      <div
        ref={boxRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        className="relative mx-auto w-fit max-w-full select-none overflow-hidden rounded-lg"
        style={{ touchAction: zoomed ? "none" : "pan-y", cursor: zoomed ? "grab" : "ew-resize" }}
      >
        {/* Sesudah (hasil HD) = dasar, menentukan ukuran tampilan */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={after}
          alt="Sesudah"
          draggable={false}
          onLoad={(e) => saveSize("after", e.currentTarget)}
          className="block h-auto max-h-96 w-auto max-w-full"
          style={{ transform: imgTransform, transformOrigin: "center", willChange: "transform" }}
        />

        {/* Sebelum (foto asli): pembungkus TIDAK ikut zoom dan dipotong sampai posisi
            pembatas; hanya gambar di dalamnya yang di-zoom sama persis dengan Sesudah. */}
        <div
          className="pointer-events-none absolute inset-0 overflow-hidden"
          style={{ clipPath: `inset(0 ${100 - pos}% 0 0)` }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={before}
            alt="Sebelum"
            draggable={false}
            onLoad={(e) => saveSize("before", e.currentTarget)}
            className="absolute inset-0 h-full w-full object-fill"
            style={{ transform: imgTransform, transformOrigin: "center", willChange: "transform" }}
          />
        </div>

        <span
          className="pointer-events-none absolute left-2 top-2 rounded-full px-2.5 py-1 text-[11px] font-semibold transition-opacity"
          style={{ ...PILL, opacity: pos < 18 ? 0 : 1 }}
        >
          Sebelum
        </span>
        <span
          className="pointer-events-none absolute right-2 top-2 rounded-full px-2.5 py-1 text-[11px] font-semibold transition-opacity"
          style={{ ...PILL, opacity: pos > 82 ? 0 : 1 }}
        >
          Sesudah
        </span>

        {/* Garis pembatas + pegangan */}
        <div
          className="pointer-events-none absolute inset-y-0 w-0.5 -translate-x-1/2"
          style={{ left: `${pos}%`, background: "#ffffff", boxShadow: "0 0 6px rgba(0,0,0,0.6)" }}
        />
        <div
          data-handle
          role="slider"
          tabIndex={0}
          aria-label="Pembatas sebelum dan sesudah"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(pos)}
          onKeyDown={onKeyDown}
          className="absolute top-1/2 grid h-10 w-10 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full"
          style={{ left: `${pos}%`, background: "#ffffff", color: "#111827", boxShadow: "0 2px 8px rgba(0,0,0,0.5)" }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M9 7l-5 5 5 5" />
            <path d="M15 7l5 5-5 5" />
          </svg>
        </div>
      </div>

      {/* Kontrol zoom */}
      <div className="flex flex-wrap items-center justify-center gap-2">
        <button
          type="button"
          style={{ ...CTRL, opacity: view.s <= MIN_SCALE ? 0.45 : 1 }}
          onClick={() => zoomAt(view.s / STEP)}
          disabled={view.s <= MIN_SCALE}
          aria-label="Perkecil"
        >
          <Minus size={16} />
        </button>
        <button
          type="button"
          style={{ ...CTRL, minWidth: 64 }}
          onClick={() => applyView({ s: 1, x: 0, y: 0 })}
          aria-label="Reset zoom"
          title="Ketuk untuk reset"
        >
          {Math.round(view.s * 100)}%
        </button>
        <button
          type="button"
          style={{ ...CTRL, opacity: view.s >= MAX_SCALE ? 0.45 : 1 }}
          onClick={() => zoomAt(view.s * STEP)}
          disabled={view.s >= MAX_SCALE}
          aria-label="Perbesar"
        >
          <Plus size={16} />
        </button>
        <button type="button" style={CTRL} onClick={onZoom} aria-label="Pratinjau layar penuh">
          <Maximize2 size={15} />
          <span style={{ marginLeft: 6 }}>Layar penuh</span>
        </button>
      </div>

      <p className="text-center text-[11px]" style={{ color: "rgba(255,255,255,0.75)" }}>
        {zoomed ? "Seret gambar untuk menggeser · seret pegangan bulat untuk membandingkan" : "Seret pembatas untuk membandingkan sebelum & sesudah"}
        {b && a ? (
          <>
            <br />
            Sebelum {b.w}×{b.h} · Sesudah {a.w}×{a.h}
            {scale ? ` (${scale}×)` : ""}
          </>
        ) : null}
      </p>
    </div>
  );
}
