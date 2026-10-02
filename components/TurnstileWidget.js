"use client";

import { useEffect, useRef, useState } from "react";
import { TURNSTILE_SITE_KEY } from "@/lib/site";

const SCRIPT_SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
let scriptPromise = null;

function loadScript() {
  if (typeof window === "undefined") return Promise.reject();
  if (window.turnstile) return Promise.resolve(window.turnstile);
  if (!scriptPromise) {
    scriptPromise = new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = SCRIPT_SRC;
      s.async = true;
      s.defer = true;
      s.onload = () => resolve(window.turnstile);
      s.onerror = () => {
        scriptPromise = null;
        reject(new Error("Gagal memuat Turnstile"));
      };
      document.head.appendChild(s);
    });
  }
  return scriptPromise;
}

// Tema yang terangnya mengikuti halaman (lihat lib/themes.js & globals.css).
const LIGHT_THEMES = ["neobrutalism", "neu-light", "clay-light"];

function currentTsTheme() {
  if (typeof document === "undefined") return "dark";
  const t = document.documentElement.getAttribute("data-theme") || "";
  return LIGHT_THEMES.includes(t) ? "light" : "dark";
}

/**
 * Widget Cloudflare Turnstile (mode Managed).
 * - Lebar mengikuti kolom (size "flexible") dan warna terang/gelap mengikuti
 *   tema web; bingkai/bayangannya diatur per tema lewat class .ts-wrap di
 *   app/globals.css.
 * - onToken(token) dipanggil saat verifikasi lolos; onToken("") saat kedaluwarsa/gagal.
 * - Ubah `resetKey` (mis. naikkan angkanya) untuk meminta token baru. Token hanya
 *   berlaku sekali pakai, jadi reset setelah setiap request.
 */
export default function TurnstileWidget({ onToken, resetKey = 0, className = "" }) {
  const boxRef = useRef(null);
  const idRef = useRef(null);
  const cbRef = useRef(onToken);
  cbRef.current = onToken;
  const [tsTheme, setTsTheme] = useState(currentTsTheme);

  // Ikuti pergantian tema web.
  useEffect(() => {
    setTsTheme(currentTsTheme());
    const obs = new MutationObserver(() => setTsTheme(currentTsTheme()));
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    let cancelled = false;
    loadScript()
      .then((ts) => {
        if (cancelled || !boxRef.current || idRef.current !== null) return;
        idRef.current = ts.render(boxRef.current, {
          sitekey: TURNSTILE_SITE_KEY,
          theme: tsTheme,
          size: "flexible",
          language: "id",
          callback: (t) => cbRef.current?.(t),
          "expired-callback": () => cbRef.current?.(""),
          "timeout-callback": () => cbRef.current?.(""),
          "error-callback": () => cbRef.current?.(""),
        });
      })
      .catch(() => cbRef.current?.(""));
    return () => {
      cancelled = true;
      if (idRef.current !== null && window.turnstile) {
        try {
          window.turnstile.remove(idRef.current);
        } catch {}
        // Widget dibuat ulang (mis. ganti tema), token lama tidak berlaku lagi.
        cbRef.current?.("");
      }
      idRef.current = null;
    };
  }, [tsTheme]);

  useEffect(() => {
    if (resetKey === 0) return;
    if (idRef.current !== null && window.turnstile) {
      try {
        window.turnstile.reset(idRef.current);
      } catch {}
    }
  }, [resetKey]);

  return <div ref={boxRef} className={`ts-wrap ${className}`} />;
}
