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

export const SAWERIA_READY = Boolean(SAWERIA_URL) && !SAWERIA_URL.includes("USERNAME");
