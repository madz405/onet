// Metadata untuk grid tools. "kind" menentukan jenis form yang dirender:
// - "text"        : input teks + opsi -> hasil gambar/video lewat GET proxy
// - "upload"      : upload file gambar -> hasil gambar lewat POST proxy
// - "upload-text" : upload file gambar + field teks tambahan (butuh "fields")
//                   -> hasil gambar lewat POST proxy (contoh: fakeml)
export const TOOLS = [
  {
    id: "brat",
    name: "Brat Text",
    icon: "Type",
    kind: "text",
    hint: "Bikin teks gaya cover album 'brat', gambar atau animasi.",
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
    hint: "Versi HD dari Brat Text — pilih hasil gambar atau video.",
    fields: [
      { name: "text", label: "Teks", type: "textarea", placeholder: "Tulis teksnya di sini...", required: true },
      { name: "format", label: "Format hasil", type: "select", options: ["image", "video"], default: "image" },
    ],
  },
  {
    id: "iqc",
    name: "IQC Status Bar",
    icon: "Smartphone",
    kind: "text",
    hint: "Bikin tangkapan layar status bar HP kustom untuk template quotes.",
    fields: [
      { name: "timestamp", label: "Jam saat ini (contoh: 16.42)", type: "text", placeholder: "16.42", required: true },
      {
        name: "statusBarTime",
        label: "Jam pesan dikirim (contoh: 15.50)",
        type: "text",
        placeholder: "15.50",
        required: true,
      },
      {
        name: "emojiType",
        label: "Gaya emoji",
        type: "select",
        options: ["ios", "apple", "samsung"],
        default: "ios",
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
      { name: "text", label: "Teks tambahan (opsional)", type: "text", placeholder: "" },
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
];

export function getTool(id) {
  return TOOLS.find((t) => t.id === id);
}
