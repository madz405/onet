# Unduhin

Web downloader media sosial + tools edit cepat + pemutar musik + chat AI, dibangun dengan Next.js (App Router) supaya bisa langsung di-deploy ke Vercel.

## Fitur

- **Downloader** — TikTok, Instagram, Facebook, Pinterest, X/Twitter, CapCut, YouTube (video/audio), Spotify, SoundCloud, Apple Music.
- **Tools** — Brat Text, IQC Status Bar, Lobby Free Fire, Hapus Background, Perjelas Foto (HD).
- **Musik** — cari lagu dari judul (YouTube / Spotify), langsung diputar & bisa diunduh.
- **Chat AI** — widget bulat mengambang di pojok kanan bawah.

Semua panggilan ke API pihak ketiga dilakukan lewat API Route Next.js (`app/api/**`) di sisi server, jadi browser hanya bicara ke domain sendiri — **tidak akan kena masalah CORS** saat di-deploy ke Vercel.

## Menjalankan secara lokal

```bash
npm install
npm run dev
```

Buka http://localhost:3000

## Deploy ke Vercel

1. Push folder ini ke repo GitHub kamu.
2. Import repo tersebut di [vercel.com/new](https://vercel.com/new).
3. Vercel otomatis mendeteksi Next.js — tidak perlu setting tambahan apa pun (tidak ada environment variable yang dibutuhkan, karena tidak ada API key).
4. Deploy.

## Struktur penting

```
app/
  page.js            → halaman Downloader (grid platform)
  tools/page.js      → halaman Tools
  musik/page.js      → halaman pemutar musik
  api/download/      → proxy server untuk semua downloader
  api/tools/         → proxy server untuk brat, iqc, fakeff, removebg, hd
  api/music/         → proxy server pencarian lagu
  api/chat/          → proxy server chat AI
lib/
  platforms.js       → daftar platform downloader (nama, warna, placeholder)
  tools.js           → daftar tools & definisi form masing-masing
  chatPersona.js     → nama & system prompt bot chat (gampang diedit)
  uploadImage.js     → helper upload gambar ke top4top.io (dipakai removebg & hd)
components/          → semua komponen UI (modal, grid, chat widget, dll)
```

## Mengganti logo chat AI

Buka `components/ChatWidget.js`, cari komponen `LogoBubble`. Taruh file logo kamu di folder `public/` (misalnya `public/chat-logo.png`), lalu ganti isi komponennya sesuai instruksi komentar di file tersebut.

## Mengganti nama/kepribadian bot

Edit `lib/chatPersona.js` — ubah `CHAT_BOT_NAME` dan `CHAT_SYSTEM_PROMPT` sesuka kamu.

## Catatan penting

- Semua endpoint downloader/tools di sini memakai **API pihak ketiga gratis** (azbry.com, nexray.eu.cc, siputzx.my.id, api-faa.my.id, top4top.io) yang **tidak dikontrol oleh project ini**. Endpoint-endpoint tersebut bisa saja berubah format responsnya, dibatasi rate limit, atau mati sewaktu-waktu — kalau itu terjadi, sesuaikan lagi fungsi parsing-nya di `app/api/download/route.js` atau file tools terkait.
- Tautan hasil download yang berasal dari CDN pihak ketiga (TikTok, Instagram, dll) kadang membuka tab baru alih-alih langsung mengunduh — ini normal, tergantung header yang diberikan CDN tersebut, bukan bug dari aplikasi ini.
- Dua tool dari kumpulan skrip awal — generator e-KTP dan generator bukti transfer DANA — **sengaja tidak disertakan** karena berpotensi disalahgunakan untuk pemalsuan dokumen/penipuan.
