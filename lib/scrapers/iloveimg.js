/***
  @ Base: https://www.iloveimg.com/
  @ Note: Dipakai sebagai CADANGAN tool "Hapus Background" kalau endpoint
    utama (azbry) mati/gagal. Scraper asli: iloveimg remove bg (CJS + axios,
    sumber: channel WhatsApp rinaa imup).

    Diadaptasi supaya jalan di web ini:
    - CommonJS + axios -> ESM + fetch bawaan Node 18+ (tidak perlu dependency
      baru di package.json, konsisten dengan scraper lain).
    - Kode asli hanya mengembalikan link download. Link itu butuh header
      Authorization (token) sehingga TIDAK bisa dibuka langsung oleh browser
      user. Jadi di sini file hasilnya diunduh di server, lalu dikembalikan
      sebagai bytes gambar { buffer, contentType } supaya bisa langsung
      diteruskan ke user.
    - Bisa menerima file langsung (multipart), jadi tetap jalan walau semua
      image host sedang gagal. Kalau URL gambar yang sudah di-host tersedia,
      dicoba dulu lewat jalur asli (cloud_file) karena itu yang sudah terbukti.
    - Semua request pakai timeout, dan host server dari iLoveIMG divalidasi
      supaya hanya *.iloveimg.com yang dipanggil.

    Alur: ambil token dari halaman -> start task -> upload -> process ->
    download hasil.
***/

import { inflateRawSync } from "node:zlib";

const BASE_URL = "https://www.iloveimg.com";
const PAGE_URL = `${BASE_URL}/id/hapus-latar-belakang`;
const API_START = "https://api.iloveimg.com/v1/start";
const TOOL = "removebackgroundimage";
const STEP_TIMEOUT_MS = 25000;

const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
  Accept: "application/json, text/plain, */*",
  "Accept-Language": "id-ID,id;q=0.9,en-US;q=0.8",
  Origin: BASE_URL,
  Referer: PAGE_URL,
  "Sec-Ch-Ua": '"Chromium";v="122", "Not(A:Brand";v="24", "Google Chrome";v="122"',
  "Sec-Ch-Ua-Mobile": "?0",
  "Sec-Ch-Ua-Platform": '"Windows"',
};

const EXT_BY_TYPE = { "image/png": ".png", "image/jpeg": ".jpg", "image/webp": ".webp" };

async function readError(res) {
  const text = await res.text().catch(() => "");
  try {
    const data = JSON.parse(text);
    const msg = data?.message ?? data?.error ?? data;
    return typeof msg === "string" ? msg : JSON.stringify(msg);
  } catch {
    return text.slice(0, 200) || `status ${res.status}`;
  }
}

// fetch + timeout + lempar error yang jelas kalau status bukan 2xx
// (perilaku yang tadinya otomatis dari axios).
async function request(url, init, label) {
  let res;
  try {
    res = await fetch(url, { ...init, signal: AbortSignal.timeout(STEP_TIMEOUT_MS) });
  } catch (err) {
    throw new Error(`${label}: ${err?.name === "TimeoutError" ? "timeout" : err?.message || "gagal"}`);
  }
  if (!res.ok) throw new Error(`${label}: ${await readError(res)} (status ${res.status})`);
  return res;
}

function safeFilename(filename, contentType) {
  const base = (filename || "image").replace(/[^\w.\-]+/g, "_");
  if (/\.(png|jpe?g|webp|gif|bmp)$/i.test(base)) return base;
  return base + (EXT_BY_TYPE[contentType] || ".jpg");
}

async function getToken() {
  const res = await request(PAGE_URL, { headers: HEADERS }, "Ambil halaman iLoveIMG");
  const html = await res.text();
  const token =
    html.match(/"token"\s*:\s*"([^"]+)"/)?.[1] ||
    html.match(/\btoken\s*[:=]\s*["'](eyJ[\w.-]+)["']/)?.[1];
  if (!token) throw new Error("Gagal mengekstrak token dari halaman iLoveIMG");
  return token;
}

async function uploadJson(server, auth, body) {
  const res = await request(
    `https://${server}/v1/upload`,
    { method: "POST", headers: { ...auth, "Content-Type": "application/json" }, body: JSON.stringify(body) },
    "Upload (URL)"
  );
  return (await res.json())?.server_filename;
}

async function uploadFile(server, auth, task, buffer, filename, contentType) {
  const form = new FormData();
  form.set("task", task);
  form.set("file", new Blob([buffer], { type: contentType || "image/jpeg" }), filename);
  // Content-Type sengaja tidak di-set manual: fetch akan mengisinya
  // lengkap dengan boundary multipart.
  const res = await request(`https://${server}/v1/upload`, { method: "POST", headers: auth, body: form }, "Upload (file)");
  return (await res.json())?.server_filename;
}

function sniffType(buf) {
  if (buf.length < 12) return null;
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return "image/png";
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
  if (buf.toString("ascii", 0, 4) === "RIFF" && buf.toString("ascii", 8, 12) === "WEBP") return "image/webp";
  if (buf[0] === 0x50 && buf[1] === 0x4b) return "zip";
  return null;
}

// Jaga-jaga: kalau iLoveIMG membungkus hasil dalam ZIP, ambil file pertama di
// dalamnya (dibaca lewat central directory, cukup untuk 1 file).
function firstZipEntry(buf) {
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 65557); i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error("ZIP dari iLoveIMG tidak valid");
  const cd = buf.readUInt32LE(eocd + 16);
  if (buf.readUInt32LE(cd) !== 0x02014b50) throw new Error("ZIP dari iLoveIMG tidak valid");
  const method = buf.readUInt16LE(cd + 10);
  const compSize = buf.readUInt32LE(cd + 20);
  const local = buf.readUInt32LE(cd + 42);
  if (buf.readUInt32LE(local) !== 0x04034b50) throw new Error("ZIP dari iLoveIMG tidak valid");
  const start = local + 30 + buf.readUInt16LE(local + 26) + buf.readUInt16LE(local + 28);
  const data = buf.subarray(start, start + compSize);
  if (method === 0) return Buffer.from(data);
  if (method === 8) return inflateRawSync(data);
  throw new Error("Format kompresi ZIP dari iLoveIMG tidak didukung");
}

/**
 * Hapus background lewat iLoveIMG.
 * @param {Buffer} buffer       isi file gambar
 * @param {string} filename     nama file asli
 * @param {string} contentType  mime type file asli
 * @param {{ imageUrl?: string }} [opts]  URL publik gambar (kalau sudah di-host)
 * @returns {Promise<{ buffer: Buffer, contentType: string }>}
 */
export async function removeBgILoveImg(buffer, filename, contentType, opts = {}) {
  if (!buffer?.length) throw new Error("File gambar kosong.");

  const token = await getToken();
  const auth = { ...HEADERS, Authorization: `Bearer ${token}` };

  const startRes = await request(`${API_START}/${TOOL}`, { headers: auth }, "Start task");
  const { task, server } = await startRes.json();
  if (!task || !server) throw new Error("Gagal mendapatkan task dari server iLoveIMG");
  if (!/^[a-z0-9-]+(\.[a-z0-9-]+)*\.iloveimg\.com$/i.test(server)) {
    throw new Error("Server iLoveIMG tidak dikenali");
  }

  const name = safeFilename(filename, contentType);

  // Urutan upload: jalur asli (URL / cloud_file) dulu kalau ada URL, lalu
  // upload file langsung sebagai cadangan.
  const attempts = [];
  if (opts.imageUrl) {
    attempts.push(() => uploadJson(server, auth, { task, cloud_file: opts.imageUrl }));
    attempts.push(() => uploadJson(server, auth, { task, url: opts.imageUrl }));
  }
  attempts.push(() => uploadFile(server, auth, task, buffer, name, contentType));

  let serverFilename = null;
  const errors = [];
  for (const attempt of attempts) {
    try {
      serverFilename = await attempt();
      if (serverFilename) break;
      errors.push("balasan upload tidak berisi server_filename");
    } catch (err) {
      errors.push(err.message);
    }
  }
  if (!serverFilename) throw new Error(`Gagal mengunggah gambar ke iLoveIMG (${errors.join(" | ")})`);

  await request(
    `https://${server}/v1/process`,
    {
      method: "POST",
      headers: { ...auth, "Content-Type": "application/json" },
      body: JSON.stringify({ task, tool: TOOL, files: [{ server_filename: serverFilename, filename: name }] }),
    },
    "Proses"
  );

  // Unduh hasilnya di server (link download butuh header Authorization).
  const dl = await request(`https://${server}/v1/download/${task}`, { headers: auth }, "Unduh hasil");
  let out = Buffer.from(await dl.arrayBuffer());
  let type = sniffType(out);
  if (type === "zip") {
    out = firstZipEntry(out);
    type = sniffType(out);
  }
  if (!type || type === "zip") throw new Error("Hasil dari iLoveIMG bukan gambar yang valid");

  return { buffer: out, contentType: type };
}
