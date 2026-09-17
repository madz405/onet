// Helper kecil yang dipakai bareng oleh beberapa scraper (pinterest, twitter,
// spotify, applemusic, youtube). Dipisah di sini supaya tidak duplikasi.

export const CHROME_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

// Ambil semua Set-Cookie dari response dan gabungkan jadi satu string
// "a=1; b=2" siap pakai buat header Cookie di request berikutnya.
export function getCookiesFromHeaders(headers) {
  try {
    if (typeof headers.getSetCookie === "function") {
      const all = headers.getSetCookie();
      if (all?.length) return all.map((c) => c.split(";")[0]).join("; ");
    }
  } catch {
    // lanjut ke fallback di bawah
  }
  const single = headers.get("set-cookie");
  return single ? single.split(",")[0].split(";")[0] : "";
}

// Serialize object jadi body application/x-www-form-urlencoded.
export function serializeData(obj) {
  return new URLSearchParams(obj).toString();
}

export function stripHtml(s) {
  return (s || "")
    .replace(/<[^>]+>/g, "")
    .replace(/&#0?39;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .trim();
}

// Ambil isi teks elemen pertama yang class-nya mengandung `cls`, tanpa
// DOMParser (Node tidak punya DOMParser bawaan) — pendekatan regex
// sederhana, cukup buat elemen tanpa nested tag di dalamnya.
export function textByClass(html, cls) {
  const re = new RegExp(`class="[^"]*\\b${cls}\\b[^"]*"[^>]*>([^<]*)<`, "i");
  const m = html.match(re);
  return m ? stripHtml(m[1]) : null;
}

export function attrByClass(html, cls, attr) {
  const re1 = new RegExp(`class="[^"]*\\b${cls}\\b[^"]*"[^>]*${attr}="([^"]+)"`, "i");
  const re2 = new RegExp(`${attr}="([^"]+)"[^>]*class="[^"]*\\b${cls}\\b[^"]*"`, "i");
  return html.match(re1)?.[1] || html.match(re2)?.[1] || null;
}

// Ambil semua pasangan name/value <input> di dalam <form name="...">...</form>
// tertentu, tanpa DOMParser — dipakai untuk alur multi-step (verify token ->
// action -> repost form) di scraper Spotify & Apple Music.
export function extractFormInputs(html, formName) {
  const formRe = new RegExp(`<form[^>]*name="${formName}"[^>]*>([\\s\\S]*?)<\\/form>`, "i");
  const formHtml = html.match(formRe)?.[1];
  if (!formHtml) return null;

  const inputs = {};
  const re1 = /<input[^>]*name="([^"]+)"[^>]*value="([^"]*)"[^>]*>/gi;
  let m;
  while ((m = re1.exec(formHtml)) !== null) inputs[m[1]] = m[2];

  // Jaga-jaga kalau urutan atributnya value dulu baru name.
  const re2 = /<input[^>]*value="([^"]*)"[^>]*name="([^"]+)"[^>]*>/gi;
  while ((m = re2.exec(formHtml)) !== null) {
    if (!(m[2] in inputs)) inputs[m[2]] = m[1];
  }

  return inputs;
}
