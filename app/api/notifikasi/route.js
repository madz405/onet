import { NextResponse } from "next/server";
import localData from "@/data/notifikasi.json";

// Daftar info/notifikasi untuk ikon lonceng (components/NotificationBell.js).
//
// Sumber data:
//  - Kalau env NOTIFICATIONS_URL diisi (mis. link RAW file notifikasi.json di GitHub
//    / Gist), isinya dibaca dari sana. Edit file itu di GitHub => info berubah
//    tanpa deploy ulang (hasilnya di-cache singkat).
//  - Kalau kosong, memakai data/notifikasi.json yang ikut terbawa di project.
// Repo privat: isi juga NOTIFICATIONS_TOKEN (GitHub token yang boleh membaca repo).
//
// Format file: array, atau { "notifications": [ ... ] }. Tiap item:
//   id (wajib, unik, jangan diubah setelah terbit), type ("info" | "update" | "maintenance"),
//   title, body, date ("2026-10-17"), url + linkLabel (opsional, https),
//   pinned (true = selalu paling atas), expiresAt (opsional, otomatis hilang setelah
//   tanggal itu), active (false = disembunyikan).

export const runtime = "nodejs";

const TYPES = ["info", "update", "maintenance"];
const MAX_ITEMS = 30;

const clip = (v, n) => (typeof v === "string" || typeof v === "number" ? String(v).trim().slice(0, n) : "");

function httpsOrNull(v) {
  try {
    const u = new URL(String(v || "").trim());
    return u.protocol === "https:" ? u.href : null;
  } catch {
    return null;
  }
}

function toIso(v) {
  if (!v) return null;
  const t = new Date(v);
  return Number.isNaN(t.getTime()) ? null : t.toISOString();
}

// Hanya teks polos yang dikirim ke tampilan (tidak ada HTML), semua field dibatasi.
function normalize(raw) {
  const list = Array.isArray(raw) ? raw : Array.isArray(raw?.notifications) ? raw.notifications : [];
  const now = Date.now();
  const seen = new Set();
  const out = [];
  for (const it of list) {
    if (!it || typeof it !== "object" || it.active === false) continue;
    const id = clip(it.id, 80);
    const title = clip(it.title, 100);
    if (!id || !title || seen.has(id)) continue;
    const expires = toIso(it.expiresAt);
    if (expires && new Date(expires).getTime() < now) continue;
    seen.add(id);
    out.push({
      id,
      type: TYPES.includes(it.type) ? it.type : "info",
      title,
      body: clip(it.body, 1500),
      date: toIso(it.date),
      url: httpsOrNull(it.url),
      linkLabel: clip(it.linkLabel, 30) || "Buka",
      pinned: it.pinned === true,
    });
  }
  // Disematkan dulu, lalu yang terbaru. Tanpa tanggal ditaruh paling bawah.
  out.sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    return (b.date ? Date.parse(b.date) : 0) - (a.date ? Date.parse(a.date) : 0);
  });
  return out.slice(0, MAX_ITEMS);
}

const reply = (body, status = 200) =>
  NextResponse.json(body, {
    status,
    headers: { "Cache-Control": status === 200 ? "public, s-maxage=60, stale-while-revalidate=300" : "no-store" },
  });

export async function GET() {
  const src = httpsOrNull(process.env.NOTIFICATIONS_URL);
  if (!src) return reply({ status: true, items: normalize(localData) });

  try {
    const headers = { Accept: "application/json", "User-Agent": "KOYEN-Web/1.0" };
    if (process.env.NOTIFICATIONS_TOKEN) headers.Authorization = `Bearer ${process.env.NOTIFICATIONS_TOKEN}`;
    const res = await fetch(src, { headers, cache: "no-store", signal: AbortSignal.timeout(8000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const text = await res.text();
    return reply({ status: true, items: normalize(JSON.parse(text.slice(0, 200000))) });
  } catch (err) {
    console.error("[notifikasi] gagal membaca sumber:", err.message);
    return reply({ status: false, message: "Gagal memuat notifikasi." }, 502);
  }
}
