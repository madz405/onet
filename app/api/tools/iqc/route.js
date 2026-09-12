import { NextResponse } from "next/server";
import { proxyMedia } from "@/lib/proxyMedia";

export const runtime = "nodejs";

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const timestamp = searchParams.get("timestamp") || "";
  const statusBarTime = searchParams.get("statusBarTime") || "";
  const emojiType = searchParams.get("emojiType") || "ios";
  const signal = searchParams.get("signal") || "4";
  const battery = searchParams.get("battery") || "90";
  const carrier = searchParams.get("carrier") || "telkomsel";
  const text = searchParams.get("text") || "";

  if (!timestamp.trim() || !statusBarTime.trim()) {
    return NextResponse.json(
      { status: false, message: "Jam saat ini dan jam pesan dikirim wajib diisi." },
      { status: 400 }
    );
  }

  const params = new URLSearchParams({
    text,
    timestamp,
    emojiType,
    statusBarTime,
    signal,
    battery,
    carrier,
    key: "Bell409",
  });

  return proxyMedia(`https://api.termai.cc/api/maker/iqc?${params.toString()}`);
}
