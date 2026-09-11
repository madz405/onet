/** @type {import('next').NextConfig} */
const nextConfig = {
  // Media hasil download berasal dari CDN pihak ketiga yang berubah-ubah,
  // jadi kita pakai <img>/<video> biasa dan matikan optimasi bawaan next/image.
  images: {
    unoptimized: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
