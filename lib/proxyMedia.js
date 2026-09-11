import { NextResponse } from "next/server";

const UA =
  "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Mobile Safari/537.36";

// Ambil media biner (gambar/video) dari endpoint sumber dan teruskan ke
// client sebagai respons yang sama persis, tapi lewat domain kita sendiri
// (jadi tidak ada masalah CORS dan hasilnya bisa langsung dipasang di
// atribut src / diunduh).
export async function proxyMedia(sourceUrl) {
  const res = await fetch(sourceUrl, { headers: { "User-Agent": UA } });

  if (!res.ok) {
    const message = await res.text().catch(() => "");
    return NextResponse.json(
      { status: false, message: message?.slice(0, 300) || "Sumber gagal membuat medianya." },
      { status: 502 }
    );
  }

  const contentType = res.headers.get("content-type") || "application/octet-stream";
  if (contentType.includes("application/json") || contentType.includes("text/html")) {
    // Endpoint sumber balas JSON/HTML, biasanya berarti error atau parameter salah.
    const text = await res.text();
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
