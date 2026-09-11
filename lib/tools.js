// Metadata untuk grid tools. "kind" menentukan jenis form yang dirender:
// - "text"   : input teks + opsi -> hasil gambar/video lewat GET proxy
// - "upload" : upload file gambar -> hasil gambar lewat POST proxy
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
    id: "iqc",
    name: "IQC Status Bar",
    icon: "Smartphone",
    kind: "text",
    hint: "Bikin tangkapan layar status bar HP kustom untuk template quotes.",
    fields: [
      {
        name: "provider",
        label: "Provider",
        type: "select",
        options: ["telkomsel", "indosat", "xl", "tri", "smartfren", "axis"],
        default: "telkomsel",
      },
      { name: "jam", label: "Jam (contoh: 20.23)", type: "text", placeholder: "20.23", required: true },
      { name: "baterai", label: "Baterai (%)", type: "number", placeholder: "90", default: 90 },
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
