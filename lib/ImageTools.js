// Pengolah gambar di browser (canvas). Dipakai tool Kompres Gambar dan PDF Tools.
// File pengguna tidak pernah dikirim ke server.

// Batas luas kanvas. iOS Safari menolak kanvas di atas ~16,7 juta piksel
// (hasilnya kosong tanpa error), jadi foto raksasa diperkecil dulu.
const MAX_PIXELS = 16_000_000;

export function formatBytes(n) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / 1024 / 1024).toFixed(1).replace(".", ",")} MB`;
}

// maxSide = sisi terpanjang yang diizinkan (0/null = ukuran asli).
export function scaledSize(w, h, maxSide) {
  let r = 1;
  if (maxSide && Math.max(w, h) > maxSide) r = maxSide / Math.max(w, h);
  if (w * r * (h * r) > MAX_PIXELS) r = Math.sqrt(MAX_PIXELS / (w * h));
  return { w: Math.max(1, Math.round(w * r)), h: Math.max(1, Math.round(h * r)) };
}

export function extForMime(mime) {
  return { "image/jpeg": "jpg", "image/webp": "webp", "image/png": "png" }[mime] || "jpg";
}

export function naturalSize(src) {
  return { w: src.naturalWidth || src.width, h: src.naturalHeight || src.height };
}

// createImageBitmap menghormati orientasi EXIF, jadi foto HP tidak berputar sendiri.
export async function loadImage(file) {
  if (typeof createImageBitmap === "function") {
    try {
      return await createImageBitmap(file, { imageOrientation: "from-image" });
    } catch {
      /* format tidak didukung createImageBitmap: coba lewat <img> */
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    return img;
  } catch {
    throw new Error(`"${file.name}" bukan gambar yang bisa dibuka browser.`);
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function renderCanvas(src, w, h, background) {
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (background) {
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, w, h);
  }
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(src, 0, 0, w, h);
  return canvas;
}

export function releaseCanvas(canvas) {
  canvas.width = 0; // bebaskan memori (penting di HP)
  canvas.height = 0;
}

export function canvasToBlob(canvas, type, quality) {
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Gagal membuat gambar."))), type, quality)
  );
}

// Cari kualitas tertinggi yang masih di bawah target. PNG tidak punya
// "kualitas", jadi hanya dicoba apa adanya.
async function encodeWithin(canvas, mime, target) {
  if (mime === "image/png") {
    const b = await canvasToBlob(canvas, mime);
    return { blob: b, ok: b.size <= target };
  }
  const top = await canvasToBlob(canvas, mime, 0.95);
  if (top.size <= target) return { blob: top, ok: true };

  let lo = 0.3;
  let hi = 0.95;
  let best = null;
  for (let i = 0; i < 7; i++) {
    const mid = (lo + hi) / 2;
    const b = await canvasToBlob(canvas, mime, mid);
    if (b.size <= target) {
      best = b;
      lo = mid;
    } else {
      hi = mid;
    }
  }
  if (best) return { blob: best, ok: true };
  const floor = await canvasToBlob(canvas, mime, 0.3);
  return { blob: floor, ok: floor.size <= target };
}

// Hasil: { blob, w, h, ok } — ok = null kalau tidak ada target ukuran.
// Kalau targetKB diisi dan kualitas terendah belum cukup, gambar diperkecil
// bertahap (maksimal 6 kali) sampai muat.
export async function compressImage(file, { mime, quality, maxSide, targetKB }) {
  const src = await loadImage(file);
  const nat = naturalSize(src);
  const base = scaledSize(nat.w, nat.h, maxSide);
  const background = mime === "image/jpeg" ? "#ffffff" : null; // JPG tidak punya transparansi

  try {
    if (!targetKB) {
      const canvas = renderCanvas(src, base.w, base.h, background);
      const blob = await canvasToBlob(canvas, mime, quality);
      releaseCanvas(canvas);
      return { blob, w: base.w, h: base.h, ok: null };
    }

    const target = targetKB * 1024;
    let scale = 1;
    let last = null;
    for (let i = 0; i < 6; i++) {
      const w = Math.max(1, Math.round(base.w * scale));
      const h = Math.max(1, Math.round(base.h * scale));
      const canvas = renderCanvas(src, w, h, background);
      const r = await encodeWithin(canvas, mime, target);
      releaseCanvas(canvas);
      last = { ...r, w, h };
      if (r.ok) break;
      scale *= 0.8;
    }
    return last;
  } finally {
    src.close?.();
  }
}
