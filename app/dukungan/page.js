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
    <div className="mx-auto max-w-6xl px-5 py-12">
      <section className="mb-8 max-w-2xl">
        <p className="mb-3 text-sm font-medium text-signal-400">Dukungan</p>
        <h1 className="font-display text-3xl font-semibold leading-tight text-white sm:text-4xl">
          Traktir KOYEN kopi.
        </h1>
        <p className="mt-3 text-white/60">
          KOYEN gratis dipakai. Kalau terbantu, dukunganmu membantu biaya server dan pengembangan
          fitur baru. Pilih cara yang paling nyaman.
        </p>
      </section>

      <SupportSection />
    </div>
  );
}
