/***
  @ Base: https://www.tikwm.com/
  @ Note: TikTok video/slide downloader lewat API tikwm (tanpa key).
  @ Diadaptasi dari axios ke fetch bawaan Node supaya konsisten dengan
    scraper lain di project ini (tidak perlu tambah dependency axios).
***/

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

export async function tiktokDl(url) {
  const domain = "https://www.tikwm.com/api/";
  const params = new URLSearchParams({ url, count: "12", cursor: "0", web: "1", hd: "1" });

  const res = await fetch(`${domain}?${params.toString()}`, {
    method: "POST",
    headers: {
      Accept: "application/json, text/javascript, */*; q=0.01",
      "Accept-Language": "id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7",
      "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
      Origin: "https://www.tikwm.com",
      Referer: "https://www.tikwm.com/",
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

  // Data media, dengan url null di-skip (bukan di-fallback ke string aneh
  // seperti kode aslinya) supaya tidak ada tombol download yang rusak.
  let media = [];
  if (data.duration == 0) {
    (data.images || []).forEach((v) => v && media.push({ type: "photo", url: v }));
  } else {
    media = [
      { type: "watermark", url: data.wmplay ? "https://www.tikwm.com" + data.wmplay : null },
      { type: "nowatermark", url: data.play ? "https://www.tikwm.com" + data.play : null },
      { type: "nowatermark_hd", url: data.hdplay ? "https://www.tikwm.com" + data.hdplay : null },
    ].filter((m) => m.url);
  }

  return {
    status: true,
    title: data.title,
    taken_at: data.create_time ? formatDate(data.create_time) : null,
    region: data.region,
    id: data.id,
    duration: data.duration,
    cover: data.cover ? "https://www.tikwm.com" + data.cover : null,
    data: media,
    music_info: data.music_info
      ? {
          id: data.music_info.id,
          title: data.music_info.title,
          author: data.music_info.author,
          url: data.music ? "https://www.tikwm.com" + data.music : data.music_info.play || null,
        }
      : null,
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
          avatar: data.author.avatar ? "https://www.tikwm.com" + data.author.avatar : null,
        }
      : null,
  };
}
