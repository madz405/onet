"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, ChevronRight, Download, Minus, Plus, X } from "lucide-react";

// Popup pratinjau foto dengan zoom.
// - Cubit 2 jari (pinch) untuk zoom, geser 1 jari untuk menggeser foto yang
//   sedang diperbesar, ketuk 2x untuk zoom masuk/keluar.
// - Zoom 1x: geser ke kiri/kanan untuk pindah foto.
// - Tombol +/−/persen, panah, dan tombol unduh tersedia untuk yang tidak
//   nyaman pakai gestur. Di desktop: roda mouse = zoom, Esc = tutup,
//   panah kiri/kanan = pindah foto.
// Dirender lewat portal ke <body> supaya tidak terjebak di dalam modal
// (yang punya transform/overflow sendiri).

const MIN_SCALE = 1;
const MAX_SCALE = 5;
const DOUBLE_TAP_SCALE = 2.5;
const BUTTON_STEP = 1.5;

const clamp = (v, min, max) => Math.min(max, Math.max(min, v));

export default function PhotoLightbox({ photos, index, onIndexChange, onClose }) {
  const stageRef = useRef(null);
  const imgRef = useRef(null);
  const pointers = useRef(new Map());
  const gesture = useRef({ mode: null });
  const lastTap = useRef({ t: 0, x: 0, y: 0 });
  const [view, setView] = useState({ s: 1, x: 0, y: 0 });
  const viewRef = useRef(view);

  const photo = photos[index];
  const hasPrev = index > 0;
  const hasNext = index < photos.length - 1;

  // Simpan tampilan (skala + geser) dan jaga agar foto tidak bisa digeser
  // keluar layar sepenuhnya.
  const applyView = useCallback((next) => {
    const stage = stageRef.current;
    const img = imgRef.current;
    let { s, x, y } = next;
    s = clamp(s, MIN_SCALE, MAX_SCALE);
    if (stage && img) {
      const maxX = Math.max(0, (img.offsetWidth * s - stage.clientWidth) / 2);
      const maxY = Math.max(0, (img.offsetHeight * s - stage.clientHeight) / 2);
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
  }, []);

  // Koordinat layar -> koordinat relatif terhadap titik tengah area foto.
  const toStage = useCallback((cx, cy) => {
    const r = stageRef.current.getBoundingClientRect();
    return { x: cx - r.left - r.width / 2, y: cy - r.top - r.height / 2 };
  }, []);

  // Zoom dengan titik (cx, cy) tetap diam di bawah jari/kursor.
  const zoomAt = useCallback(
    (newScale, cx, cy) => {
      const { s, x, y } = viewRef.current;
      const ns = clamp(newScale, MIN_SCALE, MAX_SCALE);
      const k = ns / s;
      applyView({ s: ns, x: cx - (cx - x) * k, y: cy - (cy - y) * k });
    },
    [applyView]
  );

  const goPrev = useCallback(() => {
    if (index > 0) onIndexChange(index - 1);
  }, [index, onIndexChange]);
  const goNext = useCallback(() => {
    if (index < photos.length - 1) onIndexChange(index + 1);
  }, [index, photos.length, onIndexChange]);

  // Ganti foto -> zoom kembali ke 1x.
  useEffect(() => {
    applyView({ s: 1, x: 0, y: 0 });
    pointers.current.clear();
    gesture.current = { mode: null };
  }, [index, applyView]);

  // Muat foto sebelum/sesudahnya di latar supaya perpindahan terasa cepat.
  useEffect(() => {
    [index - 1, index + 1].forEach((i) => {
      if (photos[i]) {
        const pre = new window.Image();
        pre.referrerPolicy = "no-referrer";
        pre.src = photos[i].url;
      }
    });
  }, [index, photos]);

  // Kunci scroll halaman selama popup terbuka.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  // Keyboard. Pakai fase capture di window + stopPropagation supaya tombol Esc
  // hanya menutup popup ini, bukan ikut menutup modal downloader di belakangnya.
  useEffect(() => {
    function onKey(e) {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      } else if (e.key === "ArrowLeft") {
        goPrev();
      } else if (e.key === "ArrowRight") {
        goNext();
      } else if (e.key === "+" || e.key === "=") {
        zoomAt(viewRef.current.s * BUTTON_STEP, 0, 0);
      } else if (e.key === "-") {
        zoomAt(viewRef.current.s / BUTTON_STEP, 0, 0);
      } else if (e.key === "0") {
        applyView({ s: 1, x: 0, y: 0 });
      }
    }
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [onClose, goPrev, goNext, zoomAt, applyView]);

  function handleTap(e) {
    const now = Date.now();
    const lt = lastTap.current;
    const isDouble = now - lt.t < 300 && Math.hypot(e.clientX - lt.x, e.clientY - lt.y) < 30;
    lastTap.current = isDouble ? { t: 0, x: 0, y: 0 } : { t: now, x: e.clientX, y: e.clientY };

    if (isDouble) {
      const p = toStage(e.clientX, e.clientY);
      if (viewRef.current.s > 1.05) applyView({ s: 1, x: 0, y: 0 });
      else zoomAt(DOUBLE_TAP_SCALE, p.x, p.y);
      return;
    }

    // Ketuk area gelap di luar foto = tutup.
    const r = imgRef.current?.getBoundingClientRect();
    const inside =
      r && e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
    if (!inside) onClose();
  }

  function onPointerDown(e) {
    stageRef.current.setPointerCapture?.(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (pointers.current.size === 1) {
      gesture.current = {
        mode: "pan",
        startX: e.clientX,
        startY: e.clientY,
        startT: Date.now(),
        base: { ...viewRef.current },
        moved: false,
      };
    } else if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      gesture.current = {
        mode: "pinch",
        startDist: Math.hypot(a.x - b.x, a.y - b.y) || 1,
        startMid: toStage((a.x + b.x) / 2, (a.y + b.y) / 2),
        base: { ...viewRef.current },
        moved: true,
      };
    }
  }

  function onPointerMove(e) {
    if (!pointers.current.has(e.pointerId)) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const g = gesture.current;

    if (g.mode === "pinch" && pointers.current.size >= 2) {
      const [a, b] = [...pointers.current.values()];
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      const mid = toStage((a.x + b.x) / 2, (a.y + b.y) / 2);
      const ns = clamp((g.base.s * dist) / g.startDist, MIN_SCALE, MAX_SCALE);
      // Titik foto yang tadinya ada di bawah titik tengah dua jari harus
      // tetap berada di bawah titik tengah yang sekarang.
      const qx = (g.startMid.x - g.base.x) / g.base.s;
      const qy = (g.startMid.y - g.base.y) / g.base.s;
      applyView({ s: ns, x: mid.x - ns * qx, y: mid.y - ns * qy });
    } else if (g.mode === "pan") {
      const dx = e.clientX - g.startX;
      const dy = e.clientY - g.startY;
      if (Math.hypot(dx, dy) > 8) g.moved = true;
      if (g.base.s > 1) applyView({ s: g.base.s, x: g.base.x + dx, y: g.base.y + dy });
    }
  }

  function endPointer(e, cancelled) {
    if (!pointers.current.has(e.pointerId)) return;
    pointers.current.delete(e.pointerId);
    stageRef.current?.releasePointerCapture?.(e.pointerId);
    const g = gesture.current;

    if (g.mode === "pinch") {
      // Satu jari masih menempel: lanjut sebagai geser dari posisi sekarang.
      if (pointers.current.size === 1) {
        const [p] = [...pointers.current.values()];
        gesture.current = {
          mode: "pan",
          startX: p.x,
          startY: p.y,
          startT: Date.now(),
          base: { ...viewRef.current },
          moved: true,
        };
      } else {
        gesture.current = { mode: null };
      }
      return;
    }

    if (g.mode === "pan" && pointers.current.size === 0) {
      gesture.current = { mode: null };
      if (cancelled) return;
      const dx = e.clientX - g.startX;
      const dy = e.clientY - g.startY;
      const dt = Date.now() - g.startT;
      if (!g.moved && dt < 300) {
        handleTap(e);
      } else if (
        g.base.s <= 1 &&
        viewRef.current.s <= 1 &&
        Math.abs(dx) > 60 &&
        Math.abs(dx) > Math.abs(dy) * 1.5
      ) {
        if (dx < 0) goNext();
        else goPrev();
      }
    }
  }

  function onWheel(e) {
    const p = toStage(e.clientX, e.clientY);
    zoomAt(viewRef.current.s * (e.deltaY < 0 ? 1.15 : 1 / 1.15), p.x, p.y);
  }

  if (!photo) return null;

  return createPortal(
    <div className="lb-root" role="dialog" aria-modal="true" aria-label="Pratinjau foto">
      <div className="lb-top">
        <span className="lb-count">
          {index + 1} / {photos.length}
        </span>
        <div className="lb-group">
          {photo.download && (
            <a href={photo.download} className="lb-btn" aria-label="Unduh foto ini">
              <Download size={18} />
            </a>
          )}
          <button type="button" className="lb-btn" onClick={onClose} aria-label="Tutup">
            <X size={18} />
          </button>
        </div>
      </div>

      <div
        ref={stageRef}
        className="lb-stage"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={(e) => endPointer(e, false)}
        onPointerCancel={(e) => endPointer(e, true)}
        onWheel={onWheel}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          key={index}
          ref={imgRef}
          src={photo.url}
          alt={`Foto ${index + 1}`}
          className="lb-img"
          draggable={false}
          referrerPolicy="no-referrer"
          style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.s})` }}
        />
      </div>

      <div className="lb-bottom">
        <button type="button" className="lb-btn" onClick={goPrev} disabled={!hasPrev} aria-label="Foto sebelumnya">
          <ChevronLeft size={20} />
        </button>
        <button
          type="button"
          className="lb-btn"
          onClick={() => zoomAt(viewRef.current.s / BUTTON_STEP, 0, 0)}
          disabled={view.s <= MIN_SCALE}
          aria-label="Perkecil"
        >
          <Minus size={18} />
        </button>
        <button
          type="button"
          className="lb-btn lb-btn-wide"
          onClick={() => applyView({ s: 1, x: 0, y: 0 })}
          aria-label="Kembalikan ukuran"
        >
          {Math.round(view.s * 100)}%
        </button>
        <button
          type="button"
          className="lb-btn"
          onClick={() => zoomAt(viewRef.current.s * BUTTON_STEP, 0, 0)}
          disabled={view.s >= MAX_SCALE}
          aria-label="Perbesar"
        >
          <Plus size={18} />
        </button>
        <button type="button" className="lb-btn" onClick={goNext} disabled={!hasNext} aria-label="Foto berikutnya">
          <ChevronRight size={20} />
        </button>
      </div>
    </div>,
    document.body
  );
}
