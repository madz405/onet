import { NextResponse } from "next/server";
import { proxyMedia } from "@/lib/proxyMedia";

export const runtime = "nodejs";

// Jam saat ini di WIB (Asia/Jakarta, UTC+7) dengan format "16.42".
// Dihitung di server pakai zona waktu eksplisit, jadi hasilnya tetap WIB
// walaupun server (Vercel) berjalan di UTC atau perangkat user beda zona.
function jamWIB() {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Jakarta",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date());
  const hh = parts.find((p) => p.type === "hour")?.value ?? "00";
  const mm = parts.find((p) => p.type === "minute")?.value ?? "00";
  return `${hh}.${mm}`;
}

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const timestampInput = (searchParams.get("timestamp") || "").trim();
  const statusBarInput = (searchParams.get("statusBarTime") || "").trim();
  const signal = searchParams.get("signal") || "4";
  const battery = searchParams.get("battery") || "90";
  const carrier = searchParams.get("carrier") || "telkomsel";
  const text = searchParams.get("text") || "";

  // Gaya emoji selalu "ios" (pilihan lain sudah dihapus dari form).
  const emojiType = "ios";
  // Kedua jam opsional: kalau dikosongkan, pakai jam WIB sekarang.
  const nowWIB = jamWIB();
  const timestamp = timestampInput || nowWIB;
  const statusBarTime = statusBarInput || nowWIB;

  if (!text.trim()) {
    return NextResponse.json(
      { status: false, message: "Teks tambahan wajib diisi." },
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
