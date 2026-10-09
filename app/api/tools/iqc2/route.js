import { NextResponse } from "next/server";
import { humanCheck } from "@/lib/turnstile";
import { uploadToTop4top } from "@/lib/uploadImage";

export const runtime = "nodejs";
// Upload gambar ke image host (bisa mencoba beberapa host) + render di endpoint.
export const maxDuration = 60;

const ENDPOINT = "https://brat.siputzx.my.id/v2/iphone-quoted";
const UA =
  "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Mobile Safari/537.36";

// Nama provider yang tampil di status bar (huruf besar seperti contoh endpoint).
const CARRIERS = {
  telkomsel: "TELKOMSEL",
  indosat: "INDOSAT OOREDOO",
  xl: "XL AXIATA",
  tri: "3",
  smartfren: "SMARTFREN",
  axis: "AXIS",
};

// Jam WIB (Asia/Jakarta) format "16.42", dihitung di server pakai zona waktu
// eksplisit supaya tetap WIB walau server berjalan di UTC.
function jamWIB() {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Jakarta",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date());
  const hh = parts.find((p) => p.type === "hour")?.value ?? "00";
  const mm = parts.find((p) => p.type === "minute")?.value ?? "00";
  return `${hh}.${mm}`;
}

function fail(message, status = 400) {
  return NextResponse.json({ status: false, message }, { status });
}

function clampInt(value, min, max, fallback) {
  const n = parseInt(value, 10);
  if (Number.isNaN(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

export async function POST(req) {
  let formData;
  try {
    formData = await req.formData();
  } catch {
    return fail("Gagal membaca data yang dikirim.");
  }

  const human = await humanCheck(req, formData.get("turnstileToken"));
  if (!human.ok) return fail(human.message, 403);

  const text = (formData.get("message") || "").toString().trim();
  const imageUrlInput = (formData.get("imageUrl") || "").toString().trim();
  const file = formData.get("file");
  const hasFile = file && typeof file !== "string" && file.size > 0;

  // Minimal salah satu: pesan teks atau gambar (file / link).
  if (!text && !imageUrlInput && !hasFile) {
    return fail("Isi pesan, atau tambahkan gambar (upload file / link gambar). Minimal salah satu.");
  }
  if (imageUrlInput && !/^https?:\/\/\S+$/i.test(imageUrlInput)) {
    return fail("Link gambar tidak valid (harus diawali http:// atau https://).");
  }

  // Gambar: file upload didahulukan (di-host dulu jadi URL publik), kalau
  // tidak ada baru pakai link yang ditempel.
  let imageUrl = "";
  if (hasFile) {
    if (file.size > 8 * 1024 * 1024) return fail("Ukuran gambar maksimal 8MB.");
    try {
      const buffer = Buffer.from(await file.arrayBuffer());
      imageUrl = await uploadToTop4top(buffer, file.name || "image.jpg", file.type);
    } catch (err) {
      return fail(
        (err.message || "Gagal meng-upload gambar.") + " Coba lagi, atau tempel link gambar langsung.",
        502
      );
    }
  } else if (imageUrlInput) {
    imageUrl = imageUrlInput;
  }

  // Kedua jam opsional: kosong = jam WIB sekarang.
  const nowWIB = jamWIB();
  const statusBarTime = (formData.get("statusBarTime") || "").toString().trim() || nowWIB;
  const timestamp = (formData.get("timestamp") || "").toString().trim() || nowWIB;

  const carrierKey = (formData.get("carrier") || "telkomsel").toString();
  const body = {
    sender: "other",
    message: text,
    ...(imageUrl ? { imageUrl } : {}),
    timestamp,
    time: statusBarTime,
    status: {
      carrierName: CARRIERS[carrierKey] || CARRIERS.telkomsel,
      batteryPercentage: clampInt(formData.get("battery"), 1, 100, 90),
      signalStrength: clampInt(formData.get("signal"), 1, 4, 4),
      wifi: true,
    },
    backgroundUrl: "",
    readStatus: true,
    emojiStyle: "apple",
  };

  try {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json", "User-Agent": UA },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(40000),
    });

    const contentType = res.headers.get("content-type") || "";
    if (!res.ok || contentType.includes("application/json") || contentType.includes("text/html")) {
      const raw = await res.text().catch(() => "");
      let msg = "";
      try {
        const j = JSON.parse(raw);
        msg = j?.message || j?.error || "";
      } catch {}
      console.error("[iqc2] endpoint gagal:", res.status, raw.slice(0, 200));
      return fail(msg || "Sumber gagal membuat gambarnya. Coba lagi sebentar lagi.", 502);
    }

    const buffer = await res.arrayBuffer();
    if (!buffer || buffer.byteLength === 0) {
      return fail("Sumber mengembalikan hasil kosong. Coba lagi.", 502);
    }
    return new NextResponse(buffer, {
      status: 200,
      headers: { "Content-Type": contentType || "image/png", "Cache-Control": "no-store" },
    });
  } catch (err) {
    console.error("[iqc2] error:", err.message);
    return fail("Tidak bisa menghubungi sumber IQC V2. Coba lagi sebentar lagi.", 502);
  }
}
