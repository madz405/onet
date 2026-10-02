import DownloaderSection from "@/components/DownloaderSection";
import { SITE_NAME } from "@/lib/site";
import { PLATFORMS } from "@/lib/platforms";

export default function HomePage() {
  return (
    <div className="mx-auto max-w-6xl px-5 py-12">
      <section className="mb-10 max-w-2xl">
        <p className="mb-3 text-sm font-medium text-signal-400">{PLATFORMS.length} platform, satu tempat</p>
        <h1 className="font-display text-3xl font-semibold leading-tight text-white sm:text-4xl">
          Tempel link, ambil video, image atau audionya.
        </h1>
        <p className="mt-3 text-white/60">
          Tempel link dari platform mana saja, {SITE_NAME} akan mengenali platformnya
          otomatis dan menyiapkan filenya untukmu tanpa watermark kalau tersedia.
        </p>
      </section>

      <DownloaderSection />
    </div>
  );
}
