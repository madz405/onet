import { SITE_NAME, SITE_TAGLINE } from "@/lib/site";

// Manifest PWA: membuat web bisa dipasang ke layar utama HP sebagai aplikasi.
export default function manifest() {
  return {
    name: `${SITE_NAME} — ${SITE_TAGLINE}`,
    short_name: SITE_NAME,
    description:
      "Unduh video dan foto dari berbagai sosial media tanpa watermark, plus tools edit cepat dan pemutar musik.",
    id: "/",
    start_url: "/?source=pwa",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    lang: "id",
    background_color: "#0b0a14",
    theme_color: "#0b0a14",
    categories: ["utilities", "multimedia"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    // Muncul di menu "Bagikan" HP (Android, setelah web dipasang sebagai PWA).
    // Link yang dibagikan dikirim ke halaman utama lewat query ?title=&text=&url=
    share_target: {
      action: "/",
      method: "GET",
      params: { title: "title", text: "text", url: "url" },
    },
    shortcuts: [
      { name: "Musik", short_name: "Musik", url: "/musik", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "Tools", short_name: "Tools", url: "/tools", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
    ],
  };
}
