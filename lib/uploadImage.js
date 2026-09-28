// Upload gambar -> URL publik, dengan beberapa host berurutan (fallback).
// Kalau satu host down / memblokir IP Vercel, otomatis lanjut ke host berikutnya.
//
// Drop-in: nama export lama `uploadToTop4top` tetap ada, jadi
// app/api/tools/process/route.js tidak perlu diubah.
//
// Opsional (paling stabil): isi env IMGBB_KEY (gratis di api.imgbb.com).
// Kalau kosong, provider imgbb otomatis dilewati.

const UA =
  "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Mobile Safari/537.36";
const TIMEOUT_MS = 12000;

const isUrl = (s) => typeof s === "string" && /^https?:\/\/\S+$/i.test(s.trim());

function makeForm(fieldName, buffer, filename, contentType, extra = {}) {
  const form = new FormData();
  for (const [k, v] of Object.entries(extra)) form.append(k, v);
  form.append(fieldName, new Blob([buffer], { type: contentType || "application/octet-stream" }), filename);
  return form;
}

async function post(url, body, headers = {}) {
  return fetch(url, {
    method: "POST",
    body,
    headers: { "User-Agent": UA, ...headers },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
}

// --- Provider -------------------------------------------------------------

// ImgBB: API resmi, paling stabil. File otomatis kedaluwarsa (1 jam).
async function imgbb(buffer) {
  const key = process.env.IMGBB_KEY;
  if (!key) throw new Error("IMGBB_KEY kosong");
  const form = new FormData();
  form.append("image", buffer.toString("base64"));
  const res = await post(`https://api.imgbb.com/1/upload?expiration=3600&key=${key}`, form);
  const json = await res.json();
  return json?.data?.url;
}

// Litterbox (catbox): file sementara, otomatis hilang setelah 1 jam.
async function litterbox(buffer, filename, contentType) {
  const form = makeForm("fileToUpload", buffer, filename, contentType, { reqtype: "fileupload", time: "1h" });
  const res = await post("https://litterbox.catbox.moe/resources/internals/api.php", form);
  return (await res.text()).trim();
}

// Uguu: file sementara (24 jam). Balasan bisa teks polos atau JSON.
async function uguu(buffer, filename, contentType) {
  const form = makeForm("files[]", buffer, filename, contentType);
  const res = await post("https://uguu.se/upload", form);
  const text = (await res.text()).trim();
  if (isUrl(text)) return text;
  try {
    return JSON.parse(text)?.files?.[0]?.url;
  } catch {
    return null;
  }
}

// Catbox: permanen (file tetap online selamanya), jadi ditaruh belakang.
async function catbox(buffer, filename, contentType) {
  const form = makeForm("fileToUpload", buffer, filename, contentType, { reqtype: "fileupload" });
  const res = await post("https://catbox.moe/user/api.php", form);
  return (await res.text()).trim();
}

// tmpfiles.org: URL hasil perlu diubah ke bentuk /dl/ supaya langsung berupa file.
async function tmpfiles(buffer, filename, contentType) {
  const form = makeForm("file", buffer, filename, contentType);
  const res = await post("https://tmpfiles.org/api/v1/upload", form);
  const json = await res.json();
  const url = json?.data?.url;
  return url ? url.replace("tmpfiles.org/", "tmpfiles.org/dl/") : null;
}

// top4top: scraper lama, dijadikan pilihan terakhir.
async function top4top(buffer, filename, contentType) {
  const initRes = await fetch("https://top4top.io/", {
    headers: { "User-Agent": UA },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  const initHtml = await initRes.text();
  const sid = initHtml.match(/name=["']sid["'][^>]*value=["']([^"']+)["']/i)?.[1] || "";

  const form = new FormData();
  if (sid) form.append("sid", sid);
  form.append("file_0_", new Blob([buffer], { type: contentType || "application/octet-stream" }), filename);
  for (let i = 1; i <= 9; i++) form.append(`file_${i}_`, "");
  form.append("submitr", "[ رفع الملفات ]");

  const res = await post("https://top4top.io/index.php", form, {
    origin: "https://top4top.io",
    referer: "https://top4top.io/",
  });
  const html = await res.text();
  return (
    html.match(/value=["'](https:\/\/[^"']*\/p_[^"']*)["']/i)?.[1] ||
    html.match(/https:\/\/[^'"<>\s]*\/p_[^'"<>\s]*/)?.[0] ||
    null
  );
}

// Urutan dicoba dari atas ke bawah. Host sementara duluan (privasi: foto user
// tidak menetap online), host permanen belakangan.
const PROVIDERS = [
  ["imgbb", imgbb],
  ["litterbox", litterbox],
  ["uguu", uguu],
  ["tmpfiles", tmpfiles],
  ["catbox", catbox],
  ["top4top", top4top],
];

export async function uploadImageToHost(buffer, filename, contentType) {
  const safeName = (filename || "image.jpg").replace(/[^\w.\-]+/g, "_");
  const errors = [];

  for (const [name, fn] of PROVIDERS) {
    try {
      const url = await fn(buffer, safeName, contentType);
      if (isUrl(url)) return url.trim();
      errors.push(`${name}: balasan tidak berisi URL`);
    } catch (err) {
      errors.push(`${name}: ${err.message}`);
    }
  }

  // Detail per host masuk ke log server (Vercel Logs), bukan ke user.
  console.error("[uploadImage] semua host gagal ->", errors.join(" | "));
  throw new Error("Gagal upload gambar ke image host, coba lagi.");
}

// Alias supaya import lama di route.js tetap jalan tanpa perubahan.
export const uploadToTop4top = uploadImageToHost;
