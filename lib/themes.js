// Daftar lengkap opsi tampilan yang muncul di menu tema (tombol palet di
// navbar). "kind" menentukan jenis opsinya:
// - "color" : tema warna solid (background gradient bawaan CSS)
// - "video" : background video, filenya di public/assets/backgrounds/
// - "photo" : background foto, filenya di public/assets/backgrounds/
//
// Untuk video & foto, kartu-kartu di web otomatis pakai gaya "glass" (kaca
// buram) supaya konten tetap kebaca di atas background yang ramai — lihat
// resolveCssTheme() di bawah dan app/globals.css bagian [data-theme="glass"].
export const THEMES = [
  { id: "aurora", name: "Aurora", kind: "color", swatch: ["#4BE3B0", "#FF6B4A"] },
  { id: "sunset", name: "Sunset", kind: "color", swatch: ["#FFB020", "#FF4D6D"] },
  { id: "mint", name: "Mint", kind: "color", swatch: ["#2FE1F5", "#FF9142"] },
  { id: "glass", name: "Glass", kind: "color", swatch: ["#8FA8FF", "#FF7AC6"] },
  {
    id: "video-1",
    name: "Triangle",
    kind: "video",
    src: "/assets/backgrounds/video-1.mp4",
  },
  {
    id: "video-2",
    name: "Abstrak",
    kind: "video",
    src: "/assets/backgrounds/video-2.mp4",
  },
  {
    id: "video-3",
    name: "Sunset",
    kind: "video",
    src: "/assets/backgrounds/video-3.mp4",
  },
  {
    id: "video-4",
    name: "Aesthetic",
    kind: "video",
    src: "/assets/backgrounds/video-4.mp4",
  },
  {
    id: "video-5",
    name: "Yunxiao donghua",
    kind: "video",
    src: "/assets/backgrounds/video-5.mp4",
  },
  {
    id: "video-6",
    name: "Sunday HSR",
    kind: "video",
    src: "/assets/backgrounds/video-6.mp4",
  },
  {
    id: "foto-1",
    name: "Foto 1",
    kind: "photo",
    src: "/assets/backgrounds/foto-1.jpg",
  },
  {
    id: "foto-2",
    name: "Foto 2",
    kind: "photo",
    src: "/assets/backgrounds/foto-2.jpg",
  },
];

export const DEFAULT_THEME = "aurora";
export const THEME_STORAGE_KEY = "unduhin-theme";

// Event custom yang di-dispatch tiap kali pilihan berubah, supaya
// SiteBackground.js (komponen terpisah dari ThemeSwitcher) ikut update
// tanpa perlu context/state management tambahan.
export const THEME_CHANGE_EVENT = "onet-theme-change";

export function getThemeById(id) {
  return THEMES.find((t) => t.id === id);
}

// Nilai yang dipasang ke atribut data-theme di <html> untuk keperluan CSS.
// Video & foto tidak punya CSS sendiri — semuanya "numpang" gaya kaca milik
// tema "glass" supaya kartu-kartu tetap kebaca di atas background media.
export function resolveCssTheme(id) {
  const theme = getThemeById(id);
  if (!theme || theme.kind === "color") return id;
  return "glass";
}
