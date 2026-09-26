import { NextResponse } from "next/server";

export const runtime = "nodejs";

const UA =
  "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Mobile Safari/537.36";

async function getJson(url) {
  const res = await fetch(url, {
    headers: {
      "User-Agent": UA,
      Accept: "application/json, text/plain, */*",
      // Beberapa endpoint API komunitas (termasuk api-faa.my.id) memfilter
      // request tanpa Referer yang wajar — tanpa ini kadang server langsung
      // balas halaman blokir/HTML, bukan JSON.
      Referer: new URL(url).origin + "/",
    },
  });
  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    // Log detail asli ke server (kelihatan di log Vercel) supaya penyebab
    // "respons tidak valid" ketahuan persis — biasanya karena server
    // (IP datacenter Vercel) diblokir/di-challenge oleh proteksi bot si
    // endpoint, sedangkan tes manual dari browser (IP rumah) lolos.
    console.error(
      `[music] non-JSON dari ${url} — status ${res.status}, cuplikan: ${text.slice(0, 300)}`
    );
    throw new Error(`Sumber musik mengembalikan respons tidak valid (status ${res.status}).`);
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

    if (source === "soundcloud") {
      const data = await getJson(`https://api-faa.my.id/faa/soundcloud-play?query=${q}`);
      const r = data.result || {};
      return NextResponse.json({
        status: true,
        source: "soundcloud",
        title: r.title,
        artist: r.user,
        // API ini mengembalikan durasi dalam milidetik, bukan detik.
        duration: typeof r.duration === "number" ? Math.round(r.duration / 1000) : null,
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
