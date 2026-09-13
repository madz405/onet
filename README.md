# ONET

Web downloader media sosial + tools edit cepat + pemutar musik + chat AI, dibangun dengan Next.js (App Router) supaya bisa langsung di-deploy ke Vercel.

## Fitur

- **Downloader** — TikTok, Instagram, Facebook, Pinterest, X/Twitter, CapCut, YouTube (video/audio), Spotify, SoundCloud, Apple Music. Setiap kartu platform pakai logo asli masing-masing. Hasil slide foto TikTok & Instagram ditampilkan dalam bingkai gaya ponsel.
- **Instagram pakai scraper langsung** sebagai metode utama (tanpa API pihak ketiga), baru jatuh ke endpoint API sebagai cadangan kalau scraper gagal.
- **Tools** — Brat Text, IQC Status Bar, Lobby Free Fire, Lobby Mobile Legends (upload avatar + nickname), Hapus Background, Perjelas Foto (HD).
- **Musik** — cari lagu dari judul (YouTube / Spotify), tampil sebagai satu kartu pemutar (artwork, progress bar, previous/next, mode ulangi/acak/berurutan, volume) dan bisa diunduh. Riwayat pencarian tersimpan otomatis di browser (localStorage) — tidak hilang saat refresh, bisa diputar ulang atau dihapus satu-satu.
- **Chat AI** — halaman tersendiri (`/chat`), ada di menu navigasi bareng Downloader/Tools/Musik.
- **Tema warna** — 3 pilihan (Aurora/Sunset/Mint), bisa diganti dari ikon palet di navbar, tersimpan otomatis di browser masing-masing pengunjung.

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
  site.js            → nama, tagline, logo, dan favicon website (lihat bagian ganti branding di bawah)
  platforms.js       → daftar platform downloader (nama, warna, logo, placeholder)
  tools.js           → daftar tools & definisi form masing-masing
  chatPersona.js     → nama & system prompt bot chat (gampang diedit)
  uploadImage.js     → helper upload gambar ke top4top.io (dipakai removebg, hd, fakeml)
  themes.js          → daftar tema warna yang muncul di navbar
  musicHistory.js    → helper localStorage untuk riwayat pencarian musik
  scrapers/instagram.js → scraper langsung ke instagram.com (metode utama downloader IG)
components/          → semua komponen UI (modal, grid, chat panel, footer, theme switcher, dll)
```

> Beberapa endpoint (Instagram sebagai cadangan, IQC) memakai API key statis (`Bell409`) yang ditulis langsung di kode. Kalau suatu saat key ini expired/diganti oleh penyedianya, tinggal cari-ganti string `Bell409` di `app/api/download/route.js` dan `app/api/tools/iqc/route.js`.

## Mengganti nama, logo, dan favicon website

Semua ada di satu file: `lib/site.js`.

```js
export const SITE_NAME = "ONET";
export const SITE_TAGLINE = "Download & Tools Sosial Media";
export const SITE_LOGO = "https://files.catbox.moe/hmnpjb.png";
export const SITE_FAVICON = "https://files.catbox.moe/lb98ty.jpg";
```

Ganti nilainya sesuai kebutuhan — semua tempat yang menampilkan nama/logo situs (navbar, footer, judul tab browser, sapaan chat AI) otomatis ikut berubah karena semuanya baca dari file ini.

Logo & favicon saat ini masih menumpang di catbox.moe (hosting gambar gratis pihak luar). Ini sudah berfungsi normal, tapi kalau suatu saat file di catbox dihapus, gambar akan hilang. Untuk jangka panjang lebih aman upload file logo ke folder `public/` di project ini (misal `public/logo.png`), lalu ganti `SITE_LOGO`/`SITE_FAVICON` di atas jadi `"/logo.png"`.

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
- Scraper Instagram (`lib/scrapers/instagram.js`) mengambil data langsung dari halaman instagram.com. Ini lebih cepat dan tidak tergantung API pihak ketiga, tapi juga lebih rapuh — kalau Instagram mengubah struktur halamannya, scraper bisa berhenti bekerja. Kalau itu terjadi, downloader Instagram tetap jalan karena otomatis jatuh ke endpoint API sebagai cadangan; scraper-nya sendiri baru perlu diperbaiki/disesuaikan lagi.
- Logo tiap platform (`lib/platforms.js`) dan logo/favicon situs (`lib/site.js`) saat ini di-hosting di catbox.moe. Sudah ada fallback otomatis ke inisial huruf kalau gambar gagal dimuat, tapi untuk keandalan jangka panjang, sebaiknya pindahkan file-file itu ke folder `public/` project ini.
- Tautan hasil download yang berasal dari CDN pihak ketiga (TikTok, Instagram, dll) kadang membuka tab baru alih-alih langsung mengunduh — ini normal, tergantung header yang diberikan CDN tersebut, bukan bug dari aplikasi ini.
- Dua tool dari kumpulan skrip awal — generator e-KTP dan generator bukti transfer DANA — **sengaja tidak disertakan** karena berpotensi disalahgunakan untuk pemalsuan dokumen/penipuan.
- Riwayat musik tersimpan di `localStorage`, jadi sifatnya **per-browser/per-perangkat** — ganti browser atau HP berarti riwayat tidak ikut pindah (beda dengan sistem akun/login yang nyimpen di server). Selain itu, link audio (`streamUrl`) dari beberapa endpoint musik bisa kedaluwarsa setelah beberapa waktu; kalau item riwayat lama gagal diputar, itu sebabnya — tinggal cari ulang judul yang sama.
