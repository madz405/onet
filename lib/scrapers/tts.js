// Scraper Text to Speech (starlabs.biz.id/startts) — disesuaikan dari skrip bot WhatsApp.
// Perubahan utama: axios diganti fetch bawaan Node, timeout pakai AbortController,
// dan respons dinormalisasi (raw MP3 / base64 / JSON) jadi Buffer MP3 siap kirim.

const ENDPOINT = "https://starlabs.biz.id/startts/proxy.php";
const TIMEOUT_MS = 60000;

const HEADERS = {
  Accept: "*/*",
  "Content-Type": "application/x-www-form-urlencoded",
  Origin: "https://starlabs.biz.id",
  Referer: "https://starlabs.biz.id/startts/id",
  "User-Agent": "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36",
};

// Deteksi format audio dari magic bytes. Kembalikan content-type atau null.
function sniffAudio(buf) {
  if (!buf || buf.length < 4) return null;
  if (buf.toString("latin1", 0, 3) === "ID3") return "audio/mpeg";
  if (buf[0] === 0xff && (buf[1] & 0xe0) === 0xe0) return "audio/mpeg"; // frame sync MP3/AAC
  if (buf.toString("latin1", 0, 4) === "RIFF") return "audio/wav";
  if (buf.toString("latin1", 0, 4) === "OggS") return "audio/ogg";
  if (buf.length > 8 && buf.toString("latin1", 4, 8) === "ftyp") return "audio/mp4";
  return null;
}

// Coba decode string base64 (boleh berawalan data URI). Null kalau bukan audio.
function decodeBase64Audio(str) {
  const clean = String(str || "")
    .replace(/^data:[^;]+;base64,/i, "")
    .replace(/\s+/g, "");
  if (clean.length < 100 || !/^[A-Za-z0-9+/_-]+={0,2}$/.test(clean)) return null;
  const buf = Buffer.from(clean.replace(/-/g, "+").replace(/_/g, "/"), "base64");
  const type = sniffAudio(buf);
  return type ? { buffer: buf, contentType: type } : null;
}

// Cari string audio/URL di dalam JSON respons (struktur sumber bisa berubah).
function pickFromJson(data) {
  if (!data || typeof data !== "object") return null;
  const keys = ["audio", "audio_base64", "b64", "base64", "data", "result", "url", "audioUrl", "file"];
  for (const k of keys) {
    const v = data[k];
    if (typeof v === "string" && v) return v;
    if (v && typeof v === "object") {
      const nested = pickFromJson(v);
      if (nested) return nested;
    }
  }
  return null;
}

async function fetchWithTimeout(url, options) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, { ...options, signal: ctrl.signal, cache: "no-store" });
  } finally {
    clearTimeout(timer);
  }
}

// Hasil: { buffer: Buffer, contentType: string }. Melempar Error berpesan jelas kalau gagal.
export async function generateTts({ text, voiceId }) {
  let res;
  try {
    res = await fetchWithTimeout(ENDPOINT, {
      method: "POST",
      headers: HEADERS,
      body: new URLSearchParams({
        action: "generate",
        text,
        voice: voiceId,
        stream: "1",
        b64: "1",
      }).toString(),
    });
  } catch (err) {
    if (err?.name === "AbortError") throw new Error("Server suara terlalu lama merespons. Coba lagi.");
    throw new Error("Tidak bisa terhubung ke server suara.");
  }

  const raw = Buffer.from(await res.arrayBuffer());

  if (!res.ok) {
    const msg = raw.toString("utf8").replace(/<[^>]+>/g, " ").trim().slice(0, 200);
    throw new Error(msg || `Server suara error (${res.status}).`);
  }

  // 1) Audio mentah.
  const direct = sniffAudio(raw);
  if (direct) return { buffer: raw, contentType: direct };

  // 2) Teks: base64 polos, data URI, atau JSON berisi base64/URL.
  const body = raw.toString("utf8").trim();

  const asB64 = decodeBase64Audio(body);
  if (asB64) return asB64;

  if (body.startsWith("{") || body.startsWith("[")) {
    let json = null;
    try {
      json = JSON.parse(body);
    } catch {
      // bukan JSON valid, lanjut ke error di bawah
    }
    if (json) {
      if (json.success === false || json.status === false || json.error) {
        throw new Error(String(json.message || json.error || "Gagal membuat suara.").slice(0, 200));
      }
      const picked = pickFromJson(json);
      if (picked) {
        const fromB64 = decodeBase64Audio(picked);
        if (fromB64) return fromB64;
        if (/^https?:\/\//i.test(picked)) {
          const audioRes = await fetchWithTimeout(picked, { headers: { "User-Agent": HEADERS["User-Agent"] } });
          if (audioRes.ok) {
            const buf = Buffer.from(await audioRes.arrayBuffer());
            const type = sniffAudio(buf);
            if (type) return { buffer: buf, contentType: type };
          }
        }
      }
    }
  }

  throw new Error(body.replace(/<[^>]+>/g, " ").trim().slice(0, 200) || "Respons dari server suara tidak dikenali.");
}
