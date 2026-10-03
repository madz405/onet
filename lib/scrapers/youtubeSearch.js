// Cari video YouTube dari judul/nama artis pakai module "yt-search" (yts),
// lalu kembalikan URL video yang paling cocok untuk diproses scraper.
import yts from "yt-search";

const SEARCH_TIMEOUT_MS = 10000;
const MIN_SECONDS = 30; // buang klip/iklan super pendek
const MAX_SECONDS = 15 * 60; // buang kompilasi/podcast terlalu panjang

export async function searchYouTubeVideo(query) {
  const search = yts({ query, hl: "id", gl: "ID" });
  const timeout = new Promise((_, reject) =>
    setTimeout(() => reject(new Error("Pencarian YouTube (yts) terlalu lama.")), SEARCH_TIMEOUT_MS)
  );
  const res = await Promise.race([search, timeout]);

  const videos = (res?.videos || []).filter((v) => v?.videoId);
  if (!videos.length) throw new Error("Lagu tidak ditemukan di YouTube.");

  // Utamakan video berdurasi wajar untuk sebuah lagu; kalau tidak ada,
  // pakai hasil pertama apa adanya.
  const pick =
    videos.find((v) => v.seconds >= MIN_SECONDS && v.seconds <= MAX_SECONDS) || videos[0];

  return {
    url: `https://www.youtube.com/watch?v=${pick.videoId}`,
    videoId: pick.videoId,
    title: pick.title,
    author: pick.author?.name || null,
    seconds: pick.seconds || null,
    thumbnail: pick.thumbnail || pick.image || `https://i.ytimg.com/vi/${pick.videoId}/hqdefault.jpg`,
  };
}
