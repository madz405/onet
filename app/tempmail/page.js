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
    <div className="mx-auto max-w-6xl px-5 py-12">
      <section className="mb-10 max-w-2xl">
        <p className="mb-3 text-sm font-medium text-signal-400">Email sementara</p>
        <h1 className="font-display text-3xl font-semibold leading-tight text-white sm:text-4xl">
          Terima OTP tanpa pakai email asli.
        </h1>
        <p className="mt-3 text-white/60">
          Buat alamat email sementara, pakai untuk daftar atau verifikasi akun, lalu baca pesannya di sini. Alamat dan
          pesanmu tetap ada walau halaman di-refresh.
        </p>
      </section>

      <TempMailSection />
    </div>
  );
}
