import { NextResponse } from "next/server";

export const runtime = "nodejs";

const UA =
  "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Mobile Safari/537.36";

async function getJson(url) {
  const res = await fetch(url, { headers: { "User-Agent": UA } });
  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error("Sumber musik mengembalikan respons tidak valid.");
  }
  if (!res.ok || data?.status === false) {
    throw new Error(data?.message || "Lagu tidak ditemukan.");
  }
  return data;
}

export async function POST(req) {
  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ status: false, message: "Body tidak valid." }, { status: 400 });
  }

  const { source, query } = body || {};
  if (!query || !query.trim()) {
    return NextResponse.json({ status: false, message: "Judul lagu tidak boleh kosong." }, { status: 400 });
  }
  const q = encodeURIComponent(query.trim());

  try {
    if (source === "spotify") {
      const data = await getJson(`https://api.nexray.eu.cc/downloader/spotifyplay?q=${q}`);
      const r = data.result || {};
      return NextResponse.json({
        status: true,
        source: "spotify",
        title: r.title,
        artist: r.artist,
        album: r.album,
        duration: r.duration,
        thumbnail: r.thumbnail,
        streamUrl: r.download_url,
      });
    }

    // default: youtube
    const data = await getJson(`https://api.azbry.com/api/download/ytplay2?q=${q}`);
    const r = data.result || {};
    return NextResponse.json({
      status: true,
      source: "youtube",
      title: r.title,
      artist: r.channel,
      duration: null,
      thumbnail: r.thumbnail,
      streamUrl: r.download,
    });
  } catch (err) {
    return NextResponse.json({ status: false, message: err.message || "Lagu tidak ditemukan." }, { status: 404 });
  }
}
