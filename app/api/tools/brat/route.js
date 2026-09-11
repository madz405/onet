import { NextResponse } from "next/server";
import { proxyMedia } from "@/lib/proxyMedia";

export const runtime = "nodejs";

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const text = searchParams.get("text");
  const isAnimated = searchParams.get("isAnimated") === "true";

  if (!text || !text.trim()) {
    return NextResponse.json({ status: false, message: "Teks tidak boleh kosong." }, { status: 400 });
  }

  const url = `https://api.siputzx.my.id/api/m/brat?text=${encodeURIComponent(
    text.trim()
  )}&isAnimated=${isAnimated}&delay=500`;

  return proxyMedia(url);
}
