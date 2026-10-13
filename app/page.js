import PageIntro from "@/components/PageIntro";
import DownloaderSection from "@/components/DownloaderSection";
import { SITE_NAME } from "@/lib/site";
import { PLATFORMS } from "@/lib/platforms";

export const metadata = { alternates: { canonical: "/" } };

export default function HomePage() {
  return (
    <div className="mx-auto max-w-6xl px-5 pb-12 pt-6 sm:pt-10">
      <PageIntro eyebrow={<>{PLATFORMS.length} platform, satu tempat</>} title="Tempel link, ambil video, image atau audionya." accent="signal">
        Tempel link dari platform mana saja, {SITE_NAME} akan mengenali platformnya otomatis dan menyiapkan filenya untukmu tanpa watermark kalau tersedia.
      </PageIntro>

      <DownloaderSection />
    </div>
  );
}
