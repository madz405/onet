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

  return (
    <div className="fixed inset-0 -z-10 overflow-hidden bg-ink-950">
      {theme.kind === "video" ? (
        <video
          key={theme.src}
          autoPlay
          muted
          loop
          playsInline
          className="h-full w-full object-cover"
          onError={() => setFailed(true)}
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
          onError={() => setFailed(true)}
        />
      )}
      {/* Lapisan gelap tipis supaya teks & kartu tetap kebaca di atas
          video/foto apa pun yang dipilih user. */}
      <div className="absolute inset-0 bg-black/40" />
    </div>
  );
}
