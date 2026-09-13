import MusicSection from "@/components/MusicSection";
import { SITE_NAME } from "@/lib/site";

export const metadata = { title: `Musik — ${SITE_NAME}` };

export default function MusicPage() {
  return (
    <div className="mx-auto max-w-6xl px-5 py-12">
      <section className="mb-10 max-w-2xl">
        <p className="mb-3 text-sm font-medium text-signal-400">Cari, putar, unduh</p>
        <h1 className="font-display text-3xl font-semibold leading-tight text-white sm:text-4xl">
          Muter lagu dari judulnya aja.
        </h1>
        <p className="mt-3 text-white/60">
          Tidak perlu link — ketik judul lagu atau nama artisnya, pilih YouTube atau Spotify.
        </p>
      </section>

      <MusicSection />
    </div>
  );
}
