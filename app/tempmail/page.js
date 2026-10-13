import PageIntro from "@/components/PageIntro";
import TempMailSection from "@/components/TempMailSection";
import { SITE_NAME } from "@/lib/site";

export const metadata = {
  title: `Temp Mail — ${SITE_NAME}`,
  description:
    "Buat email sementara gratis untuk menerima kode OTP dan verifikasi akun. Nama email bebas atau acak, pesan tersimpan di browser.",
  alternates: { canonical: "/tempmail" },
};

export default function TempMailPage() {
  return (
    <div className="mx-auto max-w-6xl px-5 pb-12 pt-6 sm:pt-10">
      <PageIntro eyebrow="Email sementara" title="Terima OTP tanpa pakai email asli." accent="signal">
        Buat alamat email sementara, pakai untuk daftar atau verifikasi akun, lalu baca pesannya di sini. Alamat dan pesanmu tetap ada walau halaman di-refresh.
      </PageIntro>

      <TempMailSection />
    </div>
  );
}
