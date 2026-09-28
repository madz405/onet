"use client";

import { useCallback, useEffect, useState } from "react";
import { X, Download, Wand2, Music2, Bot, ArrowUpRight } from "lucide-react";
import { PLATFORMS } from "@/lib/platforms";
import { TOOLS } from "@/lib/tools";
import { SITE_NAME, SITE_TAGLINE, WHATSAPP_CHANNEL_URL } from "@/lib/site";

// Pop up ajakan gabung saluran WhatsApp KOYEN.
//
// - Muncul setelah layar loading (SplashLoader) selesai. Sinyal "splash
//   selesai" datang dari atribut data-splash di <html> / event
//   "koyen:splash-done" (lihat SplashLoader.js).
// - Setelah tampil, TIDAK muncul lagi walau web di-refresh berkali-kali,
//   sampai lewat COOLDOWN_MINUTES (default 60 menit = 1 jam). Waktu tampil
//   terakhir disimpan di localStorage, jadi berlaku lintas tab dan tetap
//   ingat walau browser ditutup.
// - Tutup otomatis setelah AUTO_CLOSE_SECONDS detik. Tombol silang (atau Esc)
//   menutupnya langsung kapan saja. Klik tombol gabung juga menutupnya.
// - Tampilan memakai kelas yang sama dengan Modal.js, jadi otomatis ikut
//   tema aktif (gelap, glass, neobrutalism, dst).
//
// Mau ubah perilakunya? Cukup edit angka/flag di bawah ini.
const AUTO_CLOSE_SECONDS = 30; // lama pop up tampil kalau tidak ditutup manual
const SHOW_DELAY_MS = 800; // jeda setelah splash hilang sebelum pop up muncul
const SPLASH_WAIT_MAX_MS = 15000; // kalau sinyal splash tidak pernah datang, tetap tampil
const COOLDOWN_MINUTES = 60; // jeda minimal antar kemunculan pop up (0 = muncul setiap refresh)
const STORAGE_KEY = "koyen-channel-promo-last-shown";

// True kalau pop up baru saja tampil dan masih dalam masa jeda.
// Kalau storage tidak bisa dibaca (diblokir/private mode) atau nilainya
// aneh (mis. jam perangkat diubah sehingga waktunya "di masa depan"), anggap
// tidak sedang jeda supaya pop up tetap bisa tampil.
function isCoolingDown() {
  if (COOLDOWN_MINUTES <= 0) return false;
  try {
    const last = Number(localStorage.getItem(STORAGE_KEY));
    if (!Number.isFinite(last) || last <= 0) return false;
    const elapsed = Date.now() - last;
    return elapsed >= 0 && elapsed < COOLDOWN_MINUTES * 60 * 1000;
  } catch {
    return false;
  }
}

const FEATURES = [
  {
    icon: Download,
    title: "Downloader",
    desc: `Unduh video, foto, dan audio dari ${PLATFORMS.length} platform, tanpa watermark kalau tersedia.`,
    extra: PLATFORMS.map((p) => p.name).join(", "),
  },
  {
    icon: Wand2,
    title: "Tools",
    desc: `${TOOLS.length} tools edit cepat: hapus background, perjelas foto HD, meme, Brat, IQC, dan lobby game.`,
  },
  {
    icon: Music2,
    title: "Musik",
    desc: "Cari dan putar lagu langsung di web, mini player tetap jalan saat kamu pindah halaman.",
  },
  {
    icon: Bot,
    title: "Chat AI",
    desc: "Ngobrol dan tanya apa saja ke Kayna, asisten AI dari KOYEN.",
  },
];

export default function ChannelPromo() {
  const [visible, setVisible] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(AUTO_CLOSE_SECONDS);

  const close = useCallback(() => setVisible(false), []);

  // 1) Tunggu splash selesai, lalu munculkan pop up.
  useEffect(() => {
    if (isCoolingDown()) return;

    let showTimer = null;
    let safetyTimer = null;
    let scheduled = false;

    const schedule = () => {
      if (scheduled) return;
      scheduled = true;
      showTimer = setTimeout(() => setVisible(true), SHOW_DELAY_MS);
    };

    const html = document.documentElement;
    const splashActive =
      html.getAttribute("data-splash") !== "done" && !!document.querySelector(".splash-root");

    if (!splashActive) {
      schedule();
    } else {
      window.addEventListener("koyen:splash-done", schedule, { once: true });
      safetyTimer = setTimeout(schedule, SPLASH_WAIT_MAX_MS);
    }

    return () => {
      clearTimeout(showTimer);
      clearTimeout(safetyTimer);
      window.removeEventListener("koyen:splash-done", schedule);
    };
  }, []);

  // 2) Selama tampil: hitung mundur & tutup otomatis, Esc untuk menutup,
  //    dan kunci scroll halaman di belakangnya.
  useEffect(() => {
    if (!visible) return;

    // Catat waktu tampil begitu pop up muncul (bukan saat ditutup), jadi kalau
    // halaman di-refresh selagi pop up masih terbuka, tidak muncul lagi.
    try {
      localStorage.setItem(STORAGE_KEY, String(Date.now()));
    } catch {
      // storage diblokir: abaikan, pop up tetap jalan normal
    }

    // Pakai batas waktu absolut (bukan hitung tick) supaya tetap akurat
    // walau tab sempat di-throttle browser.
    const deadline = Date.now() + AUTO_CLOSE_SECONDS * 1000;
    setSecondsLeft(AUTO_CLOSE_SECONDS);
    const tick = setInterval(() => {
      const left = Math.ceil((deadline - Date.now()) / 1000);
      if (left <= 0) close();
      else setSecondsLeft(left);
    }, 250);

    const onKey = (e) => e.key === "Escape" && close();
    window.addEventListener("keydown", onKey);

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      clearInterval(tick);
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [visible, close]);

  if (!visible) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="channel-promo-title"
        className="glass-surface-solid max-h-[88dvh] w-full max-w-md overflow-y-auto rounded-3xl border border-white/10 bg-ink-900 p-6 shadow-glow animate-rise"
      >
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-signal-400">Info {SITE_NAME}</p>
            <h2 id="channel-promo-title" className="mt-1 font-display text-xl font-semibold leading-tight text-white">
              Kenalan dulu sama {SITE_NAME}
            </h2>
          </div>
          <button
            type="button"
            onClick={close}
            className="grid h-8 w-8 flex-shrink-0 place-items-center rounded-full text-white/60 hover:bg-white/10 hover:text-white focus-ring"
            aria-label="Tutup"
          >
            <X size={18} />
          </button>
        </div>

        <p className="text-sm leading-relaxed text-white/60">
          {SITE_NAME} adalah {SITE_TAGLINE.toLowerCase()} yang bisa dipakai langsung dari browser, tanpa perlu install
          aplikasi. Ini yang bisa kamu lakukan di sini:
        </p>

        <ul className="mt-4 space-y-3.5">
          {FEATURES.map(({ icon: Icon, title, desc, extra }) => (
            <li key={title} className="flex gap-3">
              <span className="grid h-10 w-10 flex-shrink-0 place-items-center rounded-xl bg-flare-500/15 text-flare-400">
                <Icon size={18} />
              </span>
              <span className="min-w-0">
                <span className="block font-display text-sm font-semibold text-white">{title}</span>
                <span className="mt-0.5 block text-sm leading-snug text-white/60">{desc}</span>
                {extra && <span className="mt-1 block text-xs leading-snug text-white/35">{extra}</span>}
              </span>
            </li>
          ))}
        </ul>

        <div className="mt-6 border-t border-white/10 pt-5">
          <p className="font-display text-base font-semibold text-white">Ikuti saluran WhatsApp {SITE_NAME}</p>
          <p className="mt-1.5 text-sm leading-relaxed text-white/60">
            Dapatkan info update fitur baru, perbaikan bug, dan pengumuman maintenance langsung di WhatsApp, jadi kamu
            tidak ketinggalan kalau ada yang baru atau lagi ada gangguan.
          </p>
          <a
            href={WHATSAPP_CHANNEL_URL}
            target="_blank"
            rel="noopener noreferrer"
            onClick={close}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-signal-500 px-4 py-3 text-sm font-semibold text-ink-950 transition-transform hover:scale-[1.01] focus-ring"
          >
            Gabung Saluran
            <ArrowUpRight size={16} />
          </a>
        </div>

        <div className="mt-4">
          <p className="mb-1.5 text-xs text-white/40">Tertutup otomatis dalam {secondsLeft} detik</p>
          <div className="promo-countdown-track" aria-hidden="true">
            <div className="promo-countdown-fill" style={{ animationDuration: `${AUTO_CLOSE_SECONDS}s` }} />
          </div>
        </div>
      </div>
    </div>
  );
}
