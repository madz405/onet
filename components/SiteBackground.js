"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { THEME_STORAGE_KEY, THEME_CHANGE_EVENT, DEFAULT_THEME, getThemeById } from "@/lib/themes";

// Menampilkan video/foto background di paling belakang (fixed, di bawah
// semua konten) kalau pilihan tema aktif jenisnya "video" atau "photo".
// Untuk tema warna solid (aurora/sunset/mint/glass), komponen ini tidak
// merender apa-apa — background solid bawaan tema di globals.css yang jalan.
export default function SiteBackground() {
  const [themeId, setThemeId] = useState(DEFAULT_THEME);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(THEME_STORAGE_KEY);
      if (saved) setThemeId(saved);
    } catch {
      // biarkan pakai default
    }

    function handleChange(e) {
      setThemeId(e.detail);
      setFailed(false);
    }
    window.addEventListener(THEME_CHANGE_EVENT, handleChange);
    return () => window.removeEventListener(THEME_CHANGE_EVENT, handleChange);
  }, []);

  const theme = getThemeById(themeId);
  if (!theme || theme.kind === "color" || failed) return null;

  // Kalau muncul pesan ini di console (F12 -> Console di browser), berarti
  // filenya belum ada / salah nama / salah folder di public/assets/backgrounds/
  // — cek juga tab Network di DevTools untuk lihat status response-nya (404
  // berarti memang belum ketemu filenya di server).
  function handleError() {
    console.error(`[SiteBackground] Gagal memuat "${theme.src}" — cek apakah file itu benar-benar ada di public${theme.src}`);
    setFailed(true);
  }

  return (
    // Ukuran & posisi lapisan ini diatur di globals.css (kelas .site-bg-layer):
    // fixed, tinggi 100lvh + bonus 12vh. Sengaja BUKAN "inset-0" dan BUKAN
    // dvh — dua-duanya ikut berubah waktu address bar HP muncul/hilang pas
    // scroll, dan ada beberapa frame di mana bagian bawah layar belum
    // tertutup lapisan ini sehingga warna gradient di belakangnya (pink/
    // oranye) kelihatan sebagai "glitch". lvh = tinggi layar terbesar, jadi
    // ukurannya tetap dan sudah menutup semua kemungkinan.
    <div className="site-bg-layer" aria-hidden="true">
      {theme.kind === "video" ? (
        <video
          key={theme.src}
          autoPlay
          muted
          loop
          playsInline
          className="h-full w-full object-cover"
          onError={handleError}
        >
          <source src={theme.src} type="video/mp4" />
        </video>
      ) : (
        <Image
          key={theme.src}
          src={theme.src}
          alt=""
          fill
          priority
          sizes="100vw"
          className="object-cover"
          onError={handleError}
        />
      )}
      {/* Lapisan gelap tipis supaya teks & kartu tetap kebaca di atas
          video/foto apa pun yang dipilih user. */}
      <div className="absolute inset-0 bg-black/40" />
    </div>
  );
}
