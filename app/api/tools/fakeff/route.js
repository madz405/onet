import { NextResponse } from "next/server";
import { proxyMedia } from "@/lib/proxyMedia";

export const runtime = "nodejs";

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const nickname = searchParams.get("nickname");

  if (!nickname || !nickname.trim()) {
    return NextResponse.json({ status: false, message: "Nickname tidak boleh kosong." }, { status: 400 });
  }

  const url = `https://api.azbry.com/api/maker/fakeff?name=${encodeURIComponent(nickname.trim())}`;
  return proxyMedia(url);
}
