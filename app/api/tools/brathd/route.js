import { NextResponse } from "next/server";
import { proxyMedia } from "@/lib/proxyMedia";

export const runtime = "nodejs";

// Dua endpoint terpisah tergantung format yang dipilih user — beda dari
// tool "brat" biasa yang cuma satu endpoint dengan toggle isAnimated.
const ENDPOINTS = {
  image: "https://api.nexray.eu.cc/maker/brathd",
  video: "https://api.nexray.eu.cc/maker/bratvidhd",
};

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const text = searchParams.get("text");
  const format = searchParams.get("format") === "video" ? "video" : "image";

  if (!text || !text.trim()) {
    return NextResponse.json({ status: false, message: "Teks tidak boleh kosong." }, { status: 400 });
  }

  const url = `${ENDPOINTS[format]}?text=${encodeURIComponent(text.trim())}`;
  return proxyMedia(url);
}
