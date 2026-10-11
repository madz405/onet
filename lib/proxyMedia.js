import { NextResponse } from "next/server";
import { reportError } from "@/lib/reportError";

const UA =
  "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Mobile Safari/537.36";

// Ambil media biner (gambar/video) dari endpoint sumber dan teruskan ke
// client sebagai respons yang sama persis, tapi lewat domain kita sendiri
// (jadi tidak ada masalah CORS dan hasilnya bisa langsung dipasang di
// atribut src / diunduh).
export async function proxyMedia(sourceUrl) {
  // Nama sumber untuk laporan: hanya host + path (tanpa query, supaya teks/URL
  // milik pengunjung tidak ikut terkirim).
  let label = "proxyMedia";
  try {
    const u = new URL(sourceUrl);
    label = `sumber media: ${u.host}${u.pathname}`;
  } catch {
    // abaikan
  }

  let res;
  try {
    res = await fetch(sourceUrl, { headers: { "User-Agent": UA } });
  } catch (err) {
    await reportError(label, err);
    return NextResponse.json(
      { status: false, message: "Tidak bisa menghubungi sumber. Coba lagi sebentar lagi." },
      { status: 502 }
    );
  }

  if (!res.ok) {
    const message = await res.text().catch(() => "");
    await reportError(label, new Error(`HTTP ${res.status}: ${message?.slice(0, 120) || "tanpa isi"}`));
    return NextResponse.json(
      { status: false, message: message?.slice(0, 300) || "Sumber gagal membuat medianya." },
      { status: 502 }
    );
  }

  const contentType = res.headers.get("content-type") || "application/octet-stream";
  if (contentType.includes("application/json") || contentType.includes("text/html")) {
    // Endpoint sumber balas JSON/HTML, biasanya berarti error atau parameter salah.
    const text = await res.text();
    await reportError(label, new Error(`Balasan bukan media (${contentType.split(";")[0]}): ${text?.slice(0, 120)}`));
    return NextResponse.json(
      { status: false, message: text?.slice(0, 300) || "Parameter tidak valid." },
      { status: 400 }
    );
  }

  const buffer = await res.arrayBuffer();
  return new NextResponse(buffer, {
    status: 200,
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "no-store",
    },
  });
}
