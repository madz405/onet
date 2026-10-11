// Laporan error otomatis ke Telegram (khusus kegagalan di sisi server/sumber).
//
// Environment variable (Vercel > Settings > Environment Variables, TANPA awalan
// NEXT_PUBLIC_ karena ini rahasia dan hanya dipakai di server):
//   TELEGRAM_BOT_TOKEN : token dari @BotFather
//   TELEGRAM_CHAT_ID   : chat ID tujuan laporan (chat pribadi atau grup)
// Kalau salah satunya kosong, fungsi ini diam saja (tidak error).
//
// Pemakaian di route:  await reportError("download: instagram", err, { url });
//
// Catatan:
// - Selalu `await` sebelum mengembalikan respons, karena di serverless proses
//   bisa dihentikan begitu respons terkirim. Waktu tunggu dibatasi pendek.
// - Pengiriman TIDAK PERNAH melempar error, jadi bot yang bermasalah tidak
//   mengganggu pengunjung.
// - Error yang sama (fitur + pesan) hanya dikirim sekali per DEDUPE_MS supaya
//   tidak membanjiri chat. Di serverless ini bersifat sebisanya (per instance).

const DEDUPE_MS = 10 * 60 * 1000;
const SEND_TIMEOUT_MS = 2500;
const MAX_TRACKED = 200;

// Error akibat input pengunjung bukan masalah situs, tidak perlu dilaporkan.
const IGNORE =
  /link .*tidak valid|masukkan link yang valid|alamat email tidak valid|tidak boleh kosong|terlalu panjang|maksimal \d|pilih file|ditemukan di komentar|tidak didukung/i;

const recent = new Map();

function esc(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function clip(value, max) {
  const s = String(value ?? "").replace(/\s+/g, " ").trim();
  return s.length > max ? `${s.slice(0, max)}…` : s;
}

function shouldSkip(key, now) {
  const last = recent.get(key);
  if (last && now - last < DEDUPE_MS) return true;
  recent.set(key, now);
  if (recent.size > MAX_TRACKED) {
    for (const [k, t] of recent) {
      if (now - t >= DEDUPE_MS) recent.delete(k);
    }
    // masih penuh: buang yang paling lama
    while (recent.size > MAX_TRACKED) recent.delete(recent.keys().next().value);
  }
  return false;
}

export async function reportError(feature, err, context = {}) {
  try {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;
    if (!token || !chatId) return;

    const message = clip(err?.message || err || "Error tanpa pesan", 300);
    if (IGNORE.test(message)) return;

    const now = Date.now();
    if (shouldSkip(`${feature}|${message.slice(0, 80)}`, now)) return;

    const when = new Date(now).toLocaleString("id-ID", {
      timeZone: "Asia/Jakarta",
      dateStyle: "medium",
      timeStyle: "medium",
    });

    const lines = [`⚠️ <b>Error di KOYEN</b>`, `<b>Fitur:</b> ${esc(clip(feature, 80))}`, `<b>Pesan:</b> ${esc(message)}`];
    for (const [key, value] of Object.entries(context || {})) {
      if (value == null || value === "") continue;
      lines.push(`<b>${esc(key)}:</b> ${esc(clip(value, 150))}`);
    }
    if (process.env.VERCEL_ENV) lines.push(`<b>Env:</b> ${esc(process.env.VERCEL_ENV)}`);
    lines.push(`<b>Waktu:</b> ${esc(when)} WIB`);

    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: lines.join("\n"),
        parse_mode: "HTML",
        disable_web_page_preview: true,
      }),
      signal: AbortSignal.timeout(SEND_TIMEOUT_MS),
    });
  } catch {
    // Pelaporan tidak boleh pernah mengganggu fitur utama.
  }
}
