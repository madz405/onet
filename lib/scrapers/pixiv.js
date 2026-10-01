/***
  @ Base: https://www.pixiv.net/
  @ Note: Ambil gambar (semua halaman) atau animasi ugoira dari karya Pixiv.
    Urutan sumber: API ajax resmi -> data meta-preload di HTML -> oEmbed resmi.
    URL gambar diarahkan lewat proxy i.pixiv.re karena i.pximg.net
    memblokir akses tanpa Referer pixiv.
    Diadaptasi dari axios ke fetch bawaan Node.
  @ Format hasil: { title, author, thumbnail, media: [{ type, label, url, filename? }] }
***/

import { CHROME_UA } from "./scraperUtils.js";

async function getJson(url, headers = {}) {
  const res = await fetch(url, {
    headers: { "User-Agent": CHROME_UA, ...headers },
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) throw new Error(`status ${res.status}`);
  return res.json();
}

const proxify = (u) => (u ? u.replace("i.pximg.net", "i.pixiv.re") : u);

export async function scrapePixiv(url) {
  if (!url || typeof url !== "string") throw new Error("Link Pixiv tidak valid.");
  const idMatch = url.match(/artworks\/(\d+)/) || url.match(/illust_id=(\d+)/);
  if (!idMatch) {
    throw new Error("Link Pixiv tidak valid. Contoh: https://www.pixiv.net/artworks/123456789");
  }
  const illustId = idMatch[1];

  let illustData = null;

  // 1) API ajax resmi.
  try {
    const data = await getJson(`https://www.pixiv.net/ajax/illust/${illustId}?lang=en`, {
      Referer: "https://www.pixiv.net/",
    });
    if (data && !data.error && data.body) illustData = data.body;
  } catch {
    // lanjut ke sumber berikutnya
  }

  // 2) Data meta-preload dari HTML halaman (untuk karya yang dibatasi).
  if (!illustData) {
    try {
      const res = await fetch(`https://www.pixiv.net/en/artworks/${illustId}`, {
        headers: { "User-Agent": CHROME_UA, "Accept-Language": "en-US,en;q=0.9" },
        signal: AbortSignal.timeout(10000),
      });
      const html = await res.text();
      const m =
        html.match(/id="meta-preload-data"\s+content='([^']+)'/i) ||
        html.match(/id="meta-preload-data"\s+content="([^"]+)"/i);
      if (m?.[1]) {
        const preload = JSON.parse(m[1].replace(/&quot;/g, '"').replace(/&amp;/g, "&"));
        if (preload?.illust?.[illustId]) illustData = preload.illust[illustId];
      }
    } catch {
      // lanjut ke sumber berikutnya
    }
  }

  // 3) oEmbed resmi — hanya memberi halaman pertama, tapi tidak diblokir.
  if (!illustData) {
    try {
      const d = await getJson(
        `https://embed.pixiv.net/oembed.php?url=${encodeURIComponent(
          `https://www.pixiv.net/artworks/${illustId}`
        )}`
      );
      if (d?.title) {
        const isUgoira = d.work_type === "ugoira";
        return {
          title: `${d.title}${d.author_name ? ` — ${d.author_name}` : ""}`,
          author: d.author_name || null,
          thumbnail: d.thumbnail_url || `https://pixiv.re/${illustId}.jpg`,
          media: [
            isUgoira
              ? { type: "video", label: "Download animasi (MP4)", url: `https://ugoira.com/api/mp4/${illustId}` }
              : { type: "image", label: "Gambar asli", url: `https://pixiv.re/${illustId}.jpg` },
          ],
        };
      }
    } catch {
      // jatuh ke error di bawah
    }
  }

  if (!illustData) {
    throw new Error("Tidak bisa mengambil data karya Pixiv ini (mungkin dihapus atau privat).");
  }

  const isUgoira =
    String(illustData.illustType) === "2" || illustData.type === "ugoira";

  const rawTitle = illustData.title || illustData.illustTitle || "Pixiv Artwork";
  const authorName = illustData.userName || illustData.userAccount || null;
  const media = [];

  if (isUgoira) {
    media.push({
      type: "video",
      label: "Download animasi (MP4)",
      url: `https://ugoira.com/api/mp4/${illustId}`,
    });
    media.push({
      type: "image",
      label: "Download animasi (GIF)",
      url: `https://pixiv.re/${illustId}.gif`,
      filename: `pixiv-${illustId}.gif`,
    });
  } else {
    const pageCount = Number(illustData.pageCount) || 1;
    const original = illustData.urls?.original;
    if (original) {
      for (let i = 0; i < pageCount; i++) {
        const ext = original.match(/\.(\w{3,4})(?:\?|$)/)?.[1] || "jpg";
        media.push({
          type: "image",
          label: pageCount > 1 ? `Halaman ${i + 1}` : "Gambar asli",
          url: proxify(original.replace("_p0", `_p${i}`)),
          filename: `pixiv-${illustId}-${i + 1}.${ext}`,
        });
      }
    } else {
      media.push({ type: "image", label: "Gambar asli", url: `https://pixiv.re/${illustId}.jpg` });
    }
  }

  const thumbnail = isUgoira
    ? `https://pixiv.re/${illustId}.gif`
    : proxify(illustData.urls?.regular) ||
      proxify(illustData.urls?.original) ||
      `https://pixiv.re/${illustId}.jpg`;

  return {
    title: authorName ? `${rawTitle} — ${authorName}` : rawTitle,
    author: authorName,
    thumbnail,
    media,
  };
}
