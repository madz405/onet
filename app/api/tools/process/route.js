import { NextResponse } from "next/server";
import { uploadToTop4top } from "@/lib/uploadImage";
import { proxyMedia } from "@/lib/proxyMedia";

export const runtime = "nodejs";

// memegen.link pakai skema escape sendiri untuk teks di dalam path URL
// (bukan encodeURIComponent biasa), supaya karakter seperti "/" atau "?"
// di dalam teks tidak dianggap bagian dari struktur URL. Referensi lengkap
// ada di dokumentasi memegen.link, ini rule-rule utamanya:
// - baris kosong -> "_"
// - spasi -> "_"
// - "_" asli di teks -> "__"
// - "-" asli di teks -> "--"
// - "?" -> "~q"   "%" -> "~p"   "#" -> "~h"   "/" -> "~s"
function memegenEncode(text) {
  const trimmed = (text || "").toString().trim();
  if (!trimmed) return "_";
  const escaped = trimmed
    .replace(/_/g, "__")
    .replace(/-/g, "--")
    .replace(/\?/g, "~q")
    .replace(/%/g, "~p")
    .replace(/#/g, "~h")
    .replace(/\//g, "~s")
    .replace(/\s+/g, "_");
  // Lapisan pengaman terakhir untuk karakter non-ASCII (emoji, dll) — aman
  // dipakai di sini karena "~" dan huruf tidak ikut ter-encode ulang.
  return encodeURIComponent(escaped);
}

// Setiap builder menerima (imageUrl, formData) — imageUrl sudah di-host di
// top4top, formData dipakai untuk tool yang butuh input tambahan selain foto
// (contoh: fakeml butuh nickname, meme butuh teks atas/bawah).
const ENDPOINTS = {
  removebg: (imageUrl) => `https://api.azbry.com/api/tools/removebg?url=${encodeURIComponent(imageUrl)}`,
  hd: (imageUrl) => `https://api-faa.my.id/faa/hdv3?image=${encodeURIComponent(imageUrl)}`,
  fakeml: (imageUrl, formData) => {
    const nickname = (formData.get("nickname") || "").toString().trim();
    return `https://api.nexray.web.id/maker/fakelobyml?avatar=${encodeURIComponent(
      imageUrl
    )}&nickname=${encodeURIComponent(nickname)}`;
  },
  meme: (imageUrl, formData) => {
    const top = memegenEncode(formData.get("topText"));
    const bottom = memegenEncode(formData.get("bottomText"));
    return `https://api.memegen.link/images/custom/${top}/${bottom}.png?background=${encodeURIComponent(
      imageUrl
    )}`;
  },
};

export async function POST(req) {
  const { searchParams } = new URL(req.url);
  const tool = searchParams.get("tool");

  if (!ENDPOINTS[tool]) {
    return NextResponse.json({ status: false, message: "Tool tidak dikenali." }, { status: 400 });
  }

  let formData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ status: false, message: "Gagal membaca file yang diunggah." }, { status: 400 });
  }

  const file = formData.get("file");
  if (!file || typeof file === "string") {
    return NextResponse.json({ status: false, message: "Pilih file gambar terlebih dahulu." }, { status: 400 });
  }
  if (file.size > 8 * 1024 * 1024) {
    return NextResponse.json({ status: false, message: "Ukuran gambar maksimal 8MB." }, { status: 400 });
  }
  if (tool === "fakeml" && !formData.get("nickname")?.toString().trim()) {
    return NextResponse.json({ status: false, message: "Nickname tidak boleh kosong." }, { status: 400 });
  }
  if (tool === "meme") {
    const top = (formData.get("topText") || "").toString().trim();
    const bottom = (formData.get("bottomText") || "").toString().trim();
    if (!top && !bottom) {
      return NextResponse.json(
        { status: false, message: "Isi minimal salah satu: teks atas atau teks bawah." },
        { status: 400 }
      );
    }
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const hostedUrl = await uploadToTop4top(buffer, file.name || "image.jpg", file.type);
    const targetUrl = ENDPOINTS[tool](hostedUrl, formData);
    return proxyMedia(targetUrl);
  } catch (err) {
    return NextResponse.json(
      { status: false, message: err.message || "Gagal memproses gambar." },
      { status: 500 }
    );
  }
}
