// Memanggil relay YouTube milik sendiri (lihat vidssave-relay.mjs) yang
// berjalan di server dengan IP yang diterima Vidssave (bukan IP Vercel).
//
// Env di Vercel:
//   YT_RELAY_URL  alamat relay, mis. http://free6.daki.cc:4246
//   YT_RELAY_KEY  rahasia yang sama dengan RELAY_SECRET di relay
//
// Hasilnya berisi link unduhan Vidssave dengan `direct: true`, artinya
// dibuka langsung oleh browser pengunjung (tidak ditarik oleh server kita).

export async function scrapeYouTubeRelay(url, format) {
  const base = process.env.YT_RELAY_URL;
  if (!base) throw new Error("YT_RELAY_URL belum diatur.");

  const endpoint = new URL("/yt", base);
  endpoint.searchParams.set("url", url);
  endpoint.searchParams.set("format", format === "audio" ? "audio" : "video");

  const res = await fetch(endpoint, {
    headers: { "x-relay-key": process.env.YT_RELAY_KEY || "" },
    signal: AbortSignal.timeout(28000),
    cache: "no-store",
  });
  const data = await res.json().catch(() => null);
  if (!data?.status) throw new Error(data?.message || `Relay membalas HTTP ${res.status}.`);
  if (!data.media?.length) throw new Error("Relay tidak menghasilkan link.");

  return {
    title: data.title || null,
    author: null,
    thumbnail: data.thumbnail || null,
    media: data.media,
  };
}
