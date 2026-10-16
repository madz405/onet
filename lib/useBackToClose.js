"use client";

// Membuat tombol BACK (HP / browser) menutup "lapisan" tampilan di dalam satu
// halaman, mis. pop up pemutar penuh atau detail playlist, alih-alih langsung
// keluar ke halaman sebelumnya.
//
// Cara kerja: saat lapisan dibuka (active = true) ditambahkan satu entri riwayat
// (alamat tetap sama). Menekan BACK membuang entri itu dan memanggil onClose().
// Kalau lapisan ditutup lewat tombol di layar, entri tambahan itu dibuang
// otomatis supaya tombol BACK berikutnya tidak "macet" satu kali.
// Beberapa lapisan bertumpuk (detail playlist -> pemutar penuh) ditutup satu per
// satu dari yang paling atas.

import { useEffect, useRef } from "react";

const layers = []; // tumpukan lapisan yang sedang terbuka
let ignorePops = 0; // popstate yang kita picu sendiri (history.back dari kode)
let listening = false;

function onPop() {
  if (ignorePops > 0) {
    ignorePops--;
    return;
  }
  const top = layers.pop();
  if (top) {
    top.viaBack = true;
    top.close();
  }
}

export default function useBackToClose(active, onClose) {
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    if (!active) return;
    const layer = { viaBack: false, close: () => closeRef.current() };
    let pushed = false;

    // Ditunda satu tick supaya aman dari efek ganda React Strict Mode (dev).
    const timer = setTimeout(() => {
      window.history.pushState({ koyenLayer: true }, "", window.location.pathname + window.location.search);
      layers.push(layer);
      pushed = true;
      if (!listening) {
        window.addEventListener("popstate", onPop);
        listening = true;
      }
    }, 0);

    return () => {
      clearTimeout(timer);
      if (!pushed) return;
      const i = layers.indexOf(layer);
      if (i >= 0) layers.splice(i, 1);
      // Ditutup lewat tombol di layar (bukan BACK): buang entri tambahannya.
      if (!layer.viaBack && window.history.state?.koyenLayer) {
        ignorePops++;
        window.history.back();
      }
    };
  }, [active]);
}
