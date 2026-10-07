// Upload file APA SAJA (video, musik, dokumen, gambar) ke host publik di sisi
// server. Dipakai sebagai jalur cadangan untuk file kecil (<= 4 MB) dan untuk
// masa aktif "permanen". File besar dikirim langsung dari browser (lihat
// lib/clientUpload.js) karena body request function Vercel dibatasi ~4,5 MB.
//
// Terpisah dari lib/uploadImage.js (khusus gambar untuk tool edit) supaya tool
// lama tidak ikut berubah.

const UA =
  "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Mobile Safari/537.36";

const isUrl = (s) => typeof s === "string" && /^https?:\/\/\S+$/i.test(s.trim());

function form(fieldName, buffer, filename, contentType, extra = {}) {
  const f = new FormData();
  for (const [k, v] of Object.entries(extra)) f.append(k, v);
  f.append(fieldName, new Blob([buffer], { type: contentType || "application/octet-stream" }), filename);
  return f;
}

async function post(url, body, timeoutMs) {
  return fetch(url, {
    method: "POST",
    body,
    headers: { "User-Agent": UA },
    signal: AbortSignal.timeout(timeoutMs),
  });
}

// Litterbox: file sementara 1h / 12h / 24h / 72h.
async function litterbox(buffer, name, type, time) {
  const res = await post(
    "https://litterbox.catbox.moe/resources/internals/api.php",
    form("fileToUpload", buffer, name, type, { reqtype: "fileupload", time }),
    20000
  );
  return (await res.text()).trim();
}

// Catbox: permanen.
async function catbox(buffer, name, type) {
  const res = await post(
    "https://catbox.moe/user/api.php",
    form("fileToUpload", buffer, name, type, { reqtype: "fileupload" }),
    20000
  );
  return (await res.text()).trim();
}

async function uguu(buffer, name, type) {
  const res = await post("https://uguu.se/upload", form("files[]", buffer, name, type), 15000);
  const text = (await res.text()).trim();
  if (isUrl(text)) return text;
  try {
    return JSON.parse(text)?.files?.[0]?.url;
  } catch {
    return null;
  }
}

async function tmpfiles(buffer, name, type) {
  const res = await post("https://tmpfiles.org/api/v1/upload", form("file", buffer, name, type), 15000);
  const url = (await res.json())?.data?.url;
  return url ? url.replace("tmpfiles.org/", "tmpfiles.org/dl/") : null;
}

// Hasil: { url, host, notice? }. "notice" diisi kalau file akhirnya disimpan
// dengan masa aktif yang berbeda dari pilihan pengguna.
export async function uploadAnyFile(buffer, filename, contentType, expiry) {
  const name = (filename || "file").replace(/[^\w.\-]+/g, "_");
  const errors = [];

  async function attempt(host, fn) {
    try {
      const url = await fn();
      if (isUrl(url)) return { url: url.trim(), host };
      errors.push(`${host}: balasan tidak berisi URL`);
    } catch (err) {
      errors.push(`${host}: ${err.message}`);
    }
    return null;
  }

  let result = null;

  if (expiry === "permanent") {
    result = await attempt("catbox", () => catbox(buffer, name, contentType));
    if (!result) {
      result = await attempt("litterbox", () => litterbox(buffer, name, contentType, "72h"));
      if (result) result.notice = "Penyimpanan permanen sedang gagal, file disimpan sementara selama 3 hari.";
    }
  } else {
    result = await attempt("litterbox", () => litterbox(buffer, name, contentType, expiry));
    if (!result) {
      result =
        (await attempt("uguu", () => uguu(buffer, name, contentType))) ||
        (await attempt("tmpfiles", () => tmpfiles(buffer, name, contentType)));
      if (result) result.notice = "Host utama sedang gagal, masa aktif link bisa lebih singkat dari pilihanmu.";
    }
  }

  if (result) return result;

  console.error("[uploadFile] semua host gagal ->", errors.join(" | "));
  throw new Error("Gagal upload ke host file, coba lagi sebentar lagi.");
}
