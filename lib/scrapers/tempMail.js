// Scraper Temp Mail (mail-server.1timetech.com). Hanya untuk MENERIMA email
// (OTP / verifikasi), tidak bisa mengirim. Dipanggil dari app/api/tempmail.
// Pakai fetch bawaan Node, jadi tidak perlu paket tambahan.
import crypto from "crypto";

export const TEMPMAIL_DOMAINS = [
  "gmail10p.com",
  "oletters.com",
  "oemails.com",
  "oegmail.com",
  "suiemail.com",
  "voewo.com",
  "yanemail.com",
];

const BASE_URL = "https://mail-server.1timetech.com/api/email";
const HEADERS = {
  "User-Agent": "okhttp/4.9.2",
  Accept: "application/json, text/plain, */*",
  "Content-Type": "application/json",
  "x-app-key": "f07bed4503msh719c2010df3389fp1d6048jsn411a41a84a3c",
  Connection: "Keep-Alive",
};

// Format nama yang diizinkan (juga dipakai untuk mencegah karakter aneh masuk
// ke URL endpoint).
export const NAME_RE = /^[a-z0-9._-]{3,30}$/;

// ---- Enkode/dekode ala server mereka: JSON -> base64 -> dibalik ----
function enc(obj) {
  return Buffer.from(JSON.stringify(obj), "utf-8").toString("base64").split("").reverse().join("");
}

function dec(str) {
  try {
    const rev = String(str || "").split("").reverse().join("");
    return JSON.parse(Buffer.from(rev, "base64").toString("utf-8"));
  } catch {
    return null;
  }
}

function snake(obj) {
  if (Array.isArray(obj)) return obj.map(snake);
  if (obj !== null && typeof obj === "object") {
    return Object.keys(obj).reduce((acc, key) => {
      acc[key.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`)] = snake(obj[key]);
      return acc;
    }, {});
  }
  return obj;
}

async function call(url, options = {}) {
  const res = await fetch(url, {
    ...options,
    headers: HEADERS,
    signal: AbortSignal.timeout(20000),
  });
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {}
  if (!res.ok) {
    throw new Error(json?.message || `Server temp mail menjawab ${res.status}.`);
  }
  return json;
}

// ---- Nama acak (pola suku kata, seperti scraper aslinya) ----
function randInt(min, max) {
  return min + crypto.randomInt(max - min + 1);
}

export function randomName() {
  const kon = "bdjklmnprst";
  const vok = "aiueo";
  const suku = randInt(2, 5);
  let nama = "";
  for (let i = 0; i < suku; i++) {
    nama += kon[randInt(0, kon.length - 1)] + vok[randInt(0, vok.length - 1)];
  }
  return nama + randInt(100, 999);
}

export function randomDomain() {
  return TEMPMAIL_DOMAINS[randInt(0, TEMPMAIL_DOMAINS.length - 1)];
}

export function isValidEmail(email) {
  if (typeof email !== "string") return false;
  const [name, domain, ...rest] = email.split("@");
  return rest.length === 0 && NAME_RE.test(name || "") && TEMPMAIL_DOMAINS.includes(domain);
}

// Daftarkan alamat baru di server temp mail.
export async function createMailbox(email) {
  const json = await call(BASE_URL, {
    method: "POST",
    body: JSON.stringify({ data: enc({ email }) }),
  });
  const decoded = dec(json?.data);
  return decoded ? snake(decoded) : {};
}

// ---- Normalisasi pesan: nama field dari server belum pasti, jadi dicari
// dari beberapa kemungkinan nama supaya tampilan tetap rapi. ----
function pick(obj, keys) {
  for (const k of keys) {
    const v = obj?.[k];
    if (v !== undefined && v !== null && v !== "") return v;
  }
  return undefined;
}

function personToString(v) {
  if (!v) return "";
  if (typeof v === "string") return v;
  if (Array.isArray(v)) return v.map(personToString).filter(Boolean).join(", ");
  if (typeof v === "object") {
    const name = pick(v, ["name", "display_name"]);
    const addr = pick(v, ["address", "email", "mail"]);
    if (name && addr) return `${name} <${addr}>`;
    return String(name || addr || "");
  }
  return String(v);
}

function stripHtml(html) {
  return String(html || "")
    .replace(/<(style|script|head)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|tr|li|h[1-6])>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n+/g, "\n")
    .trim();
}

function toTimestamp(v) {
  if (v === undefined || v === null || v === "") return null;
  if (typeof v === "number" || /^\d+$/.test(String(v))) {
    const n = Number(v);
    return n < 1e12 ? n * 1000 : n;
  }
  const t = Date.parse(String(v));
  return Number.isNaN(t) ? null : t;
}

const MAX_TEXT = 100_000;
const MAX_HTML = 300_000;

export function normalizeMessage(raw) {
  const m = raw || {};
  const id = String(pick(m, ["id", "message_id", "uid"]) ?? "");
  const subject = String(pick(m, ["subject", "title"]) ?? "").trim();
  const from = personToString(pick(m, ["from", "sender", "from_email", "from_address", "from_name", "mail_from"]));

  let html = String(pick(m, ["html", "body_html", "html_body"]) ?? "");
  let text = String(pick(m, ["text", "body_text", "text_body", "plain", "body_plain", "body", "content", "message"]) ?? "");
  // Kalau field teks ternyata isinya HTML, pakai sebagai HTML.
  if (!html && /<\w+[^>]*>/.test(text)) {
    html = text;
    text = "";
  }
  if (!text && html) text = stripHtml(html);

  return {
    id,
    from,
    subject,
    date: toTimestamp(pick(m, ["date", "created_at", "received_at", "timestamp", "time", "sent_at"])),
    text: text.slice(0, MAX_TEXT),
    html: html.length > MAX_HTML ? "" : html,
  };
}

// Ambil kotak masuk. Detail pesan hanya diambil untuk id yang BELUM dikenal
// klien (known), supaya polling berkala tetap ringan.
export async function fetchInbox(email, known = []) {
  const safe = email.replace(/@/g, "_").replace(/\./g, "_");
  const params = encodeURIComponent(enc({}));
  const listJson = await call(`${BASE_URL}/${safe}/messages?params=${params}`);
  const decoded = dec(listJson?.data);
  const list = Array.isArray(decoded) ? snake(decoded) : [];

  const knownSet = new Set((known || []).map(String));
  const fresh = list.filter((m) => m?.id !== undefined && !knownSet.has(String(m.id))).slice(0, 20);

  const messages = [];
  // Ambil detail 4 pesan sekaligus.
  for (let i = 0; i < fresh.length; i += 4) {
    const batch = fresh.slice(i, i + 4);
    const details = await Promise.all(
      batch.map(async (item) => {
        try {
          const dj = await call(`${BASE_URL}/${safe}/messages/${encodeURIComponent(item.id)}?params=${params}`);
          const d = dec(dj?.data);
          return normalizeMessage({ ...item, ...(d ? snake(d) : {}) });
        } catch {
          // Detail gagal: tetap tampilkan versi ringkas dari daftar.
          return normalizeMessage(item);
        }
      })
    );
    messages.push(...details);
  }
  return { total: list.length, messages: messages.filter((m) => m.id) };
}
