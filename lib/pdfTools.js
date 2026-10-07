// Gambar -> PDF dan gabung PDF, sepenuhnya di browser (pustaka pdf-lib).
import {
  canvasToBlob, loadImage, naturalSize, releaseCanvas, renderCanvas, scaledSize,
} from "@/lib/imageTools";

const PAGES = { a4: [595.28, 841.89], letter: [612, 792] }; // satuan poin (1/72 inci)
export const MARGINS = { none: 0, small: 18, medium: 36 };
export const QUALITIES = {
  high: { label: "Tinggi", maxSide: 3000, jpeg: 0.92 },
  medium: { label: "Sedang", maxSide: 2000, jpeg: 0.8 },
  low: { label: "Rendah (file kecil)", maxSide: 1400, jpeg: 0.65 },
};

// Gambar diletakkan di tengah halaman, diperbesar/diperkecil tanpa mengubah rasio.
// pageSize "fit" = halaman mengikuti ukuran gambar (dianggap 150 dpi).
export function layoutPage({ pageSize, orientation, margin, imgW, imgH }) {
  const m = MARGINS[margin] ?? 0;
  let pageW;
  let pageH;
  if (pageSize === "fit") {
    const pt = 72 / 150;
    pageW = imgW * pt + m * 2;
    pageH = imgH * pt + m * 2;
  } else {
    [pageW, pageH] = PAGES[pageSize] || PAGES.a4;
    const landscape = orientation === "landscape" || (orientation === "auto" && imgW > imgH);
    if (landscape) [pageW, pageH] = [pageH, pageW];
  }
  const boxW = pageW - m * 2;
  const boxH = pageH - m * 2;
  const r = Math.min(boxW / imgW, boxH / imgH);
  const width = imgW * r;
  const height = imgH * r;
  return { pageW, pageH, x: (pageW - width) / 2, y: (pageH - height) / 2, width, height };
}

// Hasil: { blob, pages }
export async function imagesToPdf(files, { pageSize, orientation, margin, quality, onProgress }) {
  const { PDFDocument } = await import("pdf-lib");
  const q = QUALITIES[quality] || QUALITIES.medium;
  const pdf = await PDFDocument.create();

  for (let i = 0; i < files.length; i++) {
    onProgress?.(i + 1, files.length);
    const src = await loadImage(files[i]);
    const nat = naturalSize(src);
    const { w, h } = scaledSize(nat.w, nat.h, q.maxSide);
    // Selalu digambar ulang lewat kanvas supaya orientasi EXIF benar dan semua
    // format (WebP, PNG transparan, dst.) bisa masuk sebagai JPEG.
    const canvas = renderCanvas(src, w, h, "#ffffff");
    src.close?.();
    const blob = await canvasToBlob(canvas, "image/jpeg", q.jpeg);
    releaseCanvas(canvas);

    const image = await pdf.embedJpg(new Uint8Array(await blob.arrayBuffer()));
    const L = layoutPage({ pageSize, orientation, margin, imgW: w, imgH: h });
    const page = pdf.addPage([L.pageW, L.pageH]);
    page.drawImage(image, { x: L.x, y: L.y, width: L.width, height: L.height });
  }

  const bytes = await pdf.save();
  return { blob: new Blob([bytes], { type: "application/pdf" }), pages: files.length };
}

// Hasil: { blob, pages }
export async function mergePdfs(files, { onProgress } = {}) {
  const { PDFDocument } = await import("pdf-lib");
  const out = await PDFDocument.create();

  for (let i = 0; i < files.length; i++) {
    onProgress?.(i + 1, files.length);
    let src;
    try {
      src = await PDFDocument.load(new Uint8Array(await files[i].arrayBuffer()));
    } catch {
      throw new Error(`"${files[i].name}" tidak bisa dibaca (rusak atau dikunci password).`);
    }
    const pages = await out.copyPages(src, src.getPageIndices());
    pages.forEach((p) => out.addPage(p));
  }

  const bytes = await out.save();
  return { blob: new Blob([bytes], { type: "application/pdf" }), pages: out.getPageCount() };
}
