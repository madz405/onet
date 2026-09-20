"use client";

import { useEffect, useState } from "react";
import { Palette, Video, Image as ImageIcon } from "lucide-react";
import {
  THEMES,
  DEFAULT_THEME,
  THEME_STORAGE_KEY,
  THEME_CHANGE_EVENT,
  resolveCssTheme,
} from "@/lib/themes";

const COLOR_THEMES = THEMES.filter((t) => t.kind === "color");
const MEDIA_THEMES = THEMES.filter((t) => t.kind !== "color");

export default function ThemeSwitcher() {
  const [theme, setTheme] = useState(DEFAULT_THEME);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(THEME_STORAGE_KEY);
      if (saved) setTheme(saved);
    } catch {
      // localStorage tidak tersedia (mode private, dll) — biarkan pakai default.
    }
  }, []);

  function applyTheme(id) {
    setTheme(id);
    setOpen(false);
    document.documentElement.setAttribute("data-theme", resolveCssTheme(id));
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, id);
    } catch {
      // abaikan kalau localStorage diblokir
    }
    // Kabari SiteBackground.js supaya video/foto ikut ganti tanpa reload.
    window.dispatchEvent(new CustomEvent(THEME_CHANGE_EVENT, { detail: id }));
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
          <div className="absolute right-0 top-11 z-50 w-52 rounded-xl border border-white/10 bg-ink-900 p-2 shadow-glow">
            <p className="px-3 py-1.5 text-[11px] font-medium uppercase tracking-wide text-white/40">
              Tema warna
            </p>
            {COLOR_THEMES.map((t) => (
              <button
                key={t.id}
                onClick={() => applyTheme(t.id)}
                className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors ${
                  theme === t.id ? "bg-white/10 text-white" : "text-white/60 hover:bg-white/5 hover:text-white"
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

            <p className="mt-2 border-t border-white/8 px-3 pb-1.5 pt-2.5 text-[11px] font-medium uppercase tracking-wide text-white/40">
              Background
            </p>
            {MEDIA_THEMES.map((t) => {
              const Icon = t.kind === "video" ? Video : ImageIcon;
              return (
                <button
                  key={t.id}
                  onClick={() => applyTheme(t.id)}
                  className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors ${
                    theme === t.id ? "bg-white/10 text-white" : "text-white/60 hover:bg-white/5 hover:text-white"
                  }`}
                >
                  <Icon size={14} className="flex-shrink-0" />
                  {t.name}
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
