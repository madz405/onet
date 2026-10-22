import { NextResponse } from "next/server";
import { reportError } from "@/lib/reportError";
import { uploadToTop4top } from "@/lib/uploadImage";
import { uploadAnyFile } from "@/lib/uploadFile";
import { proxyMedia } from "@/lib/proxyMedia";
import { upscaleHd } from "@/lib/scrapers/imgLarger";
import { removeBgILoveImg } from "@/lib/scrapers/iloveimg";
import { humanCheck } from "@/lib/turnstile";
import { TURNSTILE_TOOLS, FAKEML_RANKS, FAKEML_BORDERS } from "@/lib/tools";

export const runtime = "nodejs";
// Tool "hd": endpoint utama (Snowping) dicoba dulu, kalau gagal baru fallback ke
// scraper imglarger yang upload+polling (~15-75 detik sendiri). Worst-case
// (utama gagal lambat -> lanjut fallback) bisa mendekati/lebih dari 60 detik,
// makanya maxDuration dinaikkan ke 120.
// Kalau paket Vercel kamu (mis. Hobby) tidak mengizinkan durasi function
// sepanjang ini, kecilkan HD_TIMEOUT_MS di bawah dan/atau deadlineMs di
// pemanggilan upscaleHd, atau upgrade plan.
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
const HD_TIMEOUT_MS = 50000;
const HD_MAX_BYTES = 25 * 1024 * 1024;

// Upload foto ke host publik memakai uploader dari tool "Upload file" (lib/uploadFile.js:
// Litterbox -> Uguu -> TmpFiles). Kalau semuanya gagal, baru uploader lama (lib/uploadImage.js)
// sebagai cadangan terakhir. Masa aktif 1 jam sudah cukup: URL ini hanya dipakai sekali oleh
// endpoint pemroses. opts.firstHost (mis. "uguu") = host yang dicoba pertama.
async function hostImage(buffer, filename, contentType, opts = {}) {
  try {
    const up = await uploadAnyFile(buffer, filename, contentType, "1h", opts);
    if (up?.url) return up.url;
  } catch (err) {
    console.error("[tools] uploader utama gagal, coba uploader lama:", err.message);
  }
  return uploadToTop4top(buffer, filename, contentType);
}

// Xrina (dipakai tool editimg) dilindungi Cloudflare: IP server Vercel sering diberi halaman
// tantangan "Just a moment..." (HTTP 403 berisi HTML). Server tidak bisa melewati tantangan itu
// (butuh browser sungguhan), jadi: kenali, ingat 5 menit, dan lewati langsung dengan pesan
// yang jelas tanpa membuang waktu meng-upload foto dulu.
const XRINA_BLOCK_MS = 5 * 60 * 1000;
let xrinaBlockedUntil = 0;

function isCloudflareChallenge(status, contentType, body) {
  return (
    (status === 403 || status === 503) &&
    /text\/html/i.test(contentType || "") &&
    /just a moment|cf-chl|challenge-platform|attention required/i.test(body || "")
  );
}

// Endpoint UTAMA untuk tool "hd": Snowping (api.snowping.cfd/api/imagehd/hdr).
// Balasannya JSON: { status: 200, result: { image_url, info: { size, mimetype, format } } }
// — gambar hasilnya harus diunduh dulu dari image_url. Beda dari endpoint lain di ENDPOINTS
// di bawah, ini ditangani manual (bukan lewat proxyMedia langsung) karena hasilnya perlu
// divalidasi dulu — kalau gagal/error, kita mau fallback ke scraper imglarger, bukan langsung
// balas error ke user. Butuh URL gambar publik, makanya foto di-host dulu.
async function fetchSnowpingHd(hostedUrl) {
  const target = `https://api.snowping.cfd/api/imagehd/hdr?url=${encodeURIComponent(hostedUrl)}`;

  const res = await fetch(target, {
    headers: { "User-Agent": PROXY_UA, Accept: "application/json" },
    signal: AbortSignal.timeout(HD_TIMEOUT_MS),
  });
  const contentType = res.headers.get("content-type") || "";

  // Jaga-jaga kalau suatu saat endpoint membalas gambar langsung.
  if (res.ok && contentType.startsWith("image/")) {
    const buffer = await res.arrayBuffer();
    if (!buffer.byteLength) throw new Error("Endpoint HD utama mengembalikan hasil kosong.");
    return { buffer, contentType };
  }

  const raw = await res.text().catch(() => "");
  let json = null;
  try {
    json = JSON.parse(raw);
  } catch {
    // bukan JSON
  }

  const link = res.ok && json && Number(json.status) === 200 ? json.result?.image_url || findImageUrl(json.result) : null;
  if (typeof link === "string" && /^https:\/\//i.test(link)) {
    const imgRes = await fetch(link, {
      headers: { "User-Agent": PROXY_UA },
      signal: AbortSignal.timeout(30000),
    });
    const imgType = imgRes.headers.get("content-type") || json.result?.info?.mimetype || "";
    if (imgRes.ok && imgType.startsWith("image/")) {
      const buffer = await imgRes.arrayBuffer();
      if (buffer.byteLength && buffer.byteLength <= HD_MAX_BYTES) return { buffer, contentType: imgType };
    }
    throw new Error("Hasil HD tidak bisa diunduh dari endpoint utama.");
  }

  const msg = json?.message || json?.error || "";
  console.error("[hd] endpoint Snowping gagal:", res.status, contentType, raw.slice(0, 200));
  throw new Error(
    (typeof msg === "string" && msg.slice(0, 200)) ||
      (res.ok ? "Endpoint HD utama tidak mengembalikan gambar." : `Endpoint HD utama membalas status ${res.status}.`)
  );
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

  if (isCloudflareChallenge(res.status, contentType, raw)) {
    xrinaBlockedUntil = Date.now() + XRINA_BLOCK_MS;
    console.error("[editimg] Xrina memblokir IP server (tantangan Cloudflare), dilewati 5 menit.");
    throw new Error("Layanan edit gambar sedang memblokir server kami (proteksi Cloudflare). Coba lagi nanti.");
  }

  const msg = json?.message || json?.error || "";
  console.error("[editimg] endpoint gagal:", res.status, contentType, raw.slice(0, 200));
  throw new Error(
    (typeof msg === "string" && msg.slice(0, 200)) ||
      (res.ok ? "Endpoint tidak mengembalikan gambar." : `Endpoint edit gambar membalas status ${res.status}.`)
  );
}

const REMOVEBG_TIMEOUT_MS = 25000;

// Endpoint UTAMA untuk tool "removebg" (azbry). Sama seperti fetchSnowpingHd,
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

// Avatar default fakeml, dipilih acak kalau user tidak upload avatar sendiri.
const FAKEML_DEFAULT_AVATARS = [
  "https://c.termai.cc/i193/8n6d.jpg",
  "https://c.termai.cc/i192/GsgiwSU.jpg",
  "https://c.termai.cc/i198/ILo.jpg",
  "https://c.termai.cc/i172/WSIEp.jpg",
  "https://c.termai.cc/i172/WSIEp.jpg",
  "https://c.termai.cc/i122/2l4Ymf.jpg",
  "https://c.termai.cc/i101/iC7.jpg",
];

// Setiap builder menerima (imageUrl, formData) — imageUrl sudah di-host di
// image host publik, formData dipakai untuk tool yang butuh input tambahan selain foto
// (contoh: fakeml butuh username/rank/border, meme butuh teks atas/bawah).
// "hd" TIDAK ada di sini lagi — sekarang ditangani terpisah di bawah
// (endpoint Snowping dulu, fallback ke upscaleHd() dari
// lib/scrapers/imgLarger.js kalau gagal), bukan sekadar satu GET request
// ke URL seperti tool lain di map ini.
const ENDPOINTS = {
  removebg: (imageUrl) => `https://api.azbry.com/api/tools/removebg?url=${encodeURIComponent(imageUrl)}`,
  // fakeml: avatar = URL gambar (hasil upload user, atau salah satu avatar
  // default acak kalau user tidak upload). rank/border sudah divalidasi di POST.
  fakeml: (imageUrl, formData) => {
    const username = (formData.get("username") || "").toString().trim();
    const rank = (formData.get("rank") || "").toString().trim() || "imo";
    const border = (formData.get("border") || "").toString().trim() || "1";
    return `https://webapi-fawn.vercel.app/download/fakeml?username=${encodeURIComponent(
      username
    )}&rank=${encodeURIComponent(rank)}&border=${encodeURIComponent(border)}&avatar=${encodeURIComponent(
      imageUrl
    )}&format=image`;
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

  let file = formData.get("file");
  if (!file || typeof file === "string" || file.size === 0) file = null;
  // Avatar fakeml opsional; tool lain wajib upload file.
  if (!file && tool !== "fakeml") {
    return NextResponse.json({ status: false, message: "Pilih file gambar terlebih dahulu." }, { status: 400 });
  }
  if (file && file.size > 8 * 1024 * 1024) {
    return NextResponse.json({ status: false, message: "Ukuran gambar maksimal 8MB." }, { status: 400 });
  }
  if (tool === "fakeml") {
    const username = (formData.get("username") || "").toString().trim();
    const rank = (formData.get("rank") || "").toString().trim();
    const border = (formData.get("border") || "").toString().trim();
    if (!username) {
      return NextResponse.json({ status: false, message: "Username tidak boleh kosong." }, { status: 400 });
    }
    if (username.length > 20) {
      return NextResponse.json({ status: false, message: "Username maksimal 20 karakter." }, { status: 400 });
    }
    if (rank && !FAKEML_RANKS.some((r) => r.value === rank)) {
      return NextResponse.json({ status: false, message: "Rank tidak valid." }, { status: 400 });
    }
    if (border && !FAKEML_BORDERS.some((b) => b.value === border)) {
      return NextResponse.json({ status: false, message: "Border harus angka 1-16." }, { status: 400 });
    }
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

  // Tool "hd" dua lapis:
  // 1) Coba endpoint utama (Snowping) dulu — lebih cepat kalau lagi normal.
  // 2) Kalau itu gagal (down, rate limit, error apapun), baru fallback ke
  //    scraper imglarger (upload file langsung + polling).
  if (tool === "hd") {
    const buffer = Buffer.from(await file.arrayBuffer());
    const filename = file.name || "image.jpg";
    const contentType = file.type;

    let primaryErr = null;
    try {
      // Uguu dicoba dulu sebagai host foto: terbukti bisa dibaca endpoint Snowping.
      const hostedUrl = await hostImage(buffer, filename, contentType, { firstHost: "uguu" });
      const primary = await fetchSnowpingHd(hostedUrl);
      return new NextResponse(primary.buffer, {
        status: 200,
        headers: { "Content-Type": primary.contentType, "Cache-Control": "no-store" },
      });
    } catch (err) {
      primaryErr = err;
    }

    try {
      // Utama sudah gagal, jadi sisa waktu function lebih banyak: cadangan boleh menunggu lebih lama.
      const resultUrl = await upscaleHd(buffer, filename, contentType, { deadlineMs: 75000 });
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

  // Tool "editimg": upload foto ke image host dulu, lalu kirim URL + prompt.
  if (tool === "editimg") {
    const prompt = (formData.get("prompt") || "").toString().replace(/\s+/g, " ").trim();
    if (Date.now() < xrinaBlockedUntil) {
      return NextResponse.json(
        { status: false, message: "Layanan edit gambar sedang memblokir server kami (proteksi Cloudflare). Coba lagi nanti." },
        { status: 503 }
      );
    }
    try {
      const buffer = Buffer.from(await file.arrayBuffer());
      const hostedUrl = await hostImage(buffer, file.name || "image.jpg", file.type);
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
      hostedUrl = await hostImage(buffer, filename, contentType);
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
    let hostedUrl;
    if (file) {
      const buffer = Buffer.from(await file.arrayBuffer());
      hostedUrl = await hostImage(buffer, file.name || "image.jpg", file.type);
    } else {
      // Tanpa avatar sendiri (fakeml): pilih avatar default secara acak.
      hostedUrl = FAKEML_DEFAULT_AVATARS[Math.floor(Math.random() * FAKEML_DEFAULT_AVATARS.length)];
    }
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
