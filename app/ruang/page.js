import PageIntro from "@/components/PageIntro";
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
    <div className="mx-auto max-w-6xl px-5 pb-12 pt-6 sm:pt-10">
      <PageIntro eyebrow="Ruang virtual" title="Ngobrol bareng di ruang virtual." accent="signal">
        Pilih nama dan karakter, lalu jalan-jalan di ruangan. Pengunjung lain yang sedang online muncul langsung, dan pesanmu tampil sebagai bubble chat di atas kepala karakter.
      </PageIntro>

      <VirtualRoom />
    </div>
  );
}
