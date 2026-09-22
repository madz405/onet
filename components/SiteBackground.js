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
    // "inset-0" biasa (top/right/bottom/left semua 0) itu di banyak browser
    // HP dihitung ulang telat pas address bar collapse/muncul waktu scroll —
    // sesaat ada celah di bagian bawah yang nampakin warna di baliknya (baru
    // kelihatan pas sudah discroll, apalagi kalau tema aktif adalah video/
    // foto yang warnanya beda jauh dari gradient tema Glass). Diganti pakai
    // height "100dvh" (dynamic viewport height, otomatis ngikutin ukuran
    // layar yang benar-benar kelihatan saat itu) plus buffer ekstra di
    // atas-bawah, supaya tetap nutup penuh walau ada telat sepersekian detik.
    <div
      className="fixed inset-x-0 -z-10 overflow-hidden bg-black"
      style={{ top: "-4vh", height: "108dvh" }}
    >
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
