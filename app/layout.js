import { Space_Grotesk, Inter } from "next/font/google";
import "./globals.css";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import SiteBackground from "@/components/SiteBackground";
import SplashLoader from "@/components/SplashLoader";
import ChannelPromo from "@/components/ChannelPromo";
import MusicPlayerProvider from "@/components/MusicPlayerProvider";
import MiniPlayer from "@/components/MiniPlayer";
import { THEME_STORAGE_KEY } from "@/lib/themes";
import { SITE_NAME, SITE_TAGLINE, SITE_FAVICON, SITE_LOGO, SITE_URL } from "@/lib/site";

// Dijalankan sebelum React hydrate, supaya tema tersimpan langsung
// terpasang sejak render pertama (tidak ada kedipan balik ke tema default).
// Pilihan "video-*"/"foto-*" tetap disimpan apa adanya, tapi atribut
// data-theme yang dipasang ke <html> di-resolve ke "glass" (lihat
// resolveCssTheme() di lib/themes.js) karena background media numpang gaya
// kaca milik tema glass.
const themeInitScript = `
(function () {
  try {
    var theme = localStorage.getItem("${THEME_STORAGE_KEY}");
    if (theme === "sunset") theme = null; // tema Sunset sudah diganti Neumorphism
    if (theme) {
      var isMedia = theme.indexOf("video-") === 0 || theme.indexOf("foto-") === 0;
      document.documentElement.setAttribute("data-theme", isMedia ? "glass" : theme);
    }
  } catch (e) {}
})();
`;

// Blokir menu "Simpan gambar/video" yang muncul saat tekan-lama (Android
// Chrome) atau klik-kanan (desktop) di atas <img>/<video>/<picture>.
// Long-press di Chrome Android tetap memicu event "contextmenu" (bukan cuma
// klik kanan), jadi preventDefault() di sini efektif untuk keduanya.
// -webkit-touch-callout di globals.css menangani kasus Safari iOS yang tidak
// selalu memicu "contextmenu" saat long-press.
// Dipasang di <head> (bukan lewat komponen client) supaya listener terpasang
// di document sejak awal dan tidak hilang saat navigasi client-side.
const disableMediaContextMenuScript = `
(function () {
  function isMediaTarget(el) {
    return !!(el && el.closest && el.closest("img, video, picture"));
  }
  document.addEventListener("contextmenu", function (e) {
    if (isMediaTarget(e.target)) e.preventDefault();
  }, false);
  document.addEventListener("dragstart", function (e) {
    if (isMediaTarget(e.target)) e.preventDefault();
  }, false);
})();
`;

const display = Space_Grotesk({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-display",
});

const body = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-body",
});

export const viewport = {
  themeColor: "#0b0a14",
};

const SITE_DESCRIPTION =
  "Unduh video dan foto dari TikTok, Instagram, Facebook, Pinterest, X, Douyin, YouTube, Spotify, SoundCloud, dan Apple Music. Plus tools edit cepat dan pemutar musik.";

export const metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: `${SITE_NAME} — ${SITE_TAGLINE}`,
    template: `%s`,
  },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  keywords: [
    "download video tiktok tanpa watermark",
    "download video instagram",
    "download reels",
    "download video facebook",
    "download youtube mp3",
    "downloader sosial media",
    "pemutar musik online",
    "KOYEN",
  ],
  icons: {
    icon: SITE_FAVICON,
    apple: "/icons/apple-touch-icon.png",
  },
  // PWA: manifest dibuat otomatis dari app/manifest.js.
  appleWebApp: {
    capable: true,
    title: SITE_NAME,
    statusBarStyle: "black-translucent",
  },
  openGraph: {
    type: "website",
    url: SITE_URL,
    siteName: SITE_NAME,
    locale: "id_ID",
    title: `${SITE_NAME} — ${SITE_TAGLINE}`,
    description: SITE_DESCRIPTION,
    images: [{ url: SITE_LOGO, alt: SITE_NAME }],
  },
  twitter: {
    card: "summary",
    title: `${SITE_NAME} — ${SITE_TAGLINE}`,
    description: SITE_DESCRIPTION,
    images: [SITE_LOGO],
  },
  robots: { index: true, follow: true },
  // Kode verifikasi Google Search Console (metode meta tag). Isi lewat
  // environment variable NEXT_PUBLIC_GSC_VERIFICATION kalau dipakai.
  verification: process.env.NEXT_PUBLIC_GSC_VERIFICATION
    ? { google: process.env.NEXT_PUBLIC_GSC_VERIFICATION }
    : undefined,
};

export default function RootLayout({ children }) {
  return (
    <html lang="id" className={`${display.variable} ${body.variable}`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
        <script dangerouslySetInnerHTML={{ __html: disableMediaContextMenuScript }} />
      </head>
      {/* min-h-screen (100vh statis) diganti min-h-dvh: di browser HP, 100vh
          dihitung pakai tinggi viewport saat address bar disembunyikan (jadi
          LEBIH TINGGI dari yang kelihatan waktu address bar masih muncul).
          Body/main jadi "dipaksa" setinggi itu sejak awal, padahal ruang
          ekstranya belum kelihatan — begitu discroll dan address bar-nya
          collapse (viewport asli membesar menyamai 100vh), ruang ekstra tadi
          baru nongol, isinya cuma warna body polos di baliknya. Untuk tema
          lain nyaris tidak kelihatan (warnanya rata), tapi di tema Glass yang
          gradasinya biru->ungu->pink->oranye, ruang ekstra itu nampak sebagai
          "glitch" warna pink/oranye di bawah pas discroll. min-h-dvh (dynamic
          viewport height) ikut ukuran viewport yang BENAR-BENAR kelihatan
          saat itu, jadi tidak ada ruang ekstra yang nongol belakangan. */}
      <body className="font-body bg-ink-950 bg-grain min-h-dvh">
        <SplashLoader />
        <SiteBackground />
        {/* Pop up ajakan gabung saluran WhatsApp: muncul setelah splash loader selesai. */}
        <ChannelPromo />
        {/* Provider membungkus semua halaman supaya <audio> tidak ter-unmount
            saat pindah halaman; MiniPlayer hanya muncul di "/", "/tools", dan "/chat". */}
        <MusicPlayerProvider>
          <Navbar />
          <MiniPlayer />
          <main className="min-h-[calc(100dvh-64px)]">{children}</main>
          <Footer />
        </MusicPlayerProvider>
      </body>
    </html>
  );
}
