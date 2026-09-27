/***
  @ Base: https://imglarger.com/
  @ Note: Dipakai tool "Perjelas Foto (HD)". Sebelumnya tool ini lewat
    endpoint publik api-faa.my.id (GET, kasih URL gambar yang sudah di-host
    di top4top -> langsung dapat hasil). Endpoint itu sekarang memblokir IP
    Vercel, jadi diganti manggil LANGSUNG API internal yang dipakai situs
    imglarger.com sendiri waktu orang upload foto di sana.

    Beda dari endpoint lama, API ini:
    - Terima file gambar langsung (multipart upload), jadi tidak perlu lagi
      upload dulu ke top4top sebelum diproses.
    - Prosesnya async: upload dulu -> dapat "code" -> baru di-poll (cek
      status) berkala sampai hasilnya selesai. Makanya dari sisi user
      terasa lebih lama (~15-40 detik, bukan langsung sekali request).

    Kode diadaptasi dari versi axios + form-data ke fetch/FormData/Blob
    bawaan Node 18+, biar konsisten dengan scraper lain di project ini dan
    tidak perlu nambah dependency baru di package.json.

    type: 13      -> mode proses yang dipakai (ikut skema resmi imglarger)
    scaleRadio: 2 -> upscale 2x
    Dua angka ini fixed sesuai yang sudah terbukti jalan, jangan diubah
    sembarangan kecuali memang mau ganti mode/skala upscale-nya.
***/

const UA =
  "Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Mobile Safari/537.36";

const COMMON_HEADERS = {
  accept: "application/json, text/plain, */*",
  "accept-language": "id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7",
  origin: "https://imglarger.com",
  priority: "u=1, i",
  referer: "https://imglarger.com/",
  "sec-ch-ua": '"Chromium";v="142", "Google Chrome";v="142", "Not_A Brand";v="99"',
  "sec-ch-ua-mobile": "?1",
  "sec-ch-ua-platform": '"Android"',
  "sec-fetch-dest": "empty",
  "sec-fetch-mode": "cors",
  "sec-fetch-site": "same-site",
  "user-agent": UA,
};

const UPLOAD_URL = "https://photoai.imglarger.com/api/PhoAi/Upload";
const STATUS_URL = "https://photoai.imglarger.com/api/PhoAi/CheckStatus";
const PROCESS_TYPE = 13;
const SCALE_RADIO = 2;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Kirim file ke imglarger, balikin "code" (task id) yang dipakai buat
// polling status di bawah.
async function uploadImage(buffer, filename, contentType) {
  const form = new FormData();
  form.set("file", new Blob([buffer], { type: contentType || "image/jpeg" }), filename || "image.jpg");
  form.set("type", String(PROCESS_TYPE));
  form.set("scaleRadio", String(SCALE_RADIO));

  const res = await fetch(UPLOAD_URL, {
    method: "POST",
    body: form,
    // Tidak perlu set Content-Type manual, fetch yang isi otomatis
    // (multipart/form-data; boundary=...) berbarengan dengan FormData bawaan Node.
    headers: COMMON_HEADERS,
    signal: AbortSignal.timeout(20000),
  });

  const json = await res.json().catch(() => null);
  const code = json?.data?.code;
  if (!res.ok || !code) {
    throw new Error(json?.message || "Gagal upload foto ke server HD, coba lagi.");
  }
  return code;
}

// Cek status satu kali. Balikin object mentah { status, downloadUrls, ... }
// dari imglarger apa adanya.
async function checkStatus(code) {
  const res = await fetch(STATUS_URL, {
    method: "POST",
    headers: { ...COMMON_HEADERS, "content-type": "application/json" },
    body: JSON.stringify({ code, type: PROCESS_TYPE }),
    signal: AbortSignal.timeout(15000),
  });

  const json = await res.json().catch(() => null);
  if (!res.ok || !json) {
    throw new Error(json?.message || "Gagal mengecek status proses HD.");
  }
  return json.data || {};
}

// Upload lalu poll sampai hasilnya siap. Total waktu dibatasi ~50 detik
// (biasanya cuma butuh 15-40 detik) supaya masih di bawah batas waktu
// serverless function di Vercel (lihat `maxDuration` di route.js-nya).
export async function upscaleHd(buffer, filename, contentType) {
  const code = await uploadImage(buffer, filename, contentType);

  const startedAt = Date.now();
  const DEADLINE_MS = 50000;
  const POLL_INTERVAL_MS = 2000;

  while (Date.now() - startedAt < DEADLINE_MS) {
    await sleep(POLL_INTERVAL_MS);
    const status = await checkStatus(code);

    if (status.status === "success") {
      const url = status.downloadUrls?.[0];
      if (!url) throw new Error("Proses HD selesai tapi hasil gambarnya tidak ditemukan.");
      return url;
    }
    if (status.status === "failed") {
      throw new Error("Proses HD gagal diproses server, coba lagi.");
    }
    // Status lain (masih diproses/antre) -> lanjut polling.
  }

  throw new Error("Proses HD kelamaan (timeout), coba lagi sebentar lagi.");
}
