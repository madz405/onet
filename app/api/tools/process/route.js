import { NextResponse } from "next/server";
import { uploadToTop4top } from "@/lib/uploadImage";
import { proxyMedia } from "@/lib/proxyMedia";

export const runtime = "nodejs";

const ENDPOINTS = {
  removebg: (imageUrl) => `https://api.azbry.com/api/tools/removebg?url=${encodeURIComponent(imageUrl)}`,
  hd: (imageUrl) => `https://api-faa.my.id/faa/hdv3?image=${encodeURIComponent(imageUrl)}`,
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

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const hostedUrl = await uploadToTop4top(buffer, file.name || "image.jpg", file.type);
    const targetUrl = ENDPOINTS[tool](hostedUrl);
    return proxyMedia(targetUrl);
  } catch (err) {
    return NextResponse.json(
      { status: false, message: err.message || "Gagal memproses gambar." },
      { status: 500 }
    );
  }
}
