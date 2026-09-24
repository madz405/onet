/***
  @ Base: https://www.tikwm.com/
  @ Note: TikTok video/slide downloader lewat API tikwm (tanpa key).
  @ Diadaptasi dari axios ke fetch bawaan Node supaya konsisten dengan
    scraper lain di project ini (tidak perlu tambah dependency axios).
***/

const BASE = "https://www.tikwm.com";
const UA =
  "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Mobile Safari/537.36";

function formatNumber(integer) {
  const numb = parseInt(integer, 10);
  return Number.isNaN(numb) ? "0" : numb.toLocaleString("id-ID");
}

function formatDate(n, locale = "id") {
  // tikwm mengembalikan timestamp dalam detik, jadi dikalikan 1000 ke milidetik.
  const d = new Date(n * 1000);
  return d.toLocaleDateString(locale, {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "numeric",
    minute: "numeric",
    second: "numeric",
  });
}

// Field URL dari tikwm formatnya tidak konsisten: bisa URL penuh (CDN TikTok),
// path relatif ("/video/cover/xxx.webp"), atau protocol-relative ("//cdn...").
// new URL(x, BASE) menangani ketiganya sekaligus dan mengembalikan null kalau
// nilainya kosong/rusak, jadi tidak ada lagi URL dobel atau string aneh.
function absolutize(path) {
  if (!path || typeof path !== "string") return null;
  try {
    return new URL(path.trim(), BASE).href;
  } catch {
    return null;
  }
}

// Ambil URL valid pertama dari beberapa field kandidat (urutan = prioritas).
function firstUrl(...candidates) {
  for (const c of candidates) {
    const u = absolutize(c);
    if (u) return u;
  }
  return null;
}

// tikwm tidak selalu konsisten — field "hdplay" kadang ukuran filenya malah
// lebih KECIL dari "play" biasa (bukan benar-benar lebih HD). Makanya label
// "HD" di sini ditentukan dari ukuran file asli (byte), bukan cuma percaya
// nama field dari tikwm begitu saja.
function buildVideoMedia(data) {
  const media = [];
  if (data.wmplay) {
    media.push({ type: "watermark", url: absolutize(data.wmplay), size: data.wm_size || 0 });
  }

  const playUrl = absolutize(data.play);
  const hdUrl = absolutize(data.hdplay);
  const playSize = data.size || 0;
  const hdSize = data.hd_size || 0;

  if (playUrl && hdUrl && playUrl !== hdUrl) {
    const smaller = hdSize >= playSize ? { url: playUrl, size: playSize } : { url: hdUrl, size: hdSize };
    const larger = hdSize >= playSize ? { url: hdUrl, size: hdSize } : { url: playUrl, size: playSize };
    media.push({ type: "nowatermark", ...smaller });
    media.push({ type: "nowatermark_hd", ...larger });
  } else if (playUrl || hdUrl) {
    media.push({ type: "nowatermark", url: playUrl || hdUrl, size: playSize || hdSize });
  }

  return media;
}

// Audio: dulu hanya dibuat kalau data.music_info ada, padahal URL audionya
// sering ada di data.music (top-level). Sekarang dibuat mandiri dengan
// fallback ke music_info.play, dan baru null kalau memang tidak ada URL sama sekali.
function buildMusic(data) {
  const info = data.music_info || {};
  const url = firstUrl(data.music, info.play);
  if (!url) return null;
  return {
    id: info.id ?? null,
    title: info.title || "Original sound",
    author: info.author || data.author?.nickname || null,
    url,
  };
}

export async function tiktokDl(url) {
  const domain = "https://www.tikwm.com/api/";
  const params = new URLSearchParams({ url, count: "12", cursor: "0", web: "1", hd: "1" });

  const res = await fetch(`${domain}?${params.toString()}`, {
    method: "POST",
    headers: {
      Accept: "application/json, text/javascript, */*; q=0.01",
      "Accept-Language": "id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7",
      "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
      Origin: BASE,
      Referer: `${BASE}/`,
      "User-Agent": UA,
      "X-Requested-With": "XMLHttpRequest",
    },
    body: "",
    signal: AbortSignal.timeout(15000),
  });

  const json = await res.json().catch(() => null);
  const data = json?.data;

  if (!data) {
    throw new Error(json?.msg || "Gagal mengambil data dari API tikwm.");
  }

  // Data media, dengan url null di-skip supaya tidak ada tombol download yang rusak.
  let media = [];
  if (data.duration == 0) {
    (data.images || []).forEach((v) => {
      const u = absolutize(v);
      if (u) media.push({ type: "photo", url: u });
    });
  } else {
    media = buildVideoMedia(data);
  }

  return {
    status: true,
    title: data.title,
    taken_at: data.create_time ? formatDate(data.create_time) : null,
    region: data.region,
    id: data.id,
    duration: data.duration,
    // Cover: coba beberapa field, terakhir fallback ke foto pertama (untuk slide).
    cover: firstUrl(
      data.cover,
      data.origin_cover,
      data.ai_dynamic_cover,
      data.music_info?.cover,
      data.images?.[0]
    ),
    data: media,
    music_info: buildMusic(data),
    stats: {
      views: formatNumber(data.play_count),
      likes: formatNumber(data.digg_count),
      comment: formatNumber(data.comment_count),
      share: formatNumber(data.share_count),
    },
    author: data.author
      ? {
          id: data.author.id,
          fullname: data.author.unique_id,
          nickname: data.author.nickname,
          avatar: absolutize(data.author.avatar),
        }
      : null,
  };
}
