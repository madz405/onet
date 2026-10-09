import { NextResponse } from "next/server";
import { humanCheck } from "@/lib/turnstile";
import {
  TEMPMAIL_DOMAINS,
  NAME_RE,
  randomName,
  randomDomain,
  isValidEmail,
  createMailbox,
  fetchInbox,
} from "@/lib/scrapers/tempMail";

export const runtime = "nodejs";
export const maxDuration = 45;

function fail(message, status = 400) {
  return NextResponse.json({ status: false, message }, { status });
}

export async function POST(req) {
  let body;
  try {
    body = await req.json();
  } catch {
    return fail("Data yang dikirim tidak valid.");
  }

  // ---- Buat email baru (dilindungi Turnstile) ----
  if (body.action === "create") {
    const human = await humanCheck(req, body.turnstileToken);
    if (!human.ok) return fail(human.message, 403);

    const domain = body.domain ? String(body.domain).toLowerCase() : randomDomain();
    if (!TEMPMAIL_DOMAINS.includes(domain)) return fail("Domain tidak tersedia.");

    let name;
    if (body.name) {
      name = String(body.name).trim().toLowerCase();
      if (!NAME_RE.test(name)) {
        return fail("Nama email 3-30 karakter, hanya huruf kecil, angka, titik, strip, atau underscore.");
      }
    } else {
      name = randomName();
    }

    const email = `${name}@${domain}`;
    try {
      await createMailbox(email);
      return NextResponse.json({ status: true, email });
    } catch (err) {
      console.error("[tempmail] create gagal:", err.message);
      return fail("Gagal membuat email. Coba nama atau domain lain, atau ulangi sebentar lagi.", 502);
    }
  }

  // ---- Cek kotak masuk (dipanggil berkala, tanpa Turnstile) ----
  if (body.action === "inbox") {
    const email = String(body.email || "").toLowerCase();
    if (!isValidEmail(email)) return fail("Alamat email tidak valid.");
    const known = Array.isArray(body.known) ? body.known.slice(0, 200) : [];
    try {
      const { total, messages } = await fetchInbox(email, known);
      return NextResponse.json({ status: true, total, messages });
    } catch (err) {
      console.error("[tempmail] inbox gagal:", err.message);
      return fail("Gagal memeriksa kotak masuk. Coba lagi sebentar lagi.", 502);
    }
  }

  return fail("Aksi tidak dikenal.");
}
