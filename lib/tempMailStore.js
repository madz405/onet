// Penyimpanan Temp Mail di localStorage browser (per perangkat, tanpa login).
// Isi: daftar alamat yang pernah dibuat, alamat yang sedang aktif, dan pesan
// per alamat, sehingga refresh halaman tidak menghilangkan apa pun.

export const TEMPMAIL_KEY = "koyen-tempmail-v1";
export const MAX_ACCOUNTS = 20;
export const MAX_MESSAGES = 50;

const EMPTY = { accounts: [], active: null, boxes: {} };

export function loadTempMail() {
  if (typeof window === "undefined") return EMPTY;
  try {
    const raw = window.localStorage.getItem(TEMPMAIL_KEY);
    const p = raw ? JSON.parse(raw) : null;
    if (!p || !Array.isArray(p.accounts)) return EMPTY;
    return {
      accounts: p.accounts.filter((a) => a && typeof a.email === "string"),
      active: typeof p.active === "string" ? p.active : null,
      boxes: p.boxes && typeof p.boxes === "object" ? p.boxes : {},
    };
  } catch {
    return EMPTY;
  }
}

export function saveTempMail(state) {
  try {
    window.localStorage.setItem(TEMPMAIL_KEY, JSON.stringify(state));
    return true;
  } catch {}
  // Penyimpanan penuh: coba lagi tanpa isi HTML pesan (teksnya tetap ada).
  try {
    const lite = {
      ...state,
      boxes: Object.fromEntries(
        Object.entries(state.boxes).map(([k, list]) => [k, list.map((m) => ({ ...m, html: "" }))])
      ),
    };
    window.localStorage.setItem(TEMPMAIL_KEY, JSON.stringify(lite));
    return true;
  } catch {
    return false;
  }
}

// Cari kode OTP/verifikasi (4-8 digit) dari subjek + isi pesan.
export function findCodes(msg) {
  const hay = `${msg?.subject || ""}\n${msg?.text || ""}`;
  const found = [];
  // Angka berdiri sendiri, atau bentuk "123-456" / "123 456". Tanpa regex
  // lookbehind supaya aman di Safari/iOS lama.
  const re = /(\d{3}[- ]\d{3}|\d{4,8})/g;
  let m;
  while ((m = re.exec(hay)) && found.length < 3) {
    const code = m[1];
    const before = hay[m.index - 1] || "";
    const after = hay[m.index + code.length] || "";
    if (/[\w.]/.test(before) || /\w/.test(after)) continue; // bagian dari kata/angka lain
    const digits = code.replace(/\D/g, "");
    // Lewati tahun (1990-2099) yang sering muncul di footer email.
    if (digits.length === 4 && /^(19|20)\d\d$/.test(digits)) continue;
    if (!found.includes(code)) found.push(code);
  }
  return found;
}
