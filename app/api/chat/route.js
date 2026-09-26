import { NextResponse } from "next/server";
import { CHAT_SYSTEM_PROMPT } from "@/lib/chatPersona";

export const runtime = "nodejs";

// Model per catatan resmi Gemini: gemini-2.0-flash (dkk) sudah dimatikan
// per 1 Juni 2026, penggantinya gemini-3.5-flash / gemini-3.1-flash-lite.
const GEMINI_MODEL = "gemini-3.5-flash";

async function askGemini(message) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY belum diatur di environment variable.");

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: CHAT_SYSTEM_PROMPT }] },
        contents: [{ role: "user", parts: [{ text: message }] }],
        generationConfig: { maxOutputTokens: 512 },
      }),
      signal: AbortSignal.timeout(20000),
    }
  );

  const data = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(`Gemini balas error: ${data?.error?.message || `status ${res.status}`}`);
  }

  const reply = data?.candidates?.[0]?.content?.parts
    ?.map((p) => p.text || "")
    .join("")
    .trim();
  if (!reply) throw new Error("Gemini tidak mengembalikan teks jawaban (mungkin kena safety filter).");
  return reply;
}

// Cadangan lama — dibiarkan jaga-jaga kalau GEMINI_API_KEY belum diisi atau
// Gemini lagi bermasalah, walau endpoint ini sendiri kadang diblokir
// firewall si penyedia saat dipanggil dari IP server (Vercel).
async function askFaaFallback(message) {
  const url = `https://api-faa.my.id/faa/ai-promt?prompt=${encodeURIComponent(
    CHAT_SYSTEM_PROMPT
  )}&query=${encodeURIComponent(message)}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
  const data = await res.json();
  const reply = data?.result?.response;
  if (!reply) throw new Error("Endpoint faa tidak mengembalikan jawaban.");
  return reply;
}

export async function POST(req) {
  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ status: false, message: "Body tidak valid." }, { status: 400 });
  }

  const message = (body?.message || "").trim();
  if (!message) {
    return NextResponse.json({ status: false, message: "Pesan tidak boleh kosong." }, { status: 400 });
  }
  if (message.length > 1000) {
    return NextResponse.json({ status: false, message: "Pesan terlalu panjang." }, { status: 400 });
  }

  try {
    const reply = await askGemini(message).catch((err) => {
      console.error("[chat] Gemini gagal, pakai endpoint cadangan:", err.message);
      return askFaaFallback(message);
    });
    return NextResponse.json({ status: true, reply });
  } catch (err) {
    console.error("[chat] semua sumber gagal:", err.message);
    return NextResponse.json(
      { status: false, message: "Bot lagi tidak bisa menjawab, coba lagi sebentar lagi ya." },
      { status: 502 }
    );
  }
}

