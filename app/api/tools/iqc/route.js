import { NextResponse } from "next/server";
import { proxyMedia } from "@/lib/proxyMedia";

export const runtime = "nodejs";

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const text = searchParams.get("text") || "";
  const provider = searchParams.get("provider") || "telkomsel";
  const jam = searchParams.get("jam") || "";
  const baterai = searchParams.get("baterai") || "90";

  if (!jam.trim()) {
    return NextResponse.json({ status: false, message: "Jam wajib diisi." }, { status: 400 });
  }

  const url = `https://api.nexray.eu.cc/maker/v1/iqc?text=${encodeURIComponent(
    text
  )}&provider=${encodeURIComponent(provider)}&jam=${encodeURIComponent(jam)}&baterai=${encodeURIComponent(
    baterai
  )}`;

  return proxyMedia(url);
}
