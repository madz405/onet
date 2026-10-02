// Validasi token Cloudflare Turnstile di sisi server.
// Secret key dibaca dari environment variable TURNSTILE_SECRET_KEY.
const VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

export async function verifyTurnstile(token, ip) {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) {
    // Belum dikonfigurasi: lewati supaya web tidak mati. Isi TURNSTILE_SECRET_KEY
    // di Vercel agar proteksi aktif.
    console.warn("TURNSTILE_SECRET_KEY belum diset, verifikasi dilewati.");
    return { ok: true, skipped: true };
  }
  if (!token || typeof token !== "string") {
    return { ok: false, message: "Verifikasi keamanan belum selesai. Coba lagi." };
  }
  try {
    const form = new URLSearchParams();
    form.set("secret", secret);
    form.set("response", token);
    if (ip) form.set("remoteip", ip);
    const res = await fetch(VERIFY_URL, {
      method: "POST",
      body: form,
      signal: AbortSignal.timeout(8000),
    });
    const data = await res.json();
    if (data?.success) return { ok: true };
    return { ok: false, message: "Verifikasi keamanan gagal. Muat ulang halaman lalu coba lagi." };
  } catch {
    return { ok: false, message: "Tidak bisa memeriksa verifikasi keamanan. Coba lagi sebentar." };
  }
}
