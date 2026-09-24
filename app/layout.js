import { Space_Grotesk, Inter } from "next/font/google";
import "./globals.css";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import SiteBackground from "@/components/SiteBackground";
import SplashLoader from "@/components/SplashLoader";
import { THEME_STORAGE_KEY } from "@/lib/themes";
import { SITE_NAME, SITE_TAGLINE, SITE_FAVICON } from "@/lib/site";

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
    if (theme) {
      var isMedia = theme.indexOf("video-") === 0 || theme.indexOf("foto-") === 0;
      document.documentElement.setAttribute("data-theme", isMedia ? "glass" : theme);
    }
  } catch (e) {}
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

export const metadata = {
  title: `${SITE_NAME} — ${SITE_TAGLINE}`,
  description:
    "Unduh video dan foto dari TikTok, Instagram, Facebook, Pinterest, X, CapCut, YouTube, Spotify, SoundCloud, dan Apple Music. Plus tools edit cepat dan pemutar musik.",
  icons: {
    icon: SITE_FAVICON,
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="id" className={`${display.variable} ${body.variable}`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
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
        <Navbar />
        <main className="min-h-[calc(100dvh-64px)]">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
