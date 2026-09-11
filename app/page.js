import DownloaderSection from "@/components/DownloaderSection";

export default function HomePage() {
  return (
    <div className="mx-auto max-w-6xl px-5 py-12">
      <section className="mb-10 max-w-2xl">
        <p className="mb-3 text-sm font-medium text-signal-400">10 platform, satu tempat</p>
        <h1 className="font-display text-3xl font-semibold leading-tight text-white sm:text-4xl">
          Tempel link, ambil videonya.
        </h1>
        <p className="mt-3 text-white/60">
          Pilih platform di bawah, tempel link video atau foto yang mau diunduh, dan Unduhin akan
          menyiapkan filenya untukmu — tanpa watermark kalau tersedia.
        </p>
      </section>

      <DownloaderSection />
    </div>
  );
}
