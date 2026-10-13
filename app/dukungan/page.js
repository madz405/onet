import PageIntro from "@/components/PageIntro";
import SupportSection from "@/components/SupportSection";
import { SITE_NAME } from "@/lib/site";

export const metadata = {
  title: `Dukungan — ${SITE_NAME}`,
  description:
    "Dukung KOYEN tetap gratis dan terus berkembang lewat Saweria atau QRIS DANA.",
  alternates: { canonical: "/dukungan" },
};

export default function SupportPage() {
  return (
    <div className="mx-auto max-w-6xl px-5 pb-12 pt-6 sm:pt-10">
      <PageIntro eyebrow="Dukungan" title="Traktir KOYEN kopi." accent="signal">
        KOYEN gratis dipakai. Kalau terbantu, dukunganmu membantu biaya server dan pengembangan fitur baru. Pilih cara yang paling nyaman.
      </PageIntro>

      <SupportSection />
    </div>
  );
}
