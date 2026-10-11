// Pengaturan halaman Dukungan (/dukungan). Ubah nilai di bawah ini saja.

// Link Saweria kamu, mis. "https://saweria.co/namakamu". Selama masih
// mengandung "USERNAME" atau kosong, tombol Saweria tampil nonaktif.
export const SAWERIA_URL = "https://saweria.co/madzmuldi";

// Gambar QRIS kamu. Taruh filenya di public/assets/ dengan nama ini
// (atau ganti path-nya).
export const QRIS_IMAGE = "/assets/qris.png";

// Nomor DANA dan nama pemilik (ditampilkan di bawah QRIS agar pendukung bisa
// memastikan tujuan dan menyalin nomor). Kosongkan untuk menyembunyikan.
export const DANA_NUMBER = "";
export const DANA_NAME = "";

// Widget progres target Saweria (Saweria > Widgets > Milestone), ditampilkan di
// atas halaman Dukungan. Kosongkan untuk menyembunyikannya.
// Catatan: link ini memuat streamKey dan ikut terlihat di kode halaman. Kalau
// suatu saat ingin mencabut aksesnya, buat ulang stream key di pengaturan Saweria.
export const MILESTONE_URL =
  "https://saweria.co/widgets/milestone?streamKey=7de5dce2dfdebd9005f0376cb23f34d3";

export const SAWERIA_READY = Boolean(SAWERIA_URL) && !SAWERIA_URL.includes("USERNAME");
