"use client";

import { useRef, useState } from "react";
import { ZoomIn } from "lucide-react";

// Perbandingan Sebelum / Sesudah dengan pembatas yang bisa digeser (sentuh, mouse,
// atau keyboard ← →). Dipakai hasil tool "hd" (lihat ToolModal.js, flag compare di
// lib/tools.js). Tombol kaca pembesar membuka PhotoLightbox (zoom) lewat onZoom.
export default function CompareSlider({ before, after, onZoom }) {
  const boxRef = useRef(null);
  const dragging = useRef(false);
  const [pos, setPos] = useState(50); // posisi pembatas, 0-100 (% dari kiri)
  const [dims, setDims] = useState({ before: null, after: null });

  function clamp(n) {
    return Math.min(100, Math.max(0, n));
  }

  function moveTo(clientX) {
    const el = boxRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    if (!rect.width) return;
    setPos(clamp(((clientX - rect.left) / rect.width) * 100));
  }

  function onPointerDown(e) {
    dragging.current = true;
    e.currentTarget.setPointerCapture?.(e.pointerId);
    moveTo(e.clientX);
  }

  function onPointerMove(e) {
    if (dragging.current) moveTo(e.clientX);
  }

  function endDrag(e) {
    dragging.current = false;
    e.currentTarget.releasePointerCapture?.(e.pointerId);
  }

  function onKeyDown(e) {
    if (e.key === "ArrowLeft") setPos((p) => clamp(p - 5));
    else if (e.key === "ArrowRight") setPos((p) => clamp(p + 5));
    else if (e.key === "Home") setPos(0);
    else if (e.key === "End") setPos(100);
    else return;
    e.preventDefault();
  }

  const b = dims.before;
  const a = dims.after;
  const scale = b && a ? Math.round((a.w / b.w) * 10) / 10 : null;

  return (
    <div className="space-y-2">
      <div
        ref={boxRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        className="relative mx-auto w-fit max-w-full cursor-ew-resize select-none overflow-hidden rounded-lg"
        style={{ touchAction: "pan-y" }}
      >
        {/* Sesudah (hasil HD) = dasar, menentukan ukuran tampilan */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={after}
          alt="Sesudah"
          draggable={false}
          onLoad={(e) => setDims((d) => ({ ...d, after: { w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight } }))}
          className="block h-auto max-h-96 w-auto max-w-full"
        />

        {/* Sebelum (foto asli) = lapisan atas, dipotong sampai posisi pembatas */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={before}
          alt="Sebelum"
          draggable={false}
          onLoad={(e) => setDims((d) => ({ ...d, before: { w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight } }))}
          className="pointer-events-none absolute inset-0 h-full w-full object-fill"
          style={{ clipPath: `inset(0 ${100 - pos}% 0 0)` }}
        />

        <span
          className="pointer-events-none absolute left-2 top-2 rounded-full bg-black/60 px-2.5 py-1 text-[11px] font-semibold text-white transition-opacity"
          style={{ opacity: pos < 18 ? 0 : 1 }}
        >
          Sebelum
        </span>
        <span
          className="pointer-events-none absolute right-2 top-2 rounded-full bg-black/60 px-2.5 py-1 text-[11px] font-semibold text-white transition-opacity"
          style={{ opacity: pos > 82 ? 0 : 1 }}
        >
          Sesudah
        </span>

        {/* Garis pembatas + pegangan */}
        <div
          className="pointer-events-none absolute inset-y-0 w-0.5 -translate-x-1/2 bg-white shadow-[0_0_6px_rgba(0,0,0,0.6)]"
          style={{ left: `${pos}%` }}
        />
        <div
          role="slider"
          tabIndex={0}
          aria-label="Pembatas sebelum dan sesudah"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(pos)}
          onKeyDown={onKeyDown}
          className="absolute top-1/2 grid h-9 w-9 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-white text-ink-950 shadow-lg focus-ring"
          style={{ left: `${pos}%` }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M9 7l-5 5 5 5" />
            <path d="M15 7l5 5-5 5" />
          </svg>
        </div>

        {/* Tombol zoom (membuka PhotoLightbox) */}
        <button
          type="button"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={onZoom}
          aria-label="Perbesar hasil"
          className="absolute bottom-2 right-2 grid h-9 w-9 cursor-zoom-in place-items-center rounded-full bg-black/60 text-white backdrop-blur-sm focus-ring"
        >
          <ZoomIn size={16} />
        </button>
      </div>

      {b && a && (
        <p className="text-center text-[11px] text-white/50">
          Sebelum {b.w}×{b.h} · Sesudah {a.w}×{a.h}
          {scale ? ` (${scale}×)` : ""}
        </p>
      )}
    </div>
  );
}
