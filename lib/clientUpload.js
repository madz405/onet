"use client";

import { EXPIRY_OPTIONS, SERVER_MAX_BYTES } from "@/lib/uploadRules";

const LITTERBOX = "https://litterbox.catbox.moe/resources/internals/api.php";
const isUrl = (s) => typeof s === "string" && /^https?:\/\/\S+$/i.test(s.trim());

// XMLHttpRequest dipakai (bukan fetch) karena hanya XHR yang melaporkan
// progres upload, penting untuk video dan musik yang besar.
function xhrPost(url, body, onProgress, signal) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", url);
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress?.(e.loaded / e.total);
    xhr.onload = () => resolve({ status: xhr.status, text: xhr.responseText });
    xhr.onerror = () => reject(new Error("network"));
    xhr.onabort = () => reject(new Error("abort"));
    signal?.addEventListener("abort", () => xhr.abort());
    xhr.send(body);
  });
}

// Mengembalikan { url, host, expires, notice? }.
// Sementara (1h-72h): kirim langsung dari browser ke litterbox (tanpa batas
// body Vercel, sampai 1 GB). Kalau gagal, jalur cadangan lewat server untuk
// file <= 4 MB. Permanen: selalu lewat server (maks 4 MB).
export async function uploadFileClient(file, { expiry, onProgress, signal, turnstileToken }) {
  if (expiry !== "permanent") {
    try {
      const body = new FormData();
      body.append("reqtype", "fileupload");
      body.append("time", expiry);
      body.append("fileToUpload", file, file.name);
      const r = await xhrPost(LITTERBOX, body, onProgress, signal);
      const text = r.text.trim();
      if (r.status >= 200 && r.status < 300 && isUrl(text)) return {
          url: text,
          host: "Litterbox",
          expires: EXPIRY_OPTIONS.find((o) => o.value === expiry)?.label,
        };
    } catch (err) {
      if (err.message === "abort") throw err;
      // Diblokir CORS / jaringan gagal: lanjut ke jalur server.
    }
  }

  if (file.size > SERVER_MAX_BYTES) {
    throw new Error(
      expiry === "permanent"
        ? "File lebih dari 4 MB tidak bisa disimpan permanen. Pilih masa aktif sementara."
        : "Upload langsung gagal dan file terlalu besar untuk jalur cadangan (maks 4 MB). Coba lagi nanti."
    );
  }

  onProgress?.(0);
  const body = new FormData();
  body.append("file", file);
  body.append("expiry", expiry);
  // Token hanya dibutuhkan jalur server; jalur langsung ke host tidak lewat server kita.
  body.append("turnstileToken", turnstileToken || "");
  const r = await xhrPost("/api/upload", body, onProgress, signal).catch((err) => {
    if (err.message === "abort") throw err;
    throw new Error("Koneksi terputus saat upload. Periksa internetmu lalu coba lagi.");
  });

  let data;
  try {
    data = JSON.parse(r.text);
  } catch {
    throw new Error(r.status === 413 ? "File terlalu besar untuk server (maks 4 MB)." : "Server membalas dengan data yang tidak valid.");
  }
  if (!data.status) throw new Error(data.message || "Gagal upload file.");
  return { url: data.url, host: data.host, expires: data.expires, notice: data.notice };
}
