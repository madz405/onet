import PageIntro from "@/components/PageIntro";
import ToolsSection from "@/components/ToolsSection";
import { SITE_NAME } from "@/lib/site";

export const metadata = {
  title: `Tools — ${SITE_NAME}`,
  description:
    "Tools edit cepat untuk konten harian: hapus background gambar, QR generator, upload file jadi link, kompres gambar, PDF, dan lainnya, langsung dari browser tanpa install.",
  alternates: { canonical: "/tools" },
};

export default function ToolsPage() {
  return (
    <div className="mx-auto max-w-6xl px-5 pb-12 pt-6 sm:pt-10">
      <PageIntro eyebrow="Edit cepat, tanpa install apa-apa" title="Tools bantu konten harianmu." accent="flare">
        Pilih tool di bawah, isi form singkatnya, dan hasilnya siap diunduh dalam beberapa detik.
      </PageIntro>

      <ToolsSection />
    </div>
  );
}
