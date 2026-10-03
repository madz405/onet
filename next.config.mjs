/** @type {import('next').NextConfig} */
const nextConfig = {
  // Preview media hasil download (thumbnail/video dari CDN pihak ketiga yang
  // berubah-ubah) tetap pakai <img>/<video> biasa, bukan next/image, jadi
  // tidak perlu whitelist domain di sini. Optimasi next/image tetap aktif
  // (default) untuk aset lokal di public/ seperti logo & avatar chat.
  eslint: {
    ignoreDuringBuilds: true,
  },
  // yt-search (pencarian YouTube) memakai require dinamis, jadi jangan
  // di-bundle webpack: biarkan dimuat langsung dari node_modules di server.
  experimental: {
    serverComponentsExternalPackages: ["yt-search"],
  },
};

export default nextConfig;
