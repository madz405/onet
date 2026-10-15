import LegalPage, { LegalGroup, LegalSection } from "@/components/LegalPage";
import { SITE_NAME } from "@/lib/site";

export const metadata = {
  title: `Privasi & Syarat Layanan ${SITE_NAME}`,
  description: `Kebijakan privasi dan syarat layanan ${SITE_NAME}: data apa yang diproses, aturan pemakaian, dan cara menghubungi kami.`,
  alternates: { canonical: "/kebijakan" },
};

const CONTACT = "koyen@goatmail.uk";

const Mail = () => (
  <a href={`mailto:${CONTACT}`} className="text-signal-400 underline">
    {CONTACT}
  </a>
);

export default function PolicyPage() {
  return (
    <LegalPage
      title="Privasi & Syarat Layanan"
      updated="14 Oktober 2026"
      intro={`${SITE_NAME} (koyen.web.id) adalah kumpulan alat download, tools, musik, dan chat AI yang dikelola secara pribadi. Halaman ini memuat kebijakan privasi dan syarat layanannya. Semua fitur bisa dipakai tanpa membuat akun.`}
    >
      <p className="mt-4 text-sm text-white/50">
        Langsung ke:{" "}
        <a href="#privasi" className="text-signal-400 underline">
          Kebijakan Privasi
        </a>{" "}
        ·{" "}
        <a href="#syarat" className="text-signal-400 underline">
          Syarat Layanan
        </a>{" "}
        ·{" "}
        <a href="#kontak" className="text-signal-400 underline">
          Kontak
        </a>
      </p>

      {/* ---------- PRIVASI ---------- */}
      <LegalGroup id="privasi" title="Kebijakan Privasi">
        <LegalSection title="1. Data yang kami proses">
          <p>
            <strong className="text-white">Downloader dan tools.</strong> Link, teks, atau gambar yang kamu masukkan
            dipakai hanya untuk memproses permintaanmu. Untuk beberapa tools, gambar diunggah sementara ke layanan
            hosting gambar pihak ketiga, lalu dikirim ke layanan pemrosesan pihak ketiga untuk menghasilkan hasilnya.
            Kami tidak membuat arsip pribadi dari file-mu, tetapi layanan pihak ketiga tersebut punya kebijakan mereka
            sendiri.
          </p>
          <p>
            <strong className="text-white">Data di perangkatmu.</strong> Pengaturan tema, riwayat pemutar musik,
            playlist, dan email sementara disimpan di penyimpanan browser (localStorage) perangkatmu sendiri, bukan di
            server kami. Menghapus data browser akan menghapusnya.
          </p>
          <p>
            <strong className="text-white">Log teknis dan laporan error.</strong> Platform hosting mencatat log teknis
            standar (misalnya waktu dan jenis permintaan). Saat sebuah fitur gagal, sistem dapat mengirim laporan error
            ke pengelola berisi nama fitur, pesan error, dan tautan yang diproses, tanpa data identitas akun.
          </p>
          <p>
            <strong className="text-white">Verifikasi anti-bot.</strong> Sebagian tools memakai Cloudflare Turnstile
            untuk membedakan manusia dari bot. Cloudflare dapat memproses data teknis browser untuk tujuan itu.
          </p>
        </LegalSection>

        <LegalSection title="2. Layanan pihak ketiga">
          <p>
            Kami memakai layanan berikut untuk menjalankan situs: Vercel (hosting), Cloudflare (Turnstile), Telegram
            (penerimaan laporan error), serta berbagai layanan sumber dan pemrosesan media. Masing-masing memiliki
            kebijakan privasinya sendiri.
          </p>
        </LegalSection>

        <LegalSection title="3. Tujuan penggunaan data">
          <p>
            Data dipakai hanya untuk menjalankan fitur yang kamu minta, menjaga keamanan dan mencegah penyalahgunaan,
            serta memperbaiki gangguan. Kami tidak menjual data pribadimu dan tidak memakainya untuk iklan.
          </p>
        </LegalSection>

        <LegalSection title="4. Berapa lama data disimpan">
          <p>Kami tidak menyimpan akun atau profil pengguna. Data di browser tersimpan sampai kamu menghapusnya.</p>
        </LegalSection>

        <LegalSection title="5. Hakmu">
          <p>
            Kalau kamu punya pertanyaan atau permintaan terkait datamu, hubungi kami di <Mail />.
          </p>
        </LegalSection>

        <LegalSection title="6. Anak-anak">
          <p>Layanan ini tidak ditujukan untuk anak di bawah 13 tahun, dan kami tidak dengan sengaja mengumpulkan datanya.</p>
        </LegalSection>

        <LegalSection title="7. Perubahan kebijakan">
          <p>Kebijakan ini dapat diperbarui. Tanggal pembaruan terakhir tertera di bagian atas halaman.</p>
        </LegalSection>
      </LegalGroup>

      {/* ---------- SYARAT ---------- */}
      <LegalGroup id="syarat" title="Syarat Layanan">
        <p className="mt-3 text-sm leading-relaxed text-white/70">
          Dengan memakai {SITE_NAME}, kamu menyetujui syarat berikut. Kalau tidak setuju, mohon berhenti memakai layanan
          ini.
        </p>

        <LegalSection title="1. Layanan">
          <p>
            {SITE_NAME} menyediakan alat download media, tools edit, pemutar musik, dan chat AI. Layanan diberikan
            apa adanya, gratis, dan dapat berubah, terganggu, atau dihentikan sewaktu-waktu tanpa pemberitahuan. Banyak
            fitur bergantung pada layanan pihak ketiga yang di luar kendali kami.
          </p>
        </LegalSection>

        <LegalSection title="2. Pemakaian yang wajar">
          <p>Kamu setuju untuk tidak:</p>
          <ul className="list-disc space-y-1 pl-5">
            <li>menyalahgunakan layanan untuk spam, membanjiri permintaan, atau mengganggu kerja sistem;</li>
            <li>mencoba menembus pengamanan atau mengakses data pengguna lain;</li>
            <li>memasukkan konten yang melanggar hukum, mengandung pelecehan, ujaran kebencian, ancaman, atau eksploitasi;</li>
            <li>menggunakan hasil layanan untuk tujuan yang merugikan atau menipu pihak lain.</li>
          </ul>
        </LegalSection>

        <LegalSection title="3. Konten dan hak cipta">
          <p>
            Kamu bertanggung jawab atas link dan file yang kamu masukkan, serta memastikan punya hak atau izin untuk
            mengunduh, menyimpan, dan memakai konten tersebut. Hak atas media tetap milik pemiliknya masing-masing, dan{" "}
            {SITE_NAME} tidak memiliki konten yang diproses lewat layanan ini. Pemilik hak yang merasa dirugikan dapat
            menghubungi kami untuk permintaan penghapusan.
          </p>
        </LegalSection>

        <LegalSection title="4. Tanpa jaminan dan batasan tanggung jawab">
          <p>
            Layanan disediakan tanpa jaminan apa pun, termasuk ketersediaan, ketepatan hasil, atau kecocokan untuk tujuan
            tertentu. Sejauh diizinkan hukum, pengelola tidak bertanggung jawab atas kerugian yang timbul dari pemakaian
            layanan, hilangnya data, atau gangguan layanan pihak ketiga.
          </p>
        </LegalSection>

        <LegalSection title="5. Privasi">
          <p>
            Pemrosesan data dijelaskan di bagian{" "}
            <a href="#privasi" className="text-signal-400 underline">
              Kebijakan Privasi
            </a>{" "}
            di atas.
          </p>
        </LegalSection>

        <LegalSection title="6. Perubahan syarat">
          <p>
            Syarat ini dapat diperbarui sewaktu-waktu. Dengan terus memakai layanan setelah perubahan, kamu dianggap
            menyetujui syarat yang baru.
          </p>
        </LegalSection>
      </LegalGroup>

      {/* ---------- KONTAK ---------- */}
      <LegalGroup id="kontak" title="Kontak">
        <p className="mt-3 text-sm leading-relaxed text-white/70">
          Pertanyaan soal privasi, syarat layanan, atau permintaan penghapusan konten: <Mail />.
        </p>
      </LegalGroup>
    </LegalPage>
  );
}
