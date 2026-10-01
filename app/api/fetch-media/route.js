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
  // Mode pratinjau (inline=1): dipakai tag <video>/<audio> di hasil downloader
  // untuk platform yang CDN-nya menolak diputar langsung dari browser
  // (Douyin, Bilibili, RedNote: cek Referer / link http biasa yang diblokir
  // sebagai mixed content di halaman https). Bedanya dengan unduhan biasa:
  // Content-Disposition "inline" dan permintaan Range diteruskan, supaya
  // pemutar bisa memuat sebagian video dan melompat (seek).
  const inline = searchParams.get("inline") === "1";
  const kind = searchParams.get("type");

  if (!url || !/^https?:\/\//i.test(url)) {
    return NextResponse.json({ status: false, message: "URL tidak valid." }, { status: 400 });
  }

  try {
    const baseHeaders = { "User-Agent": UA };
    const range = req.headers.get("range");
    if (inline && range) baseHeaders.Range = range;

    // Banyak CDN menolak permintaan tanpa Referer yang masuk akal. Dicoba
    // berurutan: tanpa Referer (cara lama yang tetap berhasil untuk sebagian
    // besar), Referer dari parameter `referer` (kalau scraper menyertakan),
    // lalu Referer asal domain file itu sendiri.
    const target = new URL(url);
    const referer = searchParams.get("referer");
    const candidates = [null];
    if (referer && /^https?:\/\//i.test(referer)) candidates.push(referer);
    candidates.push(`${target.origin}/`);

    let res = null;
    for (const ref of [...new Set(candidates)]) {
      const attempt = await fetch(url, {
        headers: ref ? { ...baseHeaders, Referer: ref, Origin: new URL(ref).origin } : baseHeaders,
      });
      res = attempt;
      if (attempt.ok && attempt.body) break;
    }
    if (!res || !res.ok || !res.body) {
      throw new Error("File sumber tidak bisa diakses (mungkin link sudah kedaluwarsa).");
    }

    let contentType = res.headers.get("content-type") || "application/octet-stream";
    if (inline && kind === "video" && !/^video\//i.test(contentType)) contentType = "video/mp4";
    if (inline && kind === "audio" && !/^audio\//i.test(contentType)) contentType = "audio/mpeg";
    const contentLength = res.headers.get("content-length");

    const headers = {
      "Content-Type": contentType,
      "Content-Disposition": inline
        ? "inline"
        : `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    };
    if (contentLength) headers["Content-Length"] = contentLength;
    if (inline) {
      headers["Accept-Ranges"] = res.headers.get("accept-ranges") || "bytes";
      const contentRange = res.headers.get("content-range");
      if (contentRange) headers["Content-Range"] = contentRange;
    }

    // Streaming langsung (tanpa buffer penuh di memori) supaya file besar
    // seperti video tetap aman diteruskan. Status 206 (sebagian) ikut
    // diteruskan untuk permintaan Range.
    return new NextResponse(res.body, { status: inline ? res.status : 200, headers });
  } catch (err) {
    return NextResponse.json(
      { status: false, message: err.message || "Gagal mengunduh file." },
      { status: 502 }
    );
  }
}
