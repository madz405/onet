/***
  @ Base: https://sechno.com/tools/terabox-downloader
  @ Note: Ambil link unduhan langsung file dari link share TeraBox lewat API
    sechno.com. Diadaptasi dari axios ke fetch bawaan Node.
  @ Catatan: link streaming m3u8 dari sumbernya sengaja TIDAK dipakai —
    m3u8 itu playlist, bukan file, jadi kalau "diunduh" hasilnya cuma
    file teks. Yang dipakai hanya link unduhan langsung (downloadUrl).
  @ Format hasil: { title, author, thumbnail, media: [{ type: "file", label, url, filename }] }
***/

function extractCleanUrl(text) {
  const match = String(text || "").match(/https?:\/\/[^\s]+/i);
  return match ? match[0] : String(text || "").trim();
}

export async function scrapeTerabox(url) {
  if (!url || typeof url !== "string") throw new Error("Link TeraBox tidak valid.");
  const cleanUrl = extractCleanUrl(url);

  const res = await fetch("https://sechno.com/api/terabox", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
      Referer: "https://sechno.com/tools/terabox-downloader",
    },
    body: JSON.stringify({ url: cleanUrl }),
    signal: AbortSignal.timeout(20000),
  });

  let data;
  try {
    data = await res.json();
  } catch {
    throw new Error(`Situs sumber (sechno.com) mengembalikan respons tidak valid (status ${res.status}).`);
  }
  if (!data?.success) {
    throw new Error(data?.error || "Gagal memproses link TeraBox ini.");
  }

  const files = Array.isArray(data.files) ? data.files : [];
  if (!files.length) throw new Error("Tidak ada file di link share TeraBox ini.");

  const media = [];
  for (const f of files) {
    if (f.isDir || !f.downloadUrl) continue;
    const size = f.sizeFormatted || (f.size ? `${f.size} B` : "");
    media.push({
      type: "file",
      label: size ? `${f.filename} · ${size}` : f.filename,
      url: f.downloadUrl,
      filename: f.filename,
    });
  }
  if (!media.length) throw new Error("File di link ini tidak punya link unduhan langsung.");

  return {
    title: data.title || "File TeraBox",
    author: null,
    thumbnail: files.find((f) => f.thumbUrl)?.thumbUrl || null,
    media,
  };
}
