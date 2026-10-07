// Aturan upload yang dipakai bersama oleh browser (components/UploadBox.js)
// dan server (app/api/upload/route.js).

export const EXPIRY_OPTIONS = [
  { value: "1h", label: "1 jam" },
  { value: "12h", label: "12 jam" },
  { value: "24h", label: "24 jam" },
  { value: "72h", label: "3 hari" },
  { value: "permanent", label: "Permanen (maks 4 MB)" },
];

// Batas body request function di Vercel sekitar 4,5 MB. File lebih besar dari
// ini hanya bisa dikirim langsung dari browser ke image host (jalur sementara).
export const SERVER_MAX_BYTES = 4 * 1024 * 1024;
export const MAX_BYTES = 1024 * 1024 * 1024; // 1 GB (batas host sementara)

// File yang sering disalahgunakan untuk menyebar malware / halaman phishing.
// Ubah daftar ini kalau kamu mau lebih longgar atau lebih ketat.
const BLOCKED_EXT = new Set([
  "exe", "msi", "bat", "cmd", "com", "scr", "vbs", "ps1", "jar", "apk",
  "js", "html", "htm", "php",
]);

export function validateUpload(filename, size, expiry) {
  const ext = (filename || "").split(".").pop().toLowerCase();
  if (filename?.includes(".") && BLOCKED_EXT.has(ext)) {
    return `File .${ext} tidak diizinkan untuk diupload.`;
  }
  if (!size) return "File kosong.";
  if (size > MAX_BYTES) return "Ukuran file maksimal 1 GB.";
  if (!EXPIRY_OPTIONS.some((o) => o.value === expiry)) return "Masa aktif link tidak valid.";
  if (expiry === "permanent" && size > SERVER_MAX_BYTES) {
    return "File lebih dari 4 MB tidak bisa disimpan permanen. Pilih masa aktif sementara.";
  }
  return "";
}
