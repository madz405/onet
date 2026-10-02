// Mendeteksi platform dari sebuah link berdasarkan hostname-nya.
// Mengembalikan id platform (sama dengan id di lib/platforms.js) atau null.
// Link pendek (vt.tiktok.com, pin.it, fb.watch, youtu.be, b23.tv, xhslink.com, dll)
// ikut dikenali.
const HOST_RULES = [
  { id: "tiktok", hosts: ["tiktok.com"] },
  { id: "instagram", hosts: ["instagram.com", "instagr.am"] },
  { id: "facebook", hosts: ["facebook.com", "fb.com", "fb.watch", "fb.me"] },
  { id: "pinterest", hosts: ["pinterest.com", "pinterest.co.uk", "pinterest.fr", "pinterest.de", "pinterest.jp", "pin.it"] },
  { id: "twitter", hosts: ["twitter.com", "x.com", "t.co", "mobile.twitter.com", "fxtwitter.com", "vxtwitter.com"] },
  { id: "douyin", hosts: ["douyin.com", "iesdouyin.com"] },
  { id: "youtube", hosts: ["youtube.com", "youtu.be", "youtube-nocookie.com"] },
  { id: "threads", hosts: ["threads.net", "threads.com"] },
  { id: "bilibili", hosts: ["bilibili.com", "bilibili.tv", "b23.tv"] },
  { id: "spotify", hosts: ["spotify.com", "spotify.link"] },
  { id: "soundcloud", hosts: ["soundcloud.com", "snd.sc"] },
  { id: "applemusic", hosts: ["music.apple.com"] },
  { id: "reddit", hosts: ["reddit.com", "redd.it"] },
  { id: "pixiv", hosts: ["pixiv.net"] },
  { id: "rednote", hosts: ["xiaohongshu.com", "xhslink.com", "rednote.com"] },
  {
    id: "terabox",
    hosts: [
      "terabox.com", "teraboxapp.com", "terabox.app", "1024terabox.com",
      "freeterabox.com", "4funbox.com", "mirrobox.com", "nephobox.com",
      "momerybox.com", "tibibox.com", "terasharelink.com",
    ],
  },
];

// Ambil URL pertama dari teks (user sering menempel teks "Lihat video ini https://...").
export function extractUrl(text) {
  if (!text) return "";
  const trimmed = text.trim();
  const match = trimmed.match(/https?:\/\/[^\s]+/i);
  if (match) return match[0].replace(/[)\]}>,.;!?]+$/, "");
  // Tanpa skema, mis. "vt.tiktok.com/ZS..." -> tambahkan https://
  if (/^[\w-]+(\.[\w-]+)+\/\S*/.test(trimmed) && !/\s/.test(trimmed)) return `https://${trimmed}`;
  return "";
}

export function detectPlatformId(text) {
  const url = extractUrl(text);
  if (!url) return null;
  let host;
  try {
    host = new URL(url).hostname.toLowerCase();
  } catch {
    return null;
  }
  // Link Spotify/SoundCloud tertentu tetap sama: cukup cocokkan hostname.
  for (const rule of HOST_RULES) {
    if (rule.hosts.some((h) => host === h || host.endsWith(`.${h}`))) return rule.id;
  }
  return null;
}
