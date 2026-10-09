import { NextResponse } from "next/server";
import { findAlightMotionPreset, isTikTokUrl } from "@/lib/scrapers/amfinder";

export const runtime = "nodejs";
export const maxDuration = 60;

function fail(message, status = 400) {
  return NextResponse.json({ status: false, message }, { status });
}

export async function POST(req) {
  let body;
  try {
    body = await req.json();
  } catch {
    return fail("Permintaan tidak valid.");
  }

  const url = String(body?.url || "").trim();
  if (!url) return fail("Link TikTok tidak boleh kosong.");
  if (url.length > 500 || !isTikTokUrl(url)) return fail("Link TikTok tidak valid.");

  try {
    const data = await findAlightMotionPreset(url);
    return NextResponse.json(data, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    return fail(err?.message || "Gagal mencari preset.", 502);
  }
}
