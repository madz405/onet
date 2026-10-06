import { NextResponse } from "next/server";

export const runtime = "nodejs";

// Proxy cover lagu untuk Media Session (notifikasi / layar kunci HP).
// Cover lagu berasal dari CDN pihak ketiga; gambar itu diambil oleh sistem
// operasi, bukan oleh halaman, jadi hotlink protection / mixed content / CORS
// sering membuatnya gagal tampil. Lewat route ini cover jadi same-origin dan
// bisa di-cache browser.

const UA =
  "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Mobile Safari/537.36";
const MAX_BYTES = 4 * 1024 * 1024;
const MAX_REDIRECTS = 3;

// Tolak alamat internal supaya route ini tidak bisa dipakai memindai jaringan server (SSRF).
function isBlockedHost(hostname) {
  const h = hostname.toLowerCase();
  if (h === "localhost" || h.endsWith(".local") || h.endsWith(".internal") || h === "[::1]") return true;
  const m = h.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
  if (!m) return h.startsWith("[");
  const [a, b] = [Number(m[1]), Number(m[2])];
  return (
    a === 0 || a === 10 || a === 127 || (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168)
  );
}

function parseSafeUrl(value) {
  try {
    const u = new URL(value);
    if (!/^https?:$/.test(u.protocol) || isBlockedHost(u.hostname)) return null;
    return u;
  } catch {
    return null;
  }
}

export async function GET(req) {
  let target = parseSafeUrl(new URL(req.url).searchParams.get("url") || "");
  if (!target) return NextResponse.json({ status: false, message: "URL tidak valid." }, { status: 400 });

  try {
    let res;
    for (let i = 0; i <= MAX_REDIRECTS; i++) {
      res = await fetch(target, {
        headers: { "User-Agent": UA, Accept: "image/*" },
        redirect: "manual",
        signal: AbortSignal.timeout(8000),
      });
      const loc = res.headers.get("location");
      if (res.status >= 300 && res.status < 400 && loc) {
        const next = parseSafeUrl(new URL(loc, target).toString());
        if (!next) throw new Error("redirect tidak aman");
        target = next;
        continue;
      }
      break;
    }

    const type = res.headers.get("content-type") || "";
    if (!res.ok || !type.startsWith("image/")) {
      return NextResponse.json({ status: false, message: "Cover tidak tersedia." }, { status: 502 });
    }
    const buf = await res.arrayBuffer();
    if (buf.byteLength > MAX_BYTES) {
      return NextResponse.json({ status: false, message: "Cover terlalu besar." }, { status: 413 });
    }
    return new NextResponse(buf, {
      status: 200,
      headers: { "Content-Type": type, "Cache-Control": "public, max-age=86400" },
    });
  } catch {
    return NextResponse.json({ status: false, message: "Gagal mengambil cover." }, { status: 502 });
  }
}
