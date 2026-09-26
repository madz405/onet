import { NextResponse } from "next/server";
import { CHAT_SYSTEM_PROMPT, CHAT_BOT_NAME } from "@/lib/chatPersona";
import { SITE_NAME } from "@/lib/site";

export const runtime = "nodejs";

// Model per catatan resmi Gemini: gemini-2.0-flash (dkk) sudah dimatikan
// per 1 Juni 2026. gemini-3.1-flash-lite dipakai sebagai cadangan kedua
// kalau gemini-3.5-flash lagi overload (dua model beda jarang overload
// bareng di waktu yang sama).
const GEMINI_MODELS = ["gemini-3.5-flash", "gemini-3.1-flash-lite"];

function isOverloadedError(message) {
  return /high demand|overloaded|503|UNAVAILABLE/i.test(message || "");
}

async function callGemini(model, message, apiKey) {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
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
    throw new Error(data?.error?.message || `status ${res.status}`);
  }

  const reply = data?.candidates?.[0]?.content?.parts
    ?.map((p) => p.text || "")
    .join("")
    .trim();
  if (!reply) throw new Error("Gemini tidak mengembalikan teks jawaban (mungkin kena safety filter).");
  return reply;
}

// Coba tiap model di GEMINI_MODELS berurutan; retry sekali per model kalau
// errornya "lagi overload" (biasanya cuma sebentar), baru pindah ke model
// berikutnya kalau masih gagal juga.
async function askGemini(message) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY belum diatur di environment variable.");

  let lastErr;
  for (const model of GEMINI_MODELS) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        return await callGemini(model, message, apiKey);
      } catch (err) {
        lastErr = err;
        console.error(`[chat] ${model} percobaan ${attempt + 1} gagal:`, err.message);
        if (!isOverloadedError(err.message)) break; // error selain overload, langsung pindah model
        await new Promise((r) => setTimeout(r, 800));
      }
    }
  }
  throw lastErr;
}

// Cadangan kalau kedua model Gemini gagal — pakai Logic Bell (api.termai.cc),
// host yang sama juga dipakai downloader Instagram & maker iqc di project
// ini jadi kemungkinan besar tidak diblokir firewall macam api-faa.my.id.
// Bawaannya API ini punya memori percakapan per `id` sesi (dikirim dari
// client sebagai sessionId), tapi tetap jalan tanpa itu kalau tidak dikirim.
async function callLogicBell(message, sessionId) {
  const res = await fetch("https://api.termai.cc/api/chat/logic-bell?key=Bell409", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      text: message,
      id: sessionId || `web-${Date.now()}`,
      fullainame: `${CHAT_BOT_NAME} - Asisten ${SITE_NAME}`,
      nickainame: CHAT_BOT_NAME,
      senderName: "Pengunjung",
      ownerName: SITE_NAME,
      date: new Date().toISOString(),
      role: "Asisten Website",
      custom_profile: CHAT_SYSTEM_PROMPT,
      msgtype: "text",
    }),
    signal: AbortSignal.timeout(20000),
  });

  const data = await res.json().catch(() => null);
  const reply = data?.data?.msg;
  if (!data?.status || !reply) {
    throw new Error(data?.msg || "Logic Bell tidak mengembalikan jawaban.");
  }
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
  const sessionId = typeof body?.sessionId === "string" ? body.sessionId.slice(0, 100) : null;
  if (!message) {
    return NextResponse.json({ status: false, message: "Pesan tidak boleh kosong." }, { status: 400 });
  }
  if (message.length > 1000) {
    return NextResponse.json({ status: false, message: "Pesan terlalu panjang." }, { status: 400 });
  }

  try {
    const reply = await callLogicBell(message, sessionId).catch((err) => {
      console.error("[chat] Logic Bell gagal, coba Gemini:", err.message);
      return askGemini(message);
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



