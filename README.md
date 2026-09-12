# Unduhin

Web downloader media sosial + tools edit cepat + pemutar musik + chat AI, dibangun dengan Next.js (App Router) supaya bisa langsung di-deploy ke Vercel.

## Fitur

- **Downloader** — TikTok, Instagram, Facebook, Pinterest, X/Twitter, CapCut, YouTube (video/audio), Spotify, SoundCloud, Apple Music.
- **Tools** — Brat Text, IQC Status Bar, Lobby Free Fire, Hapus Background, Perjelas Foto (HD).
- **Musik** — cari lagu dari judul (YouTube / Spotify), tampil sebagai satu kartu pemutar (artwork, progress bar, tombol mundur/maju 10 detik, volume) dan bisa diunduh.
- **Chat AI** — sekarang jadi halaman tersendiri (`/chat`), ada di menu navigasi bareng Downloader/Tools/Musik.

Semua tombol download (baik dari downloader maupun tools) diarahkan lewat `app/api/fetch-media` atau proxy tool masing-masing, supaya file **langsung terunduh** — tidak membuka tab baru dulu. Ini penting karena atribut `download` di HTML hanya dihormati browser untuk file satu domain; link CDN pihak ketiga perlu ditarik dulu di server sebelum dikirim ke browser dengan header `Content-Disposition: attachment`.

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
  chat/page.js       → halaman Chat AI
  api/download/      → proxy server untuk semua downloader
  api/tools/         → proxy server untuk brat, iqc, fakeff, removebg, hd
  api/music/         → proxy server pencarian lagu
  api/chat/          → proxy server chat AI
  api/fetch-media/   → proxy pemaksa download (Content-Disposition: attachment)
lib/
  platforms.js       → daftar platform downloader (nama, warna, placeholder)
  tools.js           → daftar tools & definisi form masing-masing
  chatPersona.js     → nama & system prompt bot chat (gampang diedit)
  uploadImage.js     → helper upload gambar ke top4top.io (dipakai removebg & hd)
components/          → semua komponen UI (modal, grid, chat panel, footer, dll)
```

## Mengganti logo chat AI

Buka `components/ChatPanel.js`, cari komponen `LogoBubble`. Taruh file logo kamu di folder `public/` (misalnya `public/chat-logo.png`), lalu ganti isi komponennya sesuai instruksi komentar di file tersebut.

## Mengganti nama/kepribadian bot

Edit `lib/chatPersona.js` — ubah `CHAT_BOT_NAME` dan `CHAT_SYSTEM_PROMPT` sesuka kamu.

## Menambah endpoint baru

**Platform downloader baru** (misal Threads):
1. Tambah metadata di `lib/platforms.js` (id, name, mono, accent, hint, placeholder).
2. Tambah `case` baru sesuai id itu di dalam `switch(platform)` pada `app/api/download/route.js`. Isi: fetch ke endpoint sumber, lalu normalisasi jadi `{ title, author, thumbnail, media: [{ type, label, url }] }`. Contoh pola lengkapnya sudah ada di case-case lain di file yang sama.

Kartu & modal di halaman Downloader otomatis muncul sendiri (halaman itu cuma me-loop array `PLATFORMS`), tidak perlu ubah komponen UI apa pun.

**Tool baru, tipe teks** (input teks/opsi → langsung hasil gambar/video, contoh: brat, iqc):
1. Tambah metadata di `lib/tools.js` dengan `kind: "text"` dan daftar `fields`.
2. Bikin file baru `app/api/tools/<id-tool>/route.js`, tinggal panggil `proxyMedia(urlEndpointSumber)` dari `lib/proxyMedia.js`.

**Tool baru, tipe upload gambar** (contoh: removebg, hd):
1. Tambah metadata di `lib/tools.js` dengan `kind: "upload"`.
2. Tambah satu baris di object `ENDPOINTS` pada `app/api/tools/process/route.js` — isinya fungsi yang membangun URL target dari `imageUrl` hasil upload ke top4top.

Form dan tombolnya di modal Tools otomatis mengikuti karena `ToolModal` sudah generik berdasarkan `kind` dan `fields` — tidak perlu bikin komponen form baru.

> Setiap API pihak ketiga punya bentuk respons JSON yang beda-beda (ada yang taruh data di `result.xxx`, ada yang langsung di root seperti Spotify). Sebelum nulis logic parsing, coba dulu buka URL endpoint-nya langsung di browser untuk lihat bentuk JSON aslinya.

## Catatan penting

- Semua endpoint downloader/tools di sini memakai **API pihak ketiga gratis** (azbry.com, nexray.eu.cc, siputzx.my.id, api-faa.my.id, top4top.io) yang **tidak dikontrol oleh project ini**. Endpoint-endpoint tersebut bisa saja berubah format responsnya, dibatasi rate limit, atau mati sewaktu-waktu — kalau itu terjadi, sesuaikan lagi fungsi parsing-nya di `app/api/download/route.js` atau file tools terkait.
- Tautan hasil download yang berasal dari CDN pihak ketiga (TikTok, Instagram, dll) kadang membuka tab baru alih-alih langsung mengunduh — ini normal, tergantung header yang diberikan CDN tersebut, bukan bug dari aplikasi ini.
- Dua tool dari kumpulan skrip awal — generator e-KTP dan generator bukti transfer DANA — **sengaja tidak disertakan** karena berpotensi disalahgunakan untuk pemalsuan dokumen/penipuan.
