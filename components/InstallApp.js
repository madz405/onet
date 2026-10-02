"use client";

import { useEffect, useState } from "react";
import { Download } from "lucide-react";

// Mendaftarkan service worker (PWA) dan menampilkan tombol "Pasang aplikasi".
// - Android/Chrome: tombol memicu dialog pemasangan bawaan browser.
// - iPhone/Safari: tidak ada dialog, jadi ditampilkan petunjuk singkat.
// - Tidak tampil kalau web sudah dibuka sebagai aplikasi terpasang.
export default function InstallApp() {
  const [deferred, setDeferred] = useState(null);
  const [isIos, setIsIos] = useState(false);
  const [installed, setInstalled] = useState(true); // sembunyikan sampai dicek
  const [showIosHelp, setShowIosHelp] = useState(false);

  useEffect(() => {
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }

    const standalone =
      window.matchMedia?.("(display-mode: standalone)").matches || window.navigator.standalone === true;
    setInstalled(standalone);
    setIsIos(/iphone|ipad|ipod/i.test(navigator.userAgent) && !standalone);

    const onPrompt = (e) => {
      e.preventDefault();
      setDeferred(e);
    };
    const onInstalled = () => {
      setInstalled(true);
      setDeferred(null);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (installed || (!deferred && !isIos)) return null;

  async function handleClick() {
    if (deferred) {
      deferred.prompt();
      try {
        await deferred.userChoice;
      } catch {}
      setDeferred(null);
    } else {
      setShowIosHelp((v) => !v);
    }
  }

  return (
    <div className="mt-4">
      <button
        type="button"
        onClick={handleClick}
        className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-white/10"
      >
        <Download size={16} />
        Pasang aplikasi
      </button>
      {showIosHelp && (
        <p className="mt-2 max-w-xs text-xs leading-relaxed text-white/50">
          Di iPhone: ketuk ikon Bagikan di Safari, lalu pilih &quot;Tambah ke Layar Utama&quot;.
        </p>
      )}
    </div>
  );
}
