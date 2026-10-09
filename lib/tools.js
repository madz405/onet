// Metadata untuk grid tools. "kind" menentukan jenis form yang dirender:
// - "text"        : input teks + opsi -> hasil gambar/video lewat GET proxy
// - "upload"      : upload file gambar -> hasil gambar lewat POST proxy
// - "upload-text" : upload file gambar + field teks tambahan (butuh "fields")
//                   -> hasil gambar lewat POST proxy (contoh: fakeml)
// - "text-image"  : field teks + gambar OPSIONAL (upload file)
//                   -> hasil gambar lewat POST proxy (contoh: iqc2)
// - "qr"          : generator QR, sepenuhnya di browser (components/QrModal.js)
// - "uploader"    : upload file apa saja jadi link (components/UploaderModal.js)
// - "compress"    : kompres & ubah ukuran gambar, di browser (components/CompressModal.js)
// - "pdf"         : gambar ke PDF dan gabung PDF, di browser (components/PdfModal.js)
// - "tts"         : teks jadi suara MP3, 178 model suara (components/TtsModal.js)
// - "amfinder"    : cari link preset Alight Motion di komentar TikTok (components/AmFinderModal.js)
export const TOOLS = [
  {
    id: "brat",
    name: "Brat Text",
    icon: "Type",
    kind: "text",
    // noZoom: hasil gambar TIDAK bisa diketuk untuk zoom (lihat ToolModal.js).
    noZoom: true,
    hint: "Bikin teks gaya cover album brat, gambar atau animasi.",
    fields: [
      { name: "text", label: "Teks", type: "textarea", placeholder: "Tulis teksnya di sini...", required: true },
      { name: "isAnimated", label: "Versi animasi (GIF)", type: "toggle", default: false },
    ],
  },
  {
    id: "brathd",
    name: "Brat HD",
    icon: "Sparkles",
    kind: "text",
    noZoom: true,
    hint: "Versi HD dari Brat Text pilih hasil gambar atau video.",
    fields: [
      { name: "text", label: "Teks", type: "textarea", placeholder: "Tulis teksnya di sini...", required: true },
      { name: "format", label: "Format hasil", type: "select", options: ["image", "video"], default: "image" },
    ],
  },
  {
    id: "iqc",
    name: "IQC (Iphone quoted chat)",
    icon: "Smartphone",
    kind: "text",
    hint: "Bikin tangkapan layar status bar HP kustom untuk template quotes.",
    fields: [
      // Kedua jam opsional. Kalau dikosongkan, server memakai jam WIB
      // sekarang (Asia/Jakarta) — lihat app/api/tools/iqc/route.js.
      // "wibTime: true" membuat placeholder-nya menampilkan jam WIB live
      // (lihat komponen Field di ToolModal.js). Gaya emoji dikunci "ios" di server.
      {
        name: "timestamp",
        label: "Jam saat ini (opsional, kosong = jam WIB sekarang)",
        type: "text",
        placeholder: "16.42",
        wibTime: true,
      },
      {
        name: "statusBarTime",
        label: "Jam pesan dikirim (opsional, kosong = jam WIB sekarang)",
        type: "text",
        placeholder: "15.50",
        wibTime: true,
      },
      {
        name: "signal",
        label: "Kekuatan sinyal",
        type: "select",
        options: ["1", "2", "3", "4"],
        default: "4",
      },
      { name: "battery", label: "Baterai (%)", type: "number", placeholder: "90", default: 90 },
      {
        name: "carrier",
        label: "Provider",
        type: "select",
        options: ["telkomsel", "indosat", "xl", "tri", "smartfren", "axis"],
        default: "telkomsel",
      },
      { name: "text", label: "Teks tambahan", type: "text", placeholder: "Tulis teksnya di sini...", required: true },
    ],
  },
  {
    id: "iqc2",
    name: "IQC V2 (Iphone quoted chat + gambar)",
    icon: "ImagePlus",
    kind: "text-image",
    hint: "Versi 2 dari IQC: bisa pesan teks, gambar, atau keduanya dalam satu bubble chat.",
    // Minimal salah satu harus diisi: teks pesan atau gambar (upload file)
    // (divalidasi di ToolModal.js & app/api/tools/iqc2/route.js).
    // Dua jam sama seperti IQC pertama (kosong = jam WIB sekarang).
    fields: [
      {
        name: "statusBarTime",
        label: "Jam saat ini (opsional, kosong = jam WIB sekarang)",
        type: "text",
        placeholder: "16.42",
        wibTime: true,
      },
      {
        name: "timestamp",
        label: "Jam pesan dikirim (opsional, kosong = jam WIB sekarang)",
        type: "text",
        placeholder: "15.50",
        wibTime: true,
      },
      {
        name: "signal",
        label: "Kekuatan sinyal",
        type: "select",
        options: ["1", "2", "3", "4"],
        default: "4",
      },
      { name: "battery", label: "Baterai (%)", type: "number", placeholder: "90", default: 90 },
      {
        name: "carrier",
        label: "Provider",
        type: "select",
        options: ["telkomsel", "indosat", "xl", "tri", "smartfren", "axis"],
        default: "telkomsel",
      },
      { name: "message", label: "Pesan (opsional kalau ada gambar)", type: "text", placeholder: "Tulis pesannya di sini..." },
    ],
  },
  {
    id: "fakeff",
    name: "Lobby Free Fire",
    icon: "Trophy",
    kind: "text",
    hint: "Generator gambar lobby Free Fire dengan nickname bebas, buat meme/konten.",
    fields: [
      { name: "nickname", label: "Nickname", type: "text", placeholder: "Nickname kamu", required: true },
    ],
  },
  {
    id: "fakeml",
    name: "Lobby Mobile Legends",
    icon: "Shield",
    kind: "upload-text",
    hint: "Generator gambar lobby Mobile Legends pakai foto avatar & nickname sendiri.",
    fields: [
      { name: "nickname", label: "Nickname", type: "text", placeholder: "Nickname kamu", required: true },
    ],
  },
  {
    id: "meme",
    name: "Meme Custom",
    icon: "Image",
    kind: "upload-text",
    hint: "Bikin meme dari foto sendiri, isi teks atas dan/atau bawah.",
    // Kedua field ini opsional sendiri-sendiri, tapi minimal salah satu
    // harus diisi (divalidasi di ToolModal.js & app/api/tools/process/route.js).
    requireAtLeastOneOf: ["topText", "bottomText"],
    fields: [
      { name: "topText", label: "Teks atas (opsional)", type: "text", placeholder: "Teks di bagian atas" },
      { name: "bottomText", label: "Teks bawah (opsional)", type: "text", placeholder: "Teks di bagian bawah" },
    ],
  },
  {
    id: "removebg",
    name: "Hapus Background",
    icon: "Eraser",
    kind: "upload",
    hint: "Hilangkan latar belakang foto secara otomatis.",
  },
  {
    id: "hd",
    name: "Perjelas Foto (HD)",
    icon: "Wand2",
    kind: "upload",
    hint: "Tingkatkan resolusi & kejernihan foto.",
  },
  {
    id: "qr",
    name: "QR Generator",
    icon: "QrCode",
    kind: "qr",
    hint: "Ubah teks, link, WiFi, WhatsApp, kontak, atau file jadi kode QR.",
  },
  {
    id: "uploader",
    name: "Uploader Link",
    icon: "CloudUpload",
    kind: "uploader",
    hint: "Upload gambar, video, musik, atau file lain jadi link yang bisa dibagikan.",
  },
  {
    id: "compress",
    name: "Kompres Gambar",
    icon: "Minimize2",
    kind: "compress",
    hint: "Kecilkan ukuran foto sampai target KB, ubah ukuran dan format JPG/WebP/PNG.",
  },
  {
    id: "pdf",
    name: "PDF Tools",
    icon: "FileText",
    kind: "pdf",
    hint: "Ubah gambar jadi PDF dan gabung beberapa PDF jadi satu.",
  },
  {
    id: "tts",
    name: "Text to Speech",
    icon: "Volume2",
    kind: "tts",
    hint: "Ubah teks jadi suara MP3 dengan 178 pilihan model suara.",
  },
  {
    id: "amfinder",
    name: "AM Finder",
    icon: "Search",
    kind: "amfinder",
    hint: "Cari link preset Alight Motion yang ada di komentar video TikTok.",
  },
];

// Tool yang butuh verifikasi Cloudflare Turnstile. Dipakai ToolModal (menampilkan
// widget) dan route server (memeriksa token). QR Generator dan Uploader Link
// tidak ada di sini: Uploader punya widget sendiri di components/UploadBox.js.
export const TURNSTILE_TOOLS = ["iqc", "iqc2", "removebg", "hd"];

export function getTool(id) {
  return TOOLS.find((t) => t.id === id);
}
