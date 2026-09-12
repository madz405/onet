import { Space_Grotesk, Inter } from "next/font/google";
import "./globals.css";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { THEME_STORAGE_KEY } from "@/lib/themes";

// Dijalankan sebelum React hydrate, supaya tema tersimpan langsung
// terpasang sejak render pertama (tidak ada kedipan balik ke tema default).
const themeInitScript = `
(function () {
  try {
    var theme = localStorage.getItem("${THEME_STORAGE_KEY}");
    if (theme) document.documentElement.setAttribute("data-theme", theme);
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
  title: "Unduhin — Download & Tools Sosial Media",
  description:
    "Unduh video dan foto dari TikTok, Instagram, Facebook, Pinterest, X, CapCut, YouTube, Spotify, SoundCloud, dan Apple Music. Plus tools edit cepat dan pemutar musik.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="id" className={`${display.variable} ${body.variable}`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="font-body bg-ink-950 bg-grain min-h-screen">
        <Navbar />
        <main className="min-h-[calc(100vh-64px)]">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
