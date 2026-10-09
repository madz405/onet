// Downloader YouTube versi BROWSER (dijalankan di perangkat pengunjung, bukan
// di server Vercel).
//
// Kenapa di browser: Vidssave menolak permintaan dari IP datacenter (Vercel),
// tapi menerima IP rumahan/seluler milik pengunjung.
//
// PENTING (hasil tes di HP): semua panggilan ke Vidssave dikirim lewat IFRAME
// SANDBOX (lihat sandboxFetch di bawah), bukan fetch biasa dari halaman.
// Alasannya, iframe sandbox tanpa "allow-same-origin" mengirim header
// `Origin: null`, dan hanya cara inilah yang menghasilkan link unduhan yang
// BISA diunduh. Dengan fetch biasa dari koyen.web.id (Origin = domain kita),
// link unduhan yang dihasilkan malah "Forbidden".
//
// Alur: parse -> download (minta task) -> polling SSE -> download_link.
// Link hasilnya (api.vidssave.com/.../download_redirect) dibuka langsung oleh
// browser pengunjung. Jangan dibuka berkali-kali: tiap pembukaan membuat
// tanda tangan baru, jadi cukup SEKALI per unduhan.
//
// HARGAI WOY JANGAN DIHAPUS!
// Skrep Vidssave by *JH a.k.a DHIKA - FIONY BOT* (diadaptasi untuk browser).

const API = "https://api.vidssave.com";
const HOST = "id.vidssave.com";
const DOMAIN = "api-ak.vidssave.com";
const AES_STR = "4c9b7d2e".repeat(3).concat("4c9b7d21");

// Urutan kualitas yang diutamakan. Ubah di sini kalau ada yang bermasalah.
const AUDIO_PREF = [128, 256, 48];
const VIDEO_PREF = [720, 480, 360, 240, 144];

const POLL_ATTEMPTS = 20;
const POLL_INTERVAL_MS = 1500;

const encoder = new TextEncoder();

// ---------------------------------------------------------------------------
// fetch lewat iframe sandbox (Origin: null)
// ---------------------------------------------------------------------------
let frame = null;
let frameReady = null;
let listening = false;
let seq = 0;
const pending = new Map();

function onFrameMessage(e) {
  if (!frame || e.source !== frame.contentWindow) return;
  const m = e.data || {};
  if (m.type !== "fetch-result") return;
  const p = pending.get(m.id);
  if (!p) return;
  pending.delete(m.id);
  if (m.error) p.reject(new Error(m.error));
  else p.resolve({ status: m.status, text: m.text });
}

function ensureFrame() {
  if (frameReady) return frameReady;

  if (!listening) {
    window.addEventListener("message", onFrameMessage);
    listening = true;
  }

  frameReady = new Promise((resolve, reject) => {
    const f = document.createElement("iframe");
    // Tanpa allow-same-origin => origin iframe "opaque" => request membawa Origin: null.
    f.setAttribute("sandbox", "allow-scripts");
    f.setAttribute("referrerpolicy", "no-referrer");
    f.setAttribute("aria-hidden", "true");
    f.tabIndex = -1;
    f.style.cssText = "display:none;width:0;height:0;border:0;position:absolute;";

    // Skrip di dalam iframe: menerima perintah fetch dari halaman induk lalu
    // mengirim hasilnya kembali lewat postMessage.
    const inner =
      "<scr" + "ipt>" +
      "window.addEventListener('message', async function (e) {" +
      "  var m = e.data || {}; if (m.type !== 'fetch') return;" +
      "  var ctl = new AbortController();" +
      "  var timer = setTimeout(function () { ctl.abort(); }, m.timeout || 15000);" +
      "  try {" +
      "    var r = await fetch(m.url, { method: m.method || 'GET', headers: m.headers || {}, body: m.body, referrerPolicy: 'no-referrer', signal: ctl.signal });" +
      "    var text = await r.text();" +
      "    parent.postMessage({ type: 'fetch-result', id: m.id, status: r.status, text: text }, '*');" +
      "  } catch (err) {" +
      "    parent.postMessage({ type: 'fetch-result', id: m.id, error: String((err && err.message) || err) }, '*');" +
      "  } finally { clearTimeout(timer); }" +
      "});" +
      "</scr" + "ipt>";

    const timer = setTimeout(() => {
      frameReady = null;
      f.remove();
      reject(new Error("iframe sandbox tidak siap"));
    }, 8000);

    f.addEventListener(
      "load",
      () => {
        clearTimeout(timer);
        frame = f;
        resolve();
      },
      { once: true }
    );
    f.srcdoc = "<!doctype html><html><body>" + inner + "</body></html>";
    document.body.appendChild(f);
  });

  return frameReady;
}

async function sandboxFetch(url, opts = {}, timeoutMs = 15000) {
  await ensureFrame();
  const id = ++seq;
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      pending.delete(id);
      reject(new Error("permintaan ke Vidssave melewati batas waktu"));
    }, timeoutMs + 3000);
    pending.set(id, {
      resolve: (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      reject: (err) => {
        clearTimeout(timer);
        reject(err);
      },
    });
    frame.contentWindow.postMessage(
      { type: "fetch", id, url, method: opts.method, headers: opts.headers, body: opts.body, timeout: timeoutMs },
      "*"
    );
  });
}

// ---------------------------------------------------------------------------
// Dekripsi & API Vidssave
// ---------------------------------------------------------------------------
function b64ToBytes(b64) {
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
}

// AES-256-CBC dengan zero padding. WebCrypto hanya mengerti PKCS7, jadi satu
// blok "padding valid" ditambahkan di belakang ciphertext (bisa dibuat karena
// kuncinya diketahui), lalu sisa nol di hasil dekripsi dibuang.
async function decryptData(b64) {
  const key = await crypto.subtle.importKey("raw", encoder.encode(AES_STR), { name: "AES-CBC" }, false, [
    "encrypt",
    "decrypt",
  ]);
  const iv = encoder.encode(AES_STR.slice(0, 16));
  const ct = b64ToBytes(b64);
  const last = ct.slice(ct.length - 16);
  const padBlock = new Uint8Array(
    await crypto.subtle.encrypt({ name: "AES-CBC", iv: last }, key, new Uint8Array(0))
  );
  const full = new Uint8Array(ct.length + padBlock.length);
  full.set(ct);
  full.set(padBlock, ct.length);
  const plain = new Uint8Array(await crypto.subtle.decrypt({ name: "AES-CBC", iv }, key, full));
  return JSON.parse(new TextDecoder().decode(plain).replace(/\0+$/, ""));
}

async function post(path, extra) {
  const body = new URLSearchParams({ hostname: HOST, auth: "4c9b7d21", domain: DOMAIN, ...extra });
  const res = await sandboxFetch(`${API}/api/contentsite_api/media/${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  let json;
  try {
    json = JSON.parse(res.text);
  } catch {
    throw new Error(`Respons Vidssave tidak valid (HTTP ${res.status}).`);
  }
  if (json.status !== 1) throw new Error(json.msg || `Vidssave gagal di tahap ${path}.`);
  return decryptData(json.data);
}

function extractVideoId(input) {
  return String(input || "").match(
    /(?:youtube\.com\/(?:shorts\/|embed\/|live\/|v\/|.*[?&]v=)|youtu\.be\/)([a-zA-Z0-9_-]{11})/i
  )?.[1];
}

const qualityNum = (r) => parseInt(r.quality, 10) || 0;

function pickByQuality(list, pref) {
  const rank = (r) => {
    const i = pref.indexOf(qualityNum(r));
    return i === -1 ? pref.length : i;
  };
  const seen = new Set();
  return [...list]
    .sort((a, b) => rank(a) - rank(b))
    .filter((r) => (seen.has(r.quality) ? false : seen.add(r.quality)));
}

async function resolveDownloadLink(resourceContent) {
  const { task_id } = await post("download", { request: resourceContent });
  if (!task_id) return null;

  const sseUrl =
    `${API}/sse/contentsite_api/media/download_query` +
    `?auth=20250901majwlqo&domain=${DOMAIN}&task_id=${encodeURIComponent(task_id)}` +
    `&download_domain=vidssave.com&origin=content_site`;

  for (let i = 0; i < POLL_ATTEMPTS; i++) {
    await new Promise((r) => setTimeout(r, i === 0 ? 800 : POLL_INTERVAL_MS));
    try {
      const res = await sandboxFetch(sseUrl, { headers: { Accept: "text/event-stream" } }, 10000);
      for (const line of res.text.split("\n")) {
        if (!line.startsWith("data:")) continue;
        let payload;
        try {
          payload = JSON.parse(line.slice(5).trim());
        } catch {
          continue;
        }
        if (payload.download_link) return payload.download_link;
      }
    } catch {
      // belum siap / koneksi putus sesaat, coba lagi di putaran berikutnya
    }
  }
  return null;
}

function sizeLabel(bytes) {
  const n = Number(bytes);
  return n ? ` · ${(n / (1024 * 1024)).toFixed(1)} MB` : "";
}

// Mengembalikan objek dengan bentuk yang sama seperti respons /api/download,
// jadi MediaResult & riwayat unduhan bisa memakainya tanpa perubahan besar.
// Item media membawa `direct: true` = link harus dibuka langsung oleh browser
// (bukan lewat /api/fetch-media di server).
export async function fetchYouTubeFromBrowser(url, format) {
  if (typeof window === "undefined" || !window.crypto?.subtle) {
    throw new Error("Browser tidak mendukung WebCrypto.");
  }

  const id = extractVideoId(url);
  const candidates = id ? [`https://www.youtube.com/watch?v=${id}`, `https://youtu.be/${id}`] : [url];

  let info = null;
  let lastErr = null;
  for (const link of candidates) {
    try {
      const data = await post("parse", { origin: "source", link });
      if (data?.resources?.length) {
        info = data;
        break;
      }
    } catch (err) {
      lastErr = err;
    }
  }
  if (!info) throw lastErr || new Error("Vidssave tidak menemukan resource video/audio.");

  const wantAudio = format === "audio";
  const picked = wantAudio
    ? pickByQuality(
        info.resources.filter((r) => r.type === "audio" && r.resource_content),
        AUDIO_PREF
      ).slice(0, 1)
    : pickByQuality(
        info.resources.filter(
          (r) => r.type === "video" && (r.format || "").toUpperCase() === "MP4" && r.resource_content
        ),
        VIDEO_PREF
      ).slice(0, 3);

  if (!picked.length) throw new Error("Tidak ada opsi unduhan untuk link ini.");

  const resolved = await Promise.all(
    picked.map(async (r) => {
      try {
        const link = await resolveDownloadLink(r.resource_content);
        return link ? { r, link } : null;
      } catch {
        return null;
      }
    })
  );

  const media = resolved.filter(Boolean).map(({ r, link }) =>
    wantAudio
      ? {
          type: "audio",
          label: `Download Audio ${(r.format || "MP3").toUpperCase()}${sizeLabel(r.size)}`,
          url: link,
          direct: true,
        }
      : {
          type: "video",
          label: `Download MP4 ${r.quality || ""}${sizeLabel(r.size)}`.trim(),
          url: link,
          direct: true,
        }
  );
  if (!media.length) throw new Error("Link unduhan belum siap, coba lagi.");

  return {
    status: true,
    platform: "youtube",
    title: info.title || null,
    author: null,
    thumbnail: info.thumbnail || (id ? `https://i.ytimg.com/vi/${id}/hqdefault.jpg` : null),
    media,
  };
}
