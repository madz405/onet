// Upload file APA SAJA (video, musik, dokumen, gambar) ke host publik di sisi
// server. Dipakai untuk file kecil (<= 4 MB) dan untuk masa aktif "permanen".
// File besar dikirim langsung dari browser (lib/clientUpload.js) karena body
// request function Vercel dibatasi ~4,5 MB.
//
// Daftar host diporting dari plugin "tourl" bot WhatsApp. Hanya host yang
// berhasil di tes yang dipakai: Litterbox, Pone, Kappa, Uguu, TmpFiles,
// Upload.ee, Top4top, Leopard, Qu.ax, Termai, Nekohime. Catbox, ImgDrop,
// 8upload, 0x0, Faddlaninco, dan Unggah dibuang karena gagal.
//
// Terpisah dari lib/uploadImage.js (khusus gambar untuk tool edit) supaya tool
// lama tidak ikut berubah.

const UA =
  "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Mobile Safari/537.36";

// Key publik milik layanan Termai (sama seperti yang dipakai bot). Kalau suatu
// saat ditolak, host ini otomatis dilewati.
const TERMAI_KEY = "AIzaBj7z2z3xBjsk";

const isUrl = (s) => typeof s === "string" && /^https?:\/\/\S+$/i.test(s.trim());

function blobOf(buffer, type) {
  return new Blob([buffer], { type: type || "application/octet-stream" });
}

// extraFirst: field yang dikirim SEBELUM file (reqtype, time, dst).
function makeForm(field, buffer, name, type, extraFirst = {}) {
  const f = new FormData();
  for (const [k, v] of Object.entries(extraFirst)) f.append(k, v);
  f.append(field, blobOf(buffer, type), name);
  return f;
}

function post(url, body, signal, headers = {}) {
  return fetch(url, { method: "POST", body, headers: { "User-Agent": UA, ...headers }, signal });
}

function browserHeaders(origin, extra = {}) {
  return { Accept: "*/*", Origin: origin, Referer: `${origin}/`, ...extra };
}

// ---- Host sementara ------------------------------------------------------

// Litterbox: 1h / 12h / 24h / 72h.
async function litterbox(buffer, name, type, { signal, time }) {
  const res = await post(
    "https://litterbox.catbox.moe/resources/internals/api.php",
    makeForm("fileToUpload", buffer, name, type, { reqtype: "fileupload", time }),
    signal
  );
  if (!res.ok) throw new Error(`status ${res.status}`);
  return (await res.text()).trim();
}

// Uguu: 48 jam.
async function uguu(buffer, name, type, { signal }) {
  const res = await post(
    "https://uguu.se/upload.php",
    makeForm("files[]", buffer, name, type),
    signal,
    browserHeaders("https://uguu.se")
  );
  if (!res.ok) throw new Error(`status ${res.status}`);
  const data = await res.json();
  if (!data?.success) throw new Error("balasan tidak valid");
  return data?.files?.[0]?.url;
}

// TmpFiles: 6 jam. Link hasil diubah ke bentuk /dl/ supaya langsung berupa file.
async function tmpfiles(buffer, name, type, { signal }) {
  const res = await post(
    "https://tmpfiles.org/api/v1/upload",
    makeForm("file", buffer, name, type, { expire: "21600" }),
    signal,
    { Accept: "application/json" }
  );
  if (!res.ok) throw new Error(`status ${res.status}`);
  const data = await res.json();
  const url = data?.data?.url;
  if (data?.status !== "success" || !url) throw new Error("balasan tidak valid");
  return url.replace("tmpfiles.org/", "tmpfiles.org/dl/");
}

// ---- Host permanen -------------------------------------------------------

async function pone(buffer, name, type, { signal }) {
  const res = await post(
    "https://pone.rs/upload.php",
    makeForm("files[]", buffer, name, type),
    signal,
    browserHeaders("https://pone.rs")
  );
  if (!res.ok) throw new Error(`status ${res.status}`);
  const data = await res.json();
  const url = data?.files?.[0]?.url?.replaceAll("\\/", "/");
  if (!data?.success || !url) throw new Error("balasan tidak valid");
  return url;
}

async function nekohime(buffer, name, type, { signal }) {
  const res = await post("https://cdn.nekohime.site/upload", makeForm("file", buffer, name, type), signal);
  if (!res.ok) throw new Error(`status ${res.status}`);
  const data = await res.json();
  return (
    data?.files?.[0]?.url ||
    data?.files?.url ||
    (Array.isArray(data?.files) ? data.files[0] : data?.files)
  );
}

// Urutan field meniru yang terbukti jalan di bot, termasuk field file_N_
// kosong di akhir. Jangan dirapikan tanpa mengetesnya lagi.
async function top4top(buffer, name, type, { signal }) {
  const init = await fetch("https://top4top.io/", { headers: { "User-Agent": UA }, signal });
  const sid = (await init.text()).match(/name=["']sid["'][^>]*value=["']([^"']+)["']/i)?.[1] || "";

  const form = new FormData();
  if (sid) form.append("sid", sid);
  form.append("file_0_", blobOf(buffer, type), name);
  for (let i = 1; i <= 9; i++) form.append(`file_${i}_`, "");
  form.append("submitr", "[ رفع الملفات ]");
  for (let i = 0; i <= 9; i++) form.append(`file_${i}_`, "");

  const res = await post("https://top4top.io/index.php", form, signal, {
    Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    Origin: "https://top4top.io",
    Referer: "https://top4top.io/",
  });
  const html = await res.text();
  return (
    html.match(/value=["'](https:\/\/[^'"]*\/p_[^'"]*)['"]/i)?.[1] ||
    html.match(/https:\/\/[^'"<>\s]*\/p_[^'"<>\s]*/)?.[0] ||
    null
  );
}

// Upload.ee: alur beberapa langkah (ambil ID upload, kirim file, baca halaman hasil).
async function uploadee(buffer, name, type, { signal }) {
  const ext = (name.match(/\.([^.]+)$/) || [])[1] || "bin";
  const isImage = ["jpg", "jpeg", "png", "webp", "gif", "bmp", "svg", "avif"].includes(ext.toLowerCase());
  const H = { "User-Agent": UA };

  await fetch("https://www.upload.ee/?", { headers: H, signal });
  const idRes = await fetch(`https://www.upload.ee/ubr_link_upload.php?rnd_id=${Date.now()}`, {
    headers: { ...H, Referer: "https://www.upload.ee/?" },
    signal,
  });
  const uploadId = (await idRes.text()).match(/startUpload\("([^"]+)"/)?.[1];
  if (!uploadId) throw new Error("upload ID tidak ditemukan");

  const form = new FormData();
  form.append("upfile_0", blobOf(buffer, type), name);
  form.append("link", "");
  form.append("email", "");
  form.append("category", isImage ? "cat_picture" : "cat_file");
  form.append("big_resize", "none");
  form.append("small_resize", "120x90");

  const uploadUrl = `https://www.upload.ee/cgi-bin/ubr_upload.pl?X-Progress-ID=${uploadId}&upload_id=${uploadId}`;
  await post(uploadUrl, form, signal, { Origin: "https://www.upload.ee", Referer: "https://www.upload.ee/?" });

  const done = await fetch(`https://www.upload.ee/?page=finished&upload_id=${uploadId}`, {
    headers: { ...H, Referer: uploadUrl },
    signal,
  });
  const html = await done.text();
  const raw =
    html.match(/id=["']file_src["'][^>]*value=["']([^"']+)["']/i)?.[1] ||
    html.match(/View file:\s*<br\s*\/?>\s*<a href=["']?([^"'>\s]+)["']?/i)?.[1];
  if (!raw) throw new Error("link tidak ditemukan");

  let url = raw.replaceAll("&amp;", "&").replaceAll("&quot;", '"');
  if (isImage) url = url.replace("/files/", "/image/").replace(/\.html$/, "");
  return url;
}

async function kappa(buffer, name, type, { signal }) {
  const res = await post(
    "https://kappa.lol/api/upload",
    makeForm("file", buffer, name, type),
    signal,
    browserHeaders("https://kappa.lol")
  );
  if (!res.ok) throw new Error(`status ${res.status}`);
  return (await res.json())?.link;
}

async function quax(buffer, name, type, { signal }) {
  const res = await post("https://qu.ax/upload.php", makeForm("file", buffer, name, type), signal);
  if (!res.ok) throw new Error(`status ${res.status}`);
  const data = await res.json();
  if (!data?.success) throw new Error("balasan tidak valid");
  return data?.files?.[0]?.url;
}

async function leopard(buffer, name, type, { signal }) {
  const page = "https://leopard.hosting.pecon.us/upload.php";
  await fetch(page, { headers: { "User-Agent": UA }, signal });

  const form = new FormData();
  form.append("uploadContent", blobOf(buffer, type), name);
  form.append("password", "");
  form.append("showname", "yes");

  const res = await post(page, form, signal, { Origin: "https://leopard.hosting.pecon.us", Referer: page });
  const html = await res.text();
  return html.match(/Download link:\s*<a href=([^>\s]+)>/i)?.[1] || null;
}

// Termai: masa aktif tidak diketahui, jadi dipakai paling terakhir.
async function termai(buffer, name, type, { signal }) {
  const ext = (name.match(/\.([^.]+)$/) || [])[1] || "bin";
  const res = await post(
    `https://c.termai.cc/api/upload?key=${TERMAI_KEY}`,
    makeForm("file", buffer, `file.${ext}`, type),
    signal
  );
  if (!res.ok) throw new Error(`status ${res.status}`);
  const data = await res.json();
  if (!data?.status || !data?.path) throw new Error("balasan tidak valid");
  return data.path;
}

// ---- Urutan & aturan -----------------------------------------------------

// hours: masa aktif host (null = ikut pilihan pengguna, Infinity = permanen).
const HOSTS = {
  litterbox: { name: "Litterbox", hours: null, fn: litterbox },
  uguu: { name: "Uguu", hours: 48, label: "48 jam", fn: uguu },
  tmpfiles: { name: "TmpFiles", hours: 6, label: "6 jam", fn: tmpfiles },
  pone: { name: "Pone", hours: Infinity, label: "Permanen", fn: pone },
  nekohime: { name: "Nekohime", hours: Infinity, label: "Permanen", fn: nekohime },
  top4top: { name: "Top4top", hours: Infinity, label: "Permanen", fn: top4top },
  uploadee: { name: "Upload.ee", hours: Infinity, label: "Permanen", fn: uploadee },
  kappa: { name: "Kappa", hours: Infinity, label: "Permanen", fn: kappa },
  quax: { name: "Qu.ax", hours: Infinity, label: "Permanen", fn: quax },
  leopard: { name: "Leopard", hours: Infinity, label: "Permanen", fn: leopard },
  termai: { name: "Termai", hours: undefined, label: "Tidak diketahui", fn: termai },
};

// Host yang link-nya langsung berupa file ditaruh di depan.
const TEMP_CHAIN = ["litterbox", "uguu", "tmpfiles"];
const PERMANENT_CHAIN = ["pone", "nekohime", "top4top", "uploadee", "kappa", "quax", "leopard", "termai"];

const REQUESTED_HOURS = { "1h": 1, "12h": 12, "24h": 24, "72h": 72 };
const REQUESTED_LABEL = { "1h": "1 jam", "12h": "12 jam", "24h": "24 jam", "72h": "3 hari" };

const HOST_TIMEOUT_MS = 20000;
const TOTAL_BUDGET_MS = 50000; // route /api/upload punya maxDuration 60 detik

// Hasil: { url, host, expires, notice? }.
export async function uploadAnyFile(buffer, filename, contentType, expiry) {
  const name = (filename || "file").replace(/[^\w.\-]+/g, "_");
  const deadline = Date.now() + TOTAL_BUDGET_MS;
  const errors = [];

  async function attempt(id, time) {
    const host = HOSTS[id];
    const left = deadline - Date.now();
    if (left < 3000) {
      errors.push(`${host.name}: waktu habis`);
      return null;
    }
    try {
      const signal = AbortSignal.timeout(Math.min(HOST_TIMEOUT_MS, left));
      const url = await host.fn(buffer, name, contentType, { signal, time });
      if (isUrl(url)) return { url: url.trim(), id };
      errors.push(`${host.name}: balasan tidak berisi URL`);
    } catch (err) {
      errors.push(`${host.name}: ${err.message}`);
    }
    return null;
  }

  function finish(found, time) {
    const host = HOSTS[found.id];
    const out = { url: found.url, host: host.name };
    if (host.hours === null) {
      out.expires = REQUESTED_LABEL[time];
      if (expiry === "permanent") {
        out.notice = `Penyimpanan permanen sedang gagal, file disimpan sementara (${out.expires}) di ${host.name}.`;
      }
      return out;
    }
    out.expires = host.label;
    if (expiry === "permanent") {
      if (host.hours !== Infinity) out.notice = `Penyimpanan permanen sedang gagal, file disimpan sementara (${host.label}) di ${host.name}.`;
    } else if (host.hours === undefined) {
      out.notice = "Host utama sedang gagal. Masa aktif link di host cadangan tidak diketahui.";
    } else if (host.hours < REQUESTED_HOURS[expiry]) {
      out.notice = `Host utama sedang gagal. Link di ${host.name} hanya aktif ${host.label}, lebih singkat dari pilihanmu.`;
    }
    return out;
  }

  let found = null;
  let time = null;

  if (expiry === "permanent") {
    for (const id of PERMANENT_CHAIN) {
      if ((found = await attempt(id))) break;
    }
    if (!found) {
      time = "72h";
      found = await attempt("litterbox", time);
    }
  } else {
    time = expiry;
    for (const id of TEMP_CHAIN) {
      if ((found = await attempt(id, time))) break;
    }
  }

  if (found) return finish(found, time);

  // Detail per host masuk ke log server (Vercel Logs), bukan ke pengguna.
  console.error("[uploadFile] semua host gagal ->", errors.join(" | "));
  throw new Error("Gagal upload ke host file, coba lagi sebentar lagi.");
}
