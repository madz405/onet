import { NextResponse } from "next/server";

export const runtime = "nodejs";

const UA =
  "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Mobile Safari/537.36";

function safeFilename(name) {
  const cleaned = (name || "unduhin-file").replace(/[\\/:*?"<>|]+/g, "_").trim();
  return cleaned.slice(0, 120) || "unduhin-file";
}

// Kenapa route ini perlu ada:
// Link video/audio/foto dari CDN pihak ketiga (TikTok, Instagram, dll) itu
// beda domain dari web kita. Atribut `download` di tag <a> browser HANYA
// dihormati untuk resource satu domain (same-origin) — untuk link beda
// domain, browser akan menavigasi/membuka tab baru alih-alih memaksa
// unduhan. Makanya tombol download tool (brat/iqc/dst, yang sudah lewat
// proxy kita) langsung kedownload, sedangkan link downloader platform malah
// pindah halaman.
//
// Solusinya: kita tarik file itu di server (jadi same-origin dari sudut
// pandang browser), lalu kirim ulang dengan header
// "Content-Disposition: attachment" — ini memaksa unduhan langsung,
// terlepas dari attribut `download` sekalipun.
export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const url = searchParams.get("url");
  const filename = safeFilename(searchParams.get("filename"));

  if (!url || !/^https?:\/\//i.test(url)) {
    return NextResponse.json({ status: false, message: "URL tidak valid." }, { status: 400 });
  }

  try {
    const res = await fetch(url, { headers: { "User-Agent": UA } });
    if (!res.ok || !res.body) {
      throw new Error("File sumber tidak bisa diakses (mungkin link sudah kedaluwarsa).");
    }

    const contentType = res.headers.get("content-type") || "application/octet-stream";
    const contentLength = res.headers.get("content-length");

    const headers = {
      "Content-Type": contentType,
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    };
    if (contentLength) headers["Content-Length"] = contentLength;

    // Streaming langsung (tanpa buffer penuh di memori) supaya file besar
    // seperti video tetap aman diteruskan.
    return new NextResponse(res.body, { status: 200, headers });
  } catch (err) {
    return NextResponse.json(
      { status: false, message: err.message || "Gagal mengunduh file." },
      { status: 502 }
    );
  }
}
