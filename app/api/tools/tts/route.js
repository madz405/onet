import { NextResponse } from "next/server";
import { generateTts } from "@/lib/scrapers/tts";
import { getVoice, DEFAULT_TTS_VOICE, TTS_MAX_CHARS } from "@/lib/ttsVoices";

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

  const text = String(body?.text || "").replace(/\s+/g, " ").trim();
  const voiceId = String(body?.voice || DEFAULT_TTS_VOICE);

  if (!text) return fail("Teks tidak boleh kosong.");
  if (text.length > TTS_MAX_CHARS) return fail(`Teks terlalu panjang (maksimal ${TTS_MAX_CHARS} karakter).`);
  // Hanya terima voice_id yang ada di daftar kita, bukan nilai sembarang dari client.
  if (!getVoice(voiceId)) return fail("Model suara tidak ditemukan.");

  try {
    const { buffer, contentType } = await generateTts({ text, voiceId });
    return new NextResponse(buffer, {
      status: 200,
      headers: { "Content-Type": contentType, "Cache-Control": "no-store" },
    });
  } catch (err) {
    return fail(err?.message || "Gagal membuat suara.", 502);
  }
}
