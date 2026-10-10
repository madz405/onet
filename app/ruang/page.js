import VirtualRoom from "@/components/VirtualRoom";
import { SITE_NAME } from "@/lib/site";

export const metadata = {
  title: `Ruang Virtual — ${SITE_NAME}`,
  description:
    "Ruang virtual 2D multiplayer: jalan-jalan dengan karakter, ngobrol lewat bubble chat di atas kepala, dan bertemu pengunjung lain secara realtime.",
  alternates: { canonical: "/ruang" },
};

export default function RuangPage() {
  return (
    <div className="mx-auto max-w-6xl px-5 py-12">
      <section className="mb-8 max-w-2xl">
        <p className="mb-3 text-sm font-medium text-signal-400">Ruang virtual</p>
        <h1 className="font-display text-3xl font-semibold leading-tight text-white sm:text-4xl">
          Ngobrol bareng di ruang virtual.
        </h1>
        <p className="mt-3 text-white/60">
          Pilih nama dan karakter, lalu jalan-jalan di ruangan. Pengunjung lain yang sedang online muncul langsung, dan
          pesanmu tampil sebagai bubble chat di atas kepala karakter.
        </p>
      </section>

      <VirtualRoom />
    </div>
  );
}
