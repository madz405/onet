"use client";

import { useEffect, useRef } from "react";
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

/**
 * Widget Cloudflare Turnstile (mode Managed).
 * - onToken(token) dipanggil saat verifikasi lolos; onToken("") saat kedaluwarsa/gagal.
 * - Ubah `resetKey` (mis. naikkan angkanya) untuk meminta token baru. Token hanya
 *   berlaku sekali pakai, jadi reset setelah setiap request.
 */
export default function TurnstileWidget({ onToken, resetKey = 0, className = "" }) {
  const boxRef = useRef(null);
  const idRef = useRef(null);
  const cbRef = useRef(onToken);
  cbRef.current = onToken;

  useEffect(() => {
    let cancelled = false;
    loadScript()
      .then((ts) => {
        if (cancelled || !boxRef.current || idRef.current !== null) return;
        idRef.current = ts.render(boxRef.current, {
          sitekey: TURNSTILE_SITE_KEY,
          theme: "auto",
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
      }
      idRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (resetKey === 0) return;
    if (idRef.current !== null && window.turnstile) {
      try {
        window.turnstile.reset(idRef.current);
      } catch {}
    }
  }, [resetKey]);

  return <div ref={boxRef} className={className} />;
}
