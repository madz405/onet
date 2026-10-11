import { NextResponse } from "next/server";
import { reportError } from "@/lib/reportError";
import { uploadToTop4top } from "@/lib/uploadImage";
import { proxyMedia } from "@/lib/proxyMedia";
import { upscaleHd } from "@/lib/scrapers/imgLarger";
import { removeBgILoveImg } from "@/lib/scrapers/iloveimg";
import { humanCheck } from "@/lib/turnstile";
import { TURNSTILE_TOOLS } from "@/lib/tools";

export const runtime = "nodejs";
// Tool "hd" sekarang bisa nunggu lama: endpoint utama (nexray) dicoba dulu,
// kalau gagal baru fallback ke scraper imglarger yang upload+polling
// (~15-40 detik sendiri). Worst-case (utama gagal lambat -> lanjut fallback)
// bisa mendekati/lebih dari 60 detik, makanya maxDuration dinaikkan ke 120.
// Kalau paket Vercel kamu (mis. Hobby) tidak mengizinkan durasi function
// sepanjang ini, kecilkan NEXRAY_TIMEOUT_MS di bawah dan/atau DEADLINE_MS di
// lib/scrapers/imgLarger.js, atau upgrade plan.
// Tool "removebg" juga dua lapis (azbry -> scraper iLoveIMG), worst-case masih
// di bawah batas ini.
export const maxDuration = 120;

// memegen.link pakai skema escape sendiri untuk teks di dalam path URL
// (bukan encodeURIComponent biasa), supaya karakter seperti "/" atau "?"
// di dalam teks tidak dianggap bagian dari struktur URL. Referensi lengkap
// ada di dokumentasi memegen.link, ini rule-rule utamanya:
// - baris kosong -> "_"
// - spasi -> "_"
// - "_" asli di teks -> "__"
// - "-" asli di teks -> "--"
// - "?" -> "~q"   "%" -> "~p"   "#" -> "~h"   "/" -> "~s"
function memegenEncode(text) {
  const trimmed = (text || "").toString().trim();
  if (!trimmed) return "_";
  const escaped = trimmed
    .replace(/_/g, "__")
    .replace(/-/g, "--")
    .replace(/\?/g, "~q")
    .replace(/%/g, "~p")
    .replace(/#/g, "~h")
    .replace(/\//g, "~s")
    .replace(/\s+/g, "_");
  // Lapisan pengaman terakhir untuk karakter non-ASCII (emoji, dll) — aman
  // dipakai di sini karena "~" dan huruf tidak ikut ter-encode ulang.
  return encodeURIComponent(escaped);
}

const PROXY_UA =
  "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Mobile Safari/537.36";
const NEXRAY_TIMEOUT_MS = 25000;

// Endpoint UTAMA untuk tool "hd". Beda dari endpoint lain di ENDPOINTS di
// bawah, ini butuh ditangani manual (bukan lewat proxyMedia langsung) karena
// hasilnya perlu divalidasi dulu sebelum dipakai — kalau gagal/error, kita
// mau fallback ke scraper imglarger, bukan langsung balas error ke user.
// Endpoint ini juga butuh URL gambar publik (bukan file upload langsung),
// makanya tetap lewat top4top dulu seperti endpoint lama.
async function fetchNexrayHd(hostedUrl) {
  const target = `https://api.nexray.eu.cc/tools/v4/upscale?url=${encodeURIComponent(hostedUrl)}&resolusi=4`;

  const res = await fetch(target, {
    headers: { "User-Agent": PROXY_UA },
    signal: AbortSignal.timeout(NEXRAY_TIMEOUT_MS),
  });

  if (!res.ok) {
    throw new Error(`Endpoint HD utama membalas status ${res.status}.`);
  }

  const contentType = res.headers.get("content-type") || "";
  // Endpoint ini memang balas media langsung (bukan JSON) kalau sukses.
  // Kalau balasannya JSON/HTML, berarti itu pesan error dari servernya.
  if (contentType.includes("application/json") || contentType.includes("text/html")) {
    const text = await res.text().catch(() => "");
    throw new Error(text?.slice(0, 200) || "Endpoint HD utama tidak mengembalikan gambar.");
  }

  const buffer = await res.arrayBuffer();
  if (!buffer || buffer.byteLength === 0) {
    throw new Error("Endpoint HD utama mengembalikan hasil kosong.");
  }

  return { buffer, contentType: contentType || "image/jpeg" };
}

const EDITIMG_TIMEOUT_MS = 90000;
const EDITIMG_MAX_PROMPT = 500;
const EDITIMG_MAX_BYTES = 15 * 1024 * 1024;

// Cari URL gambar di dalam balasan JSON (kalau endpoint membalas JSON, bukan
// gambar langsung). Mengutamakan key yang umum: url / image / result / data.
function findImageUrl(node, depth = 0) {
  if (depth > 4 || node == null) return null;
  if (typeof node === "string") return /^https:\/\/\S+$/i.test(node.trim()) ? node.trim() : null;
  if (Array.isArray(node)) {
    for (const item of node) {
      const hit = findImageUrl(item, depth + 1);
      if (hit) return hit;
    }
    return null;
  }
  if (typeof node === "object") {
    for (const key of ["url", "image", "result", "data", "output"]) {
      if (key in node) {
        const hit = findImageUrl(node[key], depth + 1);
        if (hit) return hit;
      }
    }
    for (const value of Object.values(node)) {
      const hit = findImageUrl(value, depth + 1);
      if (hit) return hit;
    }
  }
  return null;
}

// Tool "editimg": endpoint Xrina (Flux Kontext). Foto sudah di-host jadi URL
// publik. Endpoint bisa membalas gambar langsung ATAU JSON berisi link gambar,
// dua-duanya ditangani. Prosesnya AI, jadi bisa memakan waktu puluhan detik.
async function fetchEditImg(hostedUrl, prompt) {
  const target = `https://apiii-xrina.my.id/ai-image/editimg?image=${encodeURIComponent(
    hostedUrl
  )}&prompt=${encodeURIComponent(prompt)}`;

  const res = await fetch(target, {
    headers: { "User-Agent": PROXY_UA },
    signal: AbortSignal.timeout(EDITIMG_TIMEOUT_MS),
  });
  const contentType = res.headers.get("content-type") || "";

  if (res.ok && contentType.startsWith("image/")) {
    const buffer = await res.arrayBuffer();
    if (!buffer.byteLength) throw new Error("Endpoint edit gambar mengembalikan hasil kosong.");
    return { buffer, contentType };
  }

  const raw = await res.text().catch(() => "");
  let json = null;
  try {
    json = JSON.parse(raw);
  } catch {
    // bukan JSON
  }

  const link = json && res.ok ? findImageUrl(json) : null;
  if (link) {
    const imgRes = await fetch(link, {
      headers: { "User-Agent": PROXY_UA },
      signal: AbortSignal.timeout(30000),
    });
    const imgType = imgRes.headers.get("content-type") || "";
    if (imgRes.ok && imgType.startsWith("image/")) {
      const buffer = await imgRes.arrayBuffer();
      if (buffer.byteLength && buffer.byteLength <= EDITIMG_MAX_BYTES) return { buffer, contentType: imgType };
    }
  }

  const msg = json?.message || json?.error || "";
  console.error("[editimg] endpoint gagal:", res.status, contentType, raw.slice(0, 200));
  throw new Error(
    (typeof msg === "string" && msg.slice(0, 200)) ||
      (res.ok ? "Endpoint tidak mengembalikan gambar." : `Endpoint edit gambar membalas status ${res.status}.`)
  );
}

const REMOVEBG_TIMEOUT_MS = 25000;

// Endpoint UTAMA untuk tool "removebg" (azbry). Sama seperti fetchNexrayHd,
// hasilnya divalidasi dulu (bukan langsung diteruskan lewat proxyMedia) supaya
// kalau gagal bisa jatuh ke scraper cadangan iLoveIMG, bukan langsung error.
async function fetchRemoveBgEndpoint(hostedUrl) {
  const res = await fetch(ENDPOINTS.removebg(hostedUrl), {
    headers: { "User-Agent": PROXY_UA },
    signal: AbortSignal.timeout(REMOVEBG_TIMEOUT_MS),
  });

  if (!res.ok) {
    throw new Error(`Endpoint removebg utama membalas status ${res.status}.`);
  }

  const contentType = res.headers.get("content-type") || "";
  // Kalau sukses, endpoint ini membalas gambar langsung. JSON/HTML berarti
  // pesan error dari servernya.
  if (contentType.includes("application/json") || contentType.includes("text/html")) {
    const text = await res.text().catch(() => "");
    throw new Error(text?.slice(0, 200) || "Endpoint removebg utama tidak mengembalikan gambar.");
  }

  const buffer = await res.arrayBuffer();
  if (!buffer || buffer.byteLength === 0) {
    throw new Error("Endpoint removebg utama mengembalikan hasil kosong.");
  }

  return { buffer, contentType: contentType || "image/png" };
}

// Setiap builder menerima (imageUrl, formData) — imageUrl sudah di-host di
// top4top, formData dipakai untuk tool yang butuh input tambahan selain foto
// (contoh: fakeml butuh nickname, meme butuh teks atas/bawah).
// "hd" TIDAK ada di sini lagi — sekarang ditangani terpisah di bawah
// (endpoint nexray dulu, fallback ke upscaleHd() dari
// lib/scrapers/imgLarger.js kalau gagal), bukan sekadar satu GET request
// ke URL seperti tool lain di map ini.
const ENDPOINTS = {
  removebg: (imageUrl) => `https://api.azbry.com/api/tools/removebg?url=${encodeURIComponent(imageUrl)}`,
  fakeml: (imageUrl, formData) => {
    const nickname = (formData.get("nickname") || "").toString().trim();
    return `https://api.nexray.web.id/maker/fakelobyml?avatar=${encodeURIComponent(
      imageUrl
    )}&nickname=${encodeURIComponent(nickname)}`;
  },
  meme: (imageUrl, formData) => {
    const top = memegenEncode(formData.get("topText"));
    const bottom = memegenEncode(formData.get("bottomText"));
    return `https://api.memegen.link/images/custom/${top}/${bottom}.png?background=${encodeURIComponent(
      imageUrl
    )}`;
  },
};

export async function POST(req) {
  const { searchParams } = new URL(req.url);
  const tool = searchParams.get("tool");

  if (tool !== "hd" && tool !== "editimg" && !ENDPOINTS[tool]) {
    return NextResponse.json({ status: false, message: "Tool tidak dikenali." }, { status: 400 });
  }

  let formData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ status: false, message: "Gagal membaca file yang diunggah." }, { status: 400 });
  }

  // Verifikasi Turnstile untuk tool yang dilindungi (daftar di lib/tools.js),
  // sebelum upload ke host atau endpoint luar dijalankan.
  if (TURNSTILE_TOOLS.includes(tool)) {
    const human = await humanCheck(req, formData.get("turnstileToken"));
    if (!human.ok) {
      return NextResponse.json({ status: false, message: human.message }, { status: 403 });
    }
  }

  const file = formData.get("file");
  if (!file || typeof file === "string") {
    return NextResponse.json({ status: false, message: "Pilih file gambar terlebih dahulu." }, { status: 400 });
  }
  if (file.size > 8 * 1024 * 1024) {
    return NextResponse.json({ status: false, message: "Ukuran gambar maksimal 8MB." }, { status: 400 });
  }
  if (tool === "fakeml" && !formData.get("nickname")?.toString().trim()) {
    return NextResponse.json({ status: false, message: "Nickname tidak boleh kosong." }, { status: 400 });
  }
  if (tool === "meme") {
    const top = (formData.get("topText") || "").toString().trim();
    const bottom = (formData.get("bottomText") || "").toString().trim();
    if (!top && !bottom) {
      return NextResponse.json(
        { status: false, message: "Isi minimal salah satu: teks atas atau teks bawah." },
        { status: 400 }
      );
    }
  }

  if (tool === "editimg") {
    const prompt = (formData.get("prompt") || "").toString().replace(/\s+/g, " ").trim();
    if (!prompt) {
      return NextResponse.json({ status: false, message: "Prompt tidak boleh kosong." }, { status: 400 });
    }
    if (prompt.length > EDITIMG_MAX_PROMPT) {
      return NextResponse.json(
        { status: false, message: `Prompt maksimal ${EDITIMG_MAX_PROMPT} karakter.` },
        { status: 400 }
      );
    }
  }

  // Tool "hd" sekarang dua lapis:
  // 1) Coba endpoint utama (nexray) dulu — lebih cepat kalau lagi normal.
  // 2) Kalau itu gagal (down, rate limit, error apapun), baru fallback ke
  //    scraper imglarger (upload file langsung + polling).
  if (tool === "hd") {
    const buffer = Buffer.from(await file.arrayBuffer());
    const filename = file.name || "image.jpg";
    const contentType = file.type;

    try {
      const hostedUrl = await uploadToTop4top(buffer, filename, contentType);
      const primary = await fetchNexrayHd(hostedUrl);
      return new NextResponse(primary.buffer, {
        status: 200,
        headers: { "Content-Type": primary.contentType, "Cache-Control": "no-store" },
      });
    } catch (primaryErr) {
      try {
        const resultUrl = await upscaleHd(buffer, filename, contentType);
        return proxyMedia(resultUrl);
      } catch (fallbackErr) {
        await reportError("tool: Perjelas Foto (HD)", fallbackErr, { endpointUtama: primaryErr?.message });
        return NextResponse.json(
          {
            status: false,
            message:
              fallbackErr.message ||
              "Gagal memperjelas foto (endpoint utama & cadangan sama-sama gagal).",
          },
          { status: 500 }
        );
      }
    }
  }

  // Tool "editimg": upload foto ke image host dulu, lalu kirim URL + prompt.
  if (tool === "editimg") {
    const prompt = (formData.get("prompt") || "").toString().replace(/\s+/g, " ").trim();
    try {
      const buffer = Buffer.from(await file.arrayBuffer());
      const hostedUrl = await uploadToTop4top(buffer, file.name || "image.jpg", file.type);
      const result = await fetchEditImg(hostedUrl, prompt);
      return new NextResponse(result.buffer, {
        status: 200,
        headers: { "Content-Type": result.contentType, "Cache-Control": "no-store" },
      });
    } catch (err) {
      const timedOut = err?.name === "TimeoutError" || err?.name === "AbortError";
      await reportError("tool: Edit Foto AI", timedOut ? new Error("Timeout (>90 detik)") : err);
      return NextResponse.json(
        {
          status: false,
          message: timedOut
            ? "Proses edit terlalu lama. Coba lagi, atau pakai prompt/foto yang lebih sederhana."
            : err.message || "Gagal mengedit gambar.",
        },
        { status: 502 }
      );
    }
  }

  // Tool "removebg" dua lapis (pola sama seperti "hd"):
  // 1) Endpoint utama (azbry) dulu, butuh URL gambar yang sudah di-host.
  // 2) Kalau gagal (down, rate limit, image host gagal, dll), pakai scraper
  //    iLoveIMG yang bisa menerima file langsung, jadi tetap jalan walau
  //    image host sedang bermasalah.
  if (tool === "removebg") {
    const buffer = Buffer.from(await file.arrayBuffer());
    const filename = file.name || "image.jpg";
    const contentType = file.type;
    let hostedUrl = null;

    try {
      hostedUrl = await uploadToTop4top(buffer, filename, contentType);
      const primary = await fetchRemoveBgEndpoint(hostedUrl);
      return new NextResponse(primary.buffer, {
        status: 200,
        headers: { "Content-Type": primary.contentType, "Cache-Control": "no-store" },
      });
    } catch (primaryErr) {
      console.error("[removebg] endpoint utama gagal, pakai scraper iLoveIMG:", primaryErr.message);
      try {
        const fallback = await removeBgILoveImg(buffer, filename, contentType, { imageUrl: hostedUrl });
        return new NextResponse(fallback.buffer, {
          status: 200,
          headers: { "Content-Type": fallback.contentType, "Cache-Control": "no-store" },
        });
      } catch (fallbackErr) {
        console.error("[removebg] scraper iLoveIMG juga gagal:", fallbackErr.message);
        await reportError("tool: Hapus Background", fallbackErr, { endpointUtama: primaryErr?.message });
        return NextResponse.json(
          { status: false, message: "Gagal menghapus background (endpoint utama & cadangan sama-sama gagal), coba lagi." },
          { status: 500 }
        );
      }
    }
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const hostedUrl = await uploadToTop4top(buffer, file.name || "image.jpg", file.type);
    const targetUrl = ENDPOINTS[tool](hostedUrl, formData);
    return proxyMedia(targetUrl);
  } catch (err) {
    await reportError(`tool: ${tool}`, err);
    return NextResponse.json(
      { status: false, message: err.message || "Gagal memproses gambar." },
      { status: 500 }
    );
  }
}
