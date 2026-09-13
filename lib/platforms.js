// Metadata untuk grid downloader di halaman utama.
// - "mono"   : singkatan yang ditampilkan kalau logo asli gagal dimuat (fallback)
// - "accent" : warna cincin/border dekoratif di sekitar kotak logo
// - "logo"   : URL gambar logo asli platform (di-host di catbox.moe oleh user)
export const PLATFORMS = [
  {
    id: "tiktok",
    name: "TikTok",
    mono: "TT",
    accent: "#25F4EE",
    logo: "https://files.catbox.moe/x59hjv.png",
    hint: "Video atau slide foto TikTok, tanpa watermark.",
    placeholder: "https://vt.tiktok.com/....",
  },
  {
    id: "instagram",
    name: "Instagram",
    mono: "IG",
    accent: "#E1306C",
    logo: "https://files.catbox.moe/52vchd.jpg",
    hint: "Reels, video, atau carousel foto.",
    placeholder: "https://www.instagram.com/reel/....",
  },
  {
    id: "facebook",
    name: "Facebook",
    mono: "FB",
    accent: "#1877F2",
    logo: "https://files.catbox.moe/2fljyh.png",
    hint: "Video atau foto dari post/reel Facebook.",
    placeholder: "https://www.facebook.com/share/....",
  },
  {
    id: "pinterest",
    name: "Pinterest",
    mono: "PT",
    accent: "#E60023",
    logo: "https://files.catbox.moe/3qfllq.jpg",
    hint: "Pin gambar maupun video.",
    placeholder: "https://pin.it/....",
  },
  {
    id: "twitter",
    name: "X / Twitter",
    mono: "X",
    accent: "#E7E9EA",
    logo: "https://files.catbox.moe/qhdza2.jpg",
    hint: "Foto atau video dari sebuah postingan.",
    placeholder: "https://x.com/user/status/....",
  },
  {
    id: "capcut",
    name: "CapCut",
    mono: "CC",
    accent: "#00F6D3",
    logo: "https://files.catbox.moe/ss63yx.png",
    hint: "Video template CapCut, dengan/tanpa watermark.",
    placeholder: "https://www.capcut.com/tv2/....",
  },
  {
    id: "youtube",
    name: "YouTube",
    mono: "YT",
    accent: "#FF0000",
    logo: "https://files.catbox.moe/494z0w.png",
    hint: "Unduh sebagai video MP4 atau audio MP3.",
    placeholder: "https://www.youtube.com/watch?v=....",
    hasFormat: true,
  },
  {
    id: "spotify",
    name: "Spotify",
    mono: "SP",
    accent: "#1DB954",
    logo: "https://files.catbox.moe/0p2acx.png",
    hint: "Unduh lagu dari link track Spotify.",
    placeholder: "https://open.spotify.com/track/....",
  },
  {
    id: "soundcloud",
    name: "SoundCloud",
    mono: "SC",
    accent: "#FF7A33",
    logo: "https://files.catbox.moe/227b10.jpg",
    hint: "Unduh audio dari link track SoundCloud.",
    placeholder: "https://soundcloud.com/artis/judul",
  },
  {
    id: "applemusic",
    name: "Apple Music",
    mono: "AM",
    accent: "#FA57C1",
    logo: "https://files.catbox.moe/7rf1pd.png",
    hint: "Unduh lagu dari link Apple Music.",
    placeholder: "https://music.apple.com/id/album/....",
  },
];

export function getPlatform(id) {
  return PLATFORMS.find((p) => p.id === id);
}
