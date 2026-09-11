import { NextResponse } from "next/server";
import { CHAT_SYSTEM_PROMPT } from "@/lib/chatPersona";

export const runtime = "nodejs";

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

  const url = `https://api-faa.my.id/faa/ai-promt?prompt=${encodeURIComponent(
    CHAT_SYSTEM_PROMPT
  )}&query=${encodeURIComponent(message)}`;

  try {
    const res = await fetch(url);
    const data = await res.json();
    const reply = data?.result?.response;
    if (!reply) throw new Error("empty");
    return NextResponse.json({ status: true, reply });
  } catch {
    return NextResponse.json(
      { status: false, message: "Bot lagi tidak bisa menjawab, coba lagi sebentar lagi ya." },
      { status: 502 }
    );
  }
}
