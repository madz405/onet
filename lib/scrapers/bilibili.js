/***
  @ Base: https://api.bilibili.com/ dan https://api.bilibili.tv/
  @ Note: Dua alur beda tergantung jenis link:
    - bilibili.tv (versi internasional/anime): cari id video/episode dari
      path URL-nya, lalu panggil API resmi bilibili.tv.
    - bilibili.com (versi Tiongkok, ada BV.../av...): panggil API resmi
      bilibili.com (view -> playurl).
    Diadaptasi dari axios ke fetch bawaan Node, logika lain dipertahankan.
***/

function parseBilibiliTvIds(cleanUrl) {
  const urlObj = new URL(cleanUrl);
  const parts = urlObj.pathname.split("/").filter(Boolean);

  const idxVideo = parts.indexOf("video");
  if (idxVideo !== -1) {
    const aid = parts[idxVideo + 1];
    if (aid && /^\d+$/.test(aid)) return { tipo: "video", id: aid };
  }

  const idxPlay = parts.indexOf("play");
  if (idxPlay !== -1) {
    const numericParts = parts.slice(idxPlay + 1).filter((p) => /^\d+$/.test(p));
    if (numericParts.length > 1) return { tipo: "anime", id: numericParts[1] };
    if (numericParts.length === 1) return { tipo: "anime", id: null, seasonId: numericParts[0] };
  }

  return null;
}

async function scrapeBilibiliTv(cleanUrl) {
  const apiInfo = parseBilibiliTvIds(cleanUrl);
  if (!apiInfo) throw new Error("Tidak bisa membaca ID video/episode dari link bilibili.tv.");

  let title = "Bilibili.tv Video";
  let thumbnail = null;

  // Kalau cuma dapat season_id (dari link /play/xxxx tanpa episode spesifik),
  // ambil dulu episode pertamanya.
  if (apiInfo.tipo === "anime" && !apiInfo.id && apiInfo.seasonId) {
    try {
      const epRes = await fetch(
        `https://api.bilibili.tv/intl/gateway/web/v2/ogv/play/episodes?season_id=${apiInfo.seasonId}&platform=web&s_locale=en_US`,
        { signal: AbortSignal.timeout(10000) }
      );
      const epData = await epRes.json();
      const firstEp = epData?.data?.sections?.[0]?.episodes?.[0];
      if (firstEp) {
        apiInfo.id = firstEp.episode_id || firstEp.ep_id || firstEp.id;
        title = firstEp.title_display || title;
        thumbnail = firstEp.cover || thumbnail;
      }
    } catch {
      // biarkan apiInfo.id tetap kosong; akan gagal di pengecekan media di bawah
    }
  }

  const media = [];
  if (apiInfo.tipo === "anime" && (apiInfo.id || apiInfo.seasonId)) {
    const param = apiInfo.id ? `ep_id=${apiInfo.id}` : `season_id=${apiInfo.seasonId}`;
    const v2Res = await fetch(
      `https://api.bilibili.tv/intl/gateway/v2/ogv/playurl?${param}&platform=web&s_locale=en_US`,
      { signal: AbortSignal.timeout(10000) }
    );
    const v2Data = await v2Res.json();
    const streamList = v2Data?.data?.video_info?.stream_list || [];
    streamList.forEach((s) => {
      const playUrl =
        s.url || s.url_list?.[0]?.url || s.dash_video?.base_url || s.dash_video?.backup_url?.[0];
      if (playUrl) {
        const quality =
          s.stream_info?.display_desc || s.stream_info?.description || (s.quality ? `${s.quality}p` : "720p");
        media.push({ type: "video", label: quality, url: playUrl.replace(/^http:/, "https:") });
      }
    });
  }

  if (!media.length) throw new Error("Tidak ada stream video yang dikembalikan API bilibili.tv.");

  return { title, author: null, thumbnail, media };
}

async function scrapeBilibiliCom(cleanUrl) {
  const bvMatch = cleanUrl.match(/(BV[a-zA-Z0-9]+)/i);
  const bvid = bvMatch ? bvMatch[1] : null;
  const avMatch = cleanUrl.match(/(?:video\/av|[?&]aid=)(\d+)/i);
  const aid = avMatch ? avMatch[1] : null;

  if (!bvid && !aid) {
    throw new Error("Link harus berupa URL video Bilibili yang valid (mengandung BV atau AV id).");
  }

  const headers = { Referer: "https://www.bilibili.com/", "User-Agent": "Bilibili/1.0" };

  const viewUrl = bvid
    ? `https://api.bilibili.com/x/web-interface/view?bvid=${bvid}`
    : `https://api.bilibili.com/x/web-interface/view?aid=${aid}`;
  const viewRes = await fetch(viewUrl, { headers, signal: AbortSignal.timeout(10000) });
  const viewData = await viewRes.json();
  if (!viewData || viewData.code !== 0 || !viewData.data) {
    throw new Error(viewData?.message || "Gagal mengambil detail video dari API Bilibili.");
  }

  const data = viewData.data;
  const cid = data.cid || data.pages?.[0]?.cid;
  const effectiveBvid = data.bvid || bvid;
  if (!cid) throw new Error("Tidak menemukan cid video dari API Bilibili.");

  const playBase = `https://api.bilibili.com/x/player/playurl?bvid=${effectiveBvid}&cid=${cid}&qn=64`;
  // platform=html5 meminta format MP4 (H.264) yang bisa dipratinjau di browser;
  // tanpa itu Bilibili sering mengembalikan FLV yang tidak bisa diputar tag
  // <video>. Kalau permintaan ini tidak menghasilkan stream, ulangi tanpa
  // parameter tambahan seperti sebelumnya.
  let durl = [];
  for (const extra of ["&platform=html5&high_quality=1", ""]) {
    try {
      const playRes = await fetch(playBase + extra, { headers, signal: AbortSignal.timeout(10000) });
      const playData = await playRes.json();
      durl = playData?.data?.durl || [];
      if (durl.length) break;
    } catch {
      // coba variasi berikutnya
    }
  }
  // Link dari Bilibili sering berawalan http:// — dipaksa https supaya tidak
  // diblokir browser sebagai mixed content di halaman https.
  const media = durl.map((item) => ({
    type: "video",
    label: "720p",
    url: String(item.url).replace(/^http:/i, "https:"),
  }));

  if (!media.length) throw new Error("Tidak ada URL stream yang dikembalikan API Bilibili.");

  return {
    title: data.title || "Bilibili Video",
    author: data.owner?.name || null,
    thumbnail: data.pic ? data.pic.replace(/^http:/i, "https:") : null,
    media,
  };
}

export async function scrapeBilibili(url) {
  if (!url || typeof url !== "string") throw new Error("Link Bilibili tidak valid.");
  const cleanUrl = url.trim();

  if (cleanUrl.includes("bilibili.tv")) return scrapeBilibiliTv(cleanUrl);
  return scrapeBilibiliCom(cleanUrl);
}
