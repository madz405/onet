"use client";

import { useEffect, useState } from "react";
import { Palette, Video, Image as ImageIcon, Sun, Moon } from "lucide-react";
import {
  THEMES,
  DEFAULT_THEME,
  THEME_STORAGE_KEY,
  THEME_CHANGE_EVENT,
  NEU_MODES,
  NEU_MODE_STORAGE_KEY,
  getThemeById,
  isNeuTheme,
  CLAY_MODES,
  CLAY_MODE_STORAGE_KEY,
  isClayTheme,
  resolveCssTheme,
} from "@/lib/themes";

const COLOR_THEMES = THEMES.filter((t) => t.kind === "color");
const VIDEO_THEMES = THEMES.filter((t) => t.kind === "video");
const PHOTO_THEMES = THEMES.filter((t) => t.kind === "photo");
// Tab pada bagian Background (Glass): video / foto.
const BG_TABS = [
  { id: "video", label: "Video", icon: Video, items: VIDEO_THEMES },
  { id: "photo", label: "Foto", icon: ImageIcon, items: PHOTO_THEMES },
];

export default function ThemeSwitcher() {
  const [theme, setTheme] = useState(DEFAULT_THEME);
  const [open, setOpen] = useState(false);
  // Tab Background yang sedang dibuka ("video" | "photo").
  const [bgTab, setBgTab] = useState("video");

  // Pilihan Background (video/foto) hanya relevan untuk tema Glass, karena
  // background media memang numpang gaya kaca (lihat resolveCssTheme()).
  // Jadi bagian itu cuma tampil kalau tema aktifnya Glass atau salah satu
  // background media. Di aurora/mint/neobrutalism/neumorphism disembunyikan.
  const showBackgrounds = resolveCssTheme(theme) === "glass";
  const mediaActive = showBackgrounds && theme !== "glass";

  // Pilihan mode Light/Dark hanya tampil kalau tema aktifnya Neumorphism.
  const showNeuModes = isNeuTheme(theme);
  const showClayModes = isClayTheme(theme);
  const showModes = showNeuModes || showClayModes;
  const modeList = showClayModes ? CLAY_MODES : NEU_MODES;

  // Kalau background aktifnya foto/video, buka tab yang sesuai.
  useEffect(() => {
    const t = getThemeById(theme);
    if (t && (t.kind === "video" || t.kind === "photo")) setBgTab(t.kind);
  }, [theme]);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(THEME_STORAGE_KEY);
      // Abaikan pilihan lama yang sudah tidak ada (contoh: "sunset").
      if (saved && getThemeById(saved)) {
        setTheme(saved);
        // Pengaman: kalau React sempat merender ulang <html> (misalnya setelah
        // error hidrasi), atribut data-theme kembali ke default. Terapkan lagi.
        document.documentElement.setAttribute("data-theme", resolveCssTheme(saved));
      }
    } catch {
      // localStorage tidak tersedia (mode private, dll) — biarkan pakai default.
    }
  }, []);

  // keepOpen: dipakai saat memilih Glass, supaya menunya tidak menutup dan
  // pilihan Background langsung muncul di bawahnya.
  function applyTheme(id, keepOpen = false) {
    setTheme(id);
    setOpen(keepOpen);
    document.documentElement.setAttribute("data-theme", resolveCssTheme(id));
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, id);
      // Ingat mode terakhir Neumorphism, supaya klik ulang item
      // "Neumorphism" kembali ke mode yang terakhir dipakai.
      if (isNeuTheme(id)) window.localStorage.setItem(NEU_MODE_STORAGE_KEY, id);
      if (isClayTheme(id)) window.localStorage.setItem(CLAY_MODE_STORAGE_KEY, id);
    } catch {
      // abaikan kalau localStorage diblokir
    }
    // Kabari SiteBackground.js supaya video/foto ikut ganti tanpa reload.
    window.dispatchEvent(new CustomEvent(THEME_CHANGE_EVENT, { detail: id }));
  }

  // Klik item "Neumorphism": pakai mode terakhir (default Light), menu tetap
  // terbuka supaya pilihan Light/Dark langsung kelihatan.
  function pickNeumorphism() {
    let mode = "neu-light";
    try {
      const last = window.localStorage.getItem(NEU_MODE_STORAGE_KEY);
      if (isNeuTheme(last)) mode = last;
    } catch {
      // abaikan
    }
    applyTheme(mode, true);
  }

  // Sama seperti Neumorphism, untuk Claymorphism.
  function pickClaymorphism() {
    let mode = "clay-light";
    try {
      const last = window.localStorage.getItem(CLAY_MODE_STORAGE_KEY);
      if (isClayTheme(last)) mode = last;
    } catch {
      // abaikan
    }
    applyTheme(mode, true);
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="grid h-9 w-9 place-items-center rounded-lg text-white/70 hover:bg-white/5 hover:text-white focus-ring"
        aria-label="Ganti tema & background"
      >
        <Palette size={18} />
      </button>

      {open && (
        <>
          <button
            type="button"
            aria-hidden="true"
            tabIndex={-1}
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-40 cursor-default"
          />
          <div className={`glass-surface-solid glass-menu absolute right-0 top-11 z-50 max-w-[calc(100vw-2rem)] rounded-xl border border-white/10 bg-ink-900 p-2 shadow-glow ${
              showBackgrounds ? "w-72" : "w-52"
            }`}>
            <p className="px-3 py-1.5 text-[11px] font-medium uppercase tracking-wide text-white/40">
              Tema warna
            </p>
            {COLOR_THEMES.map((t) => (
              <button
                key={t.id}
                onClick={() => {
                  if (t.id === "neu-light") pickNeumorphism();
                  else if (t.id === "clay-light") pickClaymorphism();
                  else applyTheme(t.id, t.id === "glass");
                }}
                className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors ${
                  theme === t.id ||
                  (t.id === "glass" && mediaActive) ||
                  (t.id === "neu-light" && showNeuModes) ||
                  (t.id === "clay-light" && showClayModes)
                    ? "bg-white/10 text-white"
                    : "text-white/60 hover:bg-white/5 hover:text-white"
                }`}
              >
                <span className="flex -space-x-1.5">
                  <span
                    className="h-3.5 w-3.5 rounded-full border border-black/30"
                    style={{ background: t.swatch[0] }}
                  />
                  <span
                    className="h-3.5 w-3.5 rounded-full border border-black/30"
                    style={{ background: t.swatch[1] }}
                  />
                </span>
                {t.name}
              </button>
            ))}

            {showModes && (
              <>
                <p className="mt-2 border-t border-white/8 px-3 pb-1.5 pt-2.5 text-[11px] font-medium uppercase tracking-wide text-white/40">
                  Mode
                </p>
                {modeList.map((m) => {
                  const Icon = m.id.endsWith("dark") ? Moon : Sun;
                  return (
                    <button
                      key={m.id}
                      onClick={() => applyTheme(m.id, true)}
                      className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors ${
                        theme === m.id ? "bg-white/10 text-white" : "text-white/60 hover:bg-white/5 hover:text-white"
                      }`}
                    >
                      <Icon size={14} className="flex-shrink-0" />
                      {m.name}
                    </button>
                  );
                })}
              </>
            )}

            {showBackgrounds && (
              <>
                <p className="mt-2 border-t border-white/8 px-3 pb-1.5 pt-2.5 text-[11px] font-medium uppercase tracking-wide text-white/40">
                  Background
                </p>
                {/* Tab Video / Foto, lalu pilihan background sebagai kotak 2 kolom
                    (lebih pendek dibanding daftar satu kolom panjang). */}
                <div className="flex gap-1 px-1 pb-2">
                  {BG_TABS.map((tab) => {
                    const TabIcon = tab.icon;
                    return (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => setBgTab(tab.id)}
                        className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-[13px] font-medium transition-colors ${
                          bgTab === tab.id ? "bg-white/10 text-white" : "text-white/60 hover:bg-white/5 hover:text-white"
                        }`}
                      >
                        <TabIcon size={14} className="flex-shrink-0" />
                        {tab.label}
                      </button>
                    );
                  })}
                </div>
                <div className="grid grid-cols-2 gap-1.5 px-1 pb-1">
                  {(BG_TABS.find((tab) => tab.id === bgTab)?.items || []).map((t) => {
                    const Icon = t.kind === "video" ? Video : ImageIcon;
                    return (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => applyTheme(t.id)}
                        className={`flex min-h-[44px] items-center gap-2 rounded-lg border px-2.5 py-2 text-left text-[13px] transition-colors ${
                          theme === t.id
                            ? "border-white/30 bg-white/10 text-white"
                            : "border-white/10 text-white/60 hover:bg-white/5 hover:text-white"
                        }`}
                      >
                        <Icon size={14} className="flex-shrink-0" />
                        <span className="truncate">{t.name}</span>
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}
