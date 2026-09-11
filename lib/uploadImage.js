// Sejumlah endpoint tool (hapus background, perjelas foto) hanya menerima
// URL gambar publik, bukan file upload langsung. Jadi kita upload dulu file
// yang dikirim user ke top4top.io, lalu memakai URL hasilnya sebagai input.
//
// Node 18+ / runtime Vercel sudah punya fetch, FormData, dan Blob secara
// global, jadi tidak perlu paket tambahan.

const UA =
  "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Mobile Safari/537.36";

export async function uploadToTop4top(buffer, filename, contentType) {
  const initRes = await fetch("https://top4top.io/", {
    headers: { "User-Agent": UA },
  });
  const initHtml = await initRes.text();
  const sidMatch = initHtml.match(/name=["']sid["'][^>]*value=["']([^"']+)["']/i);
  const sid = sidMatch?.[1] || "";

  const form = new FormData();
  if (sid) form.append("sid", sid);
  const blob = new Blob([buffer], { type: contentType || "application/octet-stream" });
  form.append("file_0_", blob, filename);
  for (let i = 1; i <= 9; i++) form.append(`file_${i}_`, "");
  form.append("submitr", "[ رفع الملفات ]");

  const res = await fetch("https://top4top.io/index.php", {
    method: "POST",
    body: form,
    headers: {
      accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      origin: "https://top4top.io",
      referer: "https://top4top.io/",
      "user-agent": UA,
    },
  });

  const html = await res.text();
  const inputMatch = html.match(/value=["'](https:\/\/[^"']*\/p_[^"']*)["']/i);
  const urlMatch = html.match(/https:\/\/[^'"<>\s]*\/p_[^'"<>\s]*/);
  const url = inputMatch?.[1] || urlMatch?.[0] || null;

  if (!url) {
    throw new Error("Gagal upload gambar ke image host, coba lagi.");
  }
  return url;
}
