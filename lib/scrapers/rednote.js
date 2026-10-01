/***
  @ Base: https://www.xiaohongshu.com/ (RedNote)
  @ Note: Ambil video atau foto dari postingan RedNote/Xiaohongshu langsung
    dari halamannya (data awal di HTML, lalu OpenGraph sebagai cadangan).
    Mendukung link pendek xhslink.com/xhslink.cn.
    Diadaptasi dari axios ke fetch bawaan Node.
  @ Format hasil: { title, author, thumbnail, media: [{ type, label, url }] }
***/

const MOBILE_UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 16_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.5 Mobile/15E148 Safari/604.1";
const DESKTOP_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

const withProtocol = (u) => (typeof u === "string" && u.startsWith("//") ? `https:${u}` : u);

function isLandingOrErrorPage(title, imgUrl) {
  const invalidTitles = [
    "你的生活兴趣社区",
    "你访问的页面不见了",
    "页面不见了",
    "404 Not Found",
    "Page Not Found",
  ];
  if (title && invalidTitles.some((t) => title.includes(t))) return true;
  if (imgUrl && (imgUrl.includes("e6214e4fbfae2cf14d634d4296916e8a5eaefdf4") || imgUrl.includes("fe-platform"))) {
    return true;
  }
  return false;
}

const hasNoteFields = (n) => n && !Array.isArray(n) && (n.title || n.desc || n.imageList || n.video);

function findNoteObjectFromState(state) {
  if (!state) return null;

  const nd = state.noteData?.data?.noteData;
  if (hasNoteFields(nd)) return nd;

  const map = state.note?.noteDetailMap;
  if (map) {
    for (const k of Object.keys(map)) {
      const item = map[k]?.note || map[k];
      if (hasNoteFields(item)) return item;
    }
  }

  const alt = [
    state.noteData?.note,
    state.noteData,
    state.note?.firstNote,
    state.feed?.note,
    state.firstNote,
  ];
  for (const cand of alt) if (hasNoteFields(cand)) return cand;

  return null;
}

function pickVideoUrl(noteData) {
  const streamObj = noteData.video?.media?.stream || {};
  for (const codec of ["h264", "h265", "h266", "av1"]) {
    const first = Array.isArray(streamObj[codec]) ? streamObj[codec][0] : null;
    const u = first?.masterUrl || first?.backupUrls?.[0] || first?.url;
    if (u) return withProtocol(u);
  }
  const fallback = noteData.video?.media?.video?.masterUrl;
  return fallback ? withProtocol(fallback) : null;
}

function extractMediaFromHtml(html) {
  const htmlStr = typeof html === "string" ? html : "";

  const matchState =
    htmlStr.match(/window\.__INITIAL_STATE__\s*=\s*(\{[\s\S]+?\});?<\/script>/) ||
    htmlStr.match(/window\.__INITIAL_DATA__\s*=\s*(\{[\s\S]+?\});?<\/script>/) ||
    htmlStr.match(/__INITIAL_STATE__\s*=\s*(\{[\s\S]+?\});?<\/script>/) ||
    htmlStr.match(/window\.__PRELOADED_STATE__\s*=\s*(\{[\s\S]+?\});?<\/script>/);

  if (matchState) {
    try {
      const state = JSON.parse(matchState[1].replace(/;\s*$/, "").replace(/:\s*undefined/g, ":null"));
      const noteData = findNoteObjectFromState(state);

      if (noteData) {
        const title = noteData.title || noteData.desc || "Postingan RedNote";
        const author = noteData.user?.nickname || noteData.user?.nickName || null;
        const images = Array.isArray(noteData.imageList) ? noteData.imageList : [];

        const firstImg = images[0]?.urlDefault || images[0]?.urlOriginal || images[0]?.url;
        const thumbnail = firstImg ? withProtocol(firstImg) : null;

        if (!isLandingOrErrorPage(title, thumbnail)) {
          const media = [];
          const videoUrl = noteData.video ? pickVideoUrl(noteData) : null;

          if (videoUrl) {
            // Catatan video: imageList-nya cuma cover, jadi tidak ikut diunduh.
            media.push({ type: "video", label: "Download video HD", url: videoUrl });
          } else {
            images.forEach((img, i) => {
              const u = img.urlOriginal || img.urlDefault || img.url;
              if (u) media.push({ type: "image", label: `Foto ${i + 1}`, url: withProtocol(u) });
            });
          }

          if (media.length) {
            return { title, author, thumbnail: thumbnail || media[0].url, media };
          }
        }
      }
    } catch {
      // lanjut ke cadangan OpenGraph
    }
  }

  // Cadangan: meta OpenGraph.
  const meta = (prop) =>
    htmlStr.match(new RegExp(`<meta\\s+(?:property|name)="${prop}"\\s+content="([^"]+)"`, "i"))?.[1];
  const rawTitle = meta("og:title") || htmlStr.match(/<title>([^<]+)<\/title>/i)?.[1] || "";
  const rawImage = withProtocol(meta("og:image") || "");
  const rawVideo = withProtocol(meta("og:video") || meta("og:video:url") || "");

  if (!isLandingOrErrorPage(rawTitle, rawImage) && (rawImage || rawVideo)) {
    const title = rawTitle.replace(/ - (?:小红书|RedNote).*/i, "").trim() || "Postingan RedNote";
    const media = [];
    if (rawVideo) media.push({ type: "video", label: "Download video HD", url: rawVideo });
    else if (rawImage) media.push({ type: "image", label: "Foto", url: rawImage });
    if (media.length) return { title, author: null, thumbnail: rawImage || null, media };
  }

  return null;
}

async function fetchPage(url, ua, withCookie = false) {
  return fetch(url, {
    headers: {
      "User-Agent": ua,
      "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
      ...(withCookie ? { Cookie: "a1=18a1234567890abcdef1234567890abc; webId=1234567890abcdef" } : {}),
    },
    redirect: "follow",
    signal: AbortSignal.timeout(10000),
  });
}

export async function scrapeRedNote(url) {
  if (!url || typeof url !== "string") throw new Error("Link RedNote tidak valid.");
  let cleanUrl = url.match(/https?:\/\/[^\s]+/i)?.[0] || url.trim();

  const userAgents = [DESKTOP_UA, MOBILE_UA];
  let noteId = null;

  // Link pendek xhslink.com / xhslink.cn: ikuti redirect-nya dulu.
  if (/xhslink\.(com|cn)/i.test(cleanUrl)) {
    for (const ua of userAgents) {
      try {
        const res = await fetchPage(cleanUrl, ua);
        const html = await res.text();

        const extracted = extractMediaFromHtml(html);
        if (extracted) return extracted;

        const idMatch = `${res.url} ${html}`.match(/\/([a-f0-9]{24})/i);
        if (idMatch) noteId = idMatch[1];

        if (res.url && !/xhslink\.(com|cn)/i.test(res.url)) {
          cleanUrl = res.url;
          break;
        }
      } catch {
        // coba User-Agent berikutnya
      }
    }
  }

  if (!noteId) {
    const idMatch =
      cleanUrl.match(/\/(?:explore|discovery\/item|red_video)\/([a-f0-9]{24})/i) ||
      cleanUrl.match(/\/([a-f0-9]{24})/i);
    if (idMatch) noteId = idMatch[1];
  }

  const urlsToTry = [];
  if (!/xhslink\.(com|cn)/i.test(cleanUrl)) urlsToTry.push(cleanUrl);
  if (noteId) {
    urlsToTry.push(
      `https://www.xiaohongshu.com/discovery/item/${noteId}`,
      `https://www.xiaohongshu.com/explore/${noteId}`,
      `https://www.rednote.com/discovery/item/${noteId}`,
      `https://www.rednote.com/explore/${noteId}`
    );
  }

  for (const target of urlsToTry) {
    for (const ua of userAgents) {
      try {
        const res = await fetchPage(target, ua, true);
        const extracted = extractMediaFromHtml(await res.text());
        if (extracted) return extracted;
      } catch {
        // coba kombinasi berikutnya
      }
    }
  }

  throw new Error("Postingan RedNote tidak ditemukan atau link sudah kedaluwarsa.");
}
