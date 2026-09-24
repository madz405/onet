"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { SITE_NAME, SITE_TAGLINE, SITE_LOGO } from "@/lib/site";

// Layar loading yang muncul setiap kali web dibuka / di-refresh (bukan tiap
// pindah halaman — layout.js tidak dimuat ulang saat navigasi biasa).
//
// Cara kerjanya:
// - Markup-nya ikut dirender dari server, jadi layar ini sudah menutup
//   halaman sejak frame pertama (tidak ada kedipan konten sebelum loading).
// - Progress bar naik halus sampai ±88% selama MIN_SHOW_MS, lalu menunggu
//   halaman benar-benar selesai dimuat (event "load"). Kalau halamannya
//   lambat, bar pelan-pelan merayap sampai maksimal 95% supaya tetap terasa
//   hidup, lalu lompat ke 100% begitu siap.
// - Kalau JS gagal jalan / halaman macet, CSS punya pengaman: layar ini
//   hilang sendiri setelah 12 detik (lihat .splash-root di globals.css).
//
// Warna semua ikut tema aktif (pakai variabel CSS --ink / --signal / --flare).
// Mau ubah durasi? Cukup edit 3 angka di bawah ini.
const MIN_SHOW_MS = 3800; // waktu minimal layar ini tampil
const HOLD_AT_100_MS = 300; // jeda di 100% sebelum mulai menghilang
const FADE_MS = 600; // lamanya fade-out (samakan dengan transition di CSS)
const MAX_WAIT_MS = 10000; // batas paksa selesai kalau halaman tidak kunjung "load"

function statusText(p) {
  if (p >= 100) return "Siap!";
  if (p >= 70) return "Hampir siap…";
  if (p >= 35) return "Memuat fitur…";
  return "Menyiapkan tampilan…";
}

export default function SplashLoader() {
  const [progress, setProgress] = useState(0);
  const [leaving, setLeaving] = useState(false);
  const [gone, setGone] = useState(false);

  useEffect(() => {
    const html = document.documentElement;
    const prevOverflow = html.style.overflow;
    html.style.overflow = "hidden"; // kunci scroll selama loading

    const timers = [];
    let raf = 0;
    let value = 0; // nilai halus (desimal)
    let shown = 0; // nilai bulat yang sedang ditampilkan
    let pageReady = document.readyState === "complete";
    const start = performance.now();

    const onLoad = () => {
      pageReady = true;
    };
    if (!pageReady) window.addEventListener("load", onLoad);

    function finish() {
      setProgress(100);
      timers.push(
        setTimeout(() => {
          setLeaving(true);
          html.style.overflow = prevOverflow;
          timers.push(setTimeout(() => setGone(true), FADE_MS));
        }, HOLD_AT_100_MS)
      );
    }

    function tick(now) {
      const elapsed = now - start;
      const t = Math.min(elapsed / MIN_SHOW_MS, 1);

      // Target naik cepat di awal lalu melambat (ease-out) sampai 88%.
      let target = 88 * (1 - Math.pow(1 - t, 2));
      if (elapsed > MIN_SHOW_MS) {
        // Sudah lewat waktu minimal tapi halaman belum selesai: merayap pelan.
        target = 88 + 7 * (1 - Math.exp(-(elapsed - MIN_SHOW_MS) / 3000));
      }
      if ((pageReady && elapsed >= MIN_SHOW_MS) || elapsed > MAX_WAIT_MS) {
        target = 100;
      }

      value += (target - value) * 0.14;

      if (target === 100 && value > 99.4) {
        finish();
        return;
      }

      const rounded = Math.floor(value);
      if (rounded !== shown) {
        shown = rounded;
        setProgress(rounded);
      }
      raf = requestAnimationFrame(tick);
    }
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      timers.forEach(clearTimeout);
      window.removeEventListener("load", onLoad);
      html.style.overflow = prevOverflow;
    };
  }, []);

  if (gone) return null;

  return (
    <div className={`splash-root${leaving ? " is-leaving" : ""}`} aria-hidden={leaving}>
      <div className="splash-blob splash-blob-a" />
      <div className="splash-blob splash-blob-b" />

      <div className="splash-content">
        <div className="splash-emblem">
          <span className="splash-wave" />
          <span className="splash-wave splash-wave-late" />
          <div className="splash-logo-box">
            <span className="splash-ring-track" />
            <span className="splash-ring" />
            <Image
              src={SITE_LOGO}
              alt=""
              width={96}
              height={96}
              priority
              className="splash-logo-img"
            />
          </div>
        </div>

        <p className="splash-title">{SITE_NAME}</p>
        <p className="splash-tagline">{SITE_TAGLINE}</p>

        <div className="splash-progress">
          <div className="splash-meta">
            <span>{statusText(progress)}</span>
            <span className="splash-percent">{progress}%</span>
          </div>
          <div
            className="splash-track"
            role="progressbar"
            aria-label="Memuat halaman"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={progress}
          >
            <div className="splash-fill" style={{ width: `${progress}%` }} />
          </div>
        </div>
      </div>
    </div>
  );
}
