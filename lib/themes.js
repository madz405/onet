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
  // Neumorphism: menggantikan tema Sunset. Punya dua mode (Light & Dark).
  // Di menu cuma tampil SATU item "Neumorphism" (id "neu-light"); begitu
  // diklik, pilihan mode Light/Dark muncul di bawahnya (mirip pilihan
  // Background milik Glass). Entri "neu-dark" (kind "neu") tidak muncul
  // sebagai item sendiri di daftar warna — hanya lewat pilihan mode.
  { id: "mint", name: "Mint", kind: "color", swatch: ["#2FE1F5", "#FF9142"] },
  { id: "neu-light", name: "Neumorphism", kind: "color", swatch: ["#E0E5EC", "#3F5BF0"] },
  { id: "glass", name: "Glassmorphism", kind: "color", swatch: ["#8FA8FF", "#FF7AC6"] },
  // Neobrutalism: tema TERANG (krem + border hitam tebal + bayangan keras
  // tanpa blur), beda dari empat tema lain yang gelap. Seluruh gayanya ada di
  // app/globals.css bagian [data-theme="neobrutalism"] — tidak perlu ubah komponen.
  { id: "neobrutalism", name: "Neobrutalism", kind: "color", swatch: ["#FFE94D", "#FF5C9A"] },
  { id: "neu-dark", name: "Neumorphism Dark", kind: "neu" },
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
    name: "Yunxiao Donghua",
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
    name: "Abstrak",
    kind: "photo",
    src: "/assets/backgrounds/foto-1.jpg",
  },
  {
    id: "foto-2",
    name: "Night",
    kind: "photo",
    src: "/assets/backgrounds/foto-2.jpg",
  },
  {
    id: "foto-3",
    name: "Flower",
    kind: "photo",
    src: "/assets/backgrounds/foto-3.jpg",
  },
  {
    id: "foto-4",
    name: "Cat",
    kind: "photo",
    src: "/assets/backgrounds/foto-4.jpg",
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

// Pilihan mode untuk tema Neumorphism (tampil di bawah item "Neumorphism").
export const NEU_MODES = [
  { id: "neu-light", name: "Light" },
  { id: "neu-dark", name: "Dark" },
];
export const NEU_MODE_STORAGE_KEY = "unduhin-neu-mode";

export function isNeuTheme(id) {
  return id === "neu-light" || id === "neu-dark";
}

// Nilai yang dipasang ke atribut data-theme di <html> untuk keperluan CSS.
// Video & foto tidak punya CSS sendiri — semuanya "numpang" gaya kaca milik
// tema "glass" supaya kartu-kartu tetap kebaca di atas background media.
export function resolveCssTheme(id) {
  const theme = getThemeById(id);
  // Id tidak dikenal (misal "sunset" yang sudah dihapus) -> tema default.
  if (!theme) return DEFAULT_THEME;
  if (theme.kind === "color" || theme.kind === "neu") return id;
  return "glass";
}
