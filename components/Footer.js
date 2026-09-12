import Link from "next/link";

export default function Footer() {
  return (
    <footer className="border-t border-white/8 bg-ink-950">
      <div className="mx-auto max-w-6xl px-5 py-10">
        <div className="grid gap-8 sm:grid-cols-3">
          <div>
            <p className="flex items-center gap-2 font-display text-lg font-semibold text-white">
              <span className="grid h-7 w-7 place-items-center rounded-lg bg-signal-500 text-sm text-ink-950">
                U
              </span>
              Unduhin
            </p>
            <p className="mt-3 max-w-xs text-sm leading-relaxed text-white/50">
              Download video &amp; foto dari berbagai sosial media, tools edit cepat, dan pemutar musik —
              semua dalam satu tempat.
            </p>
          </div>

          <div>
            <p className="mb-3 text-sm font-semibold text-white">Navigasi</p>
            <ul className="space-y-2 text-sm text-white/50">
              <li>
                <Link href="/" className="hover:text-white">
                  Downloader
                </Link>
              </li>
              <li>
                <Link href="/tools" className="hover:text-white">
                  Tools
                </Link>
              </li>
              <li>
                <Link href="/musik" className="hover:text-white">
                  Musik
                </Link>
              </li>
              <li>
                <Link href="/chat" className="hover:text-white">
                  Chat AI
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <p className="mb-3 text-sm font-semibold text-white">Catatan</p>
            <p className="text-sm leading-relaxed text-white/50">
              Semua proses download memakai layanan pihak ketiga dan disediakan untuk keperluan pribadi.
              Hormati hak cipta pemilik konten asli sebelum membagikan ulang hasil unduhan.
            </p>
          </div>
        </div>

        <div className="mt-8 flex flex-col gap-2 border-t border-white/8 pt-6 text-xs text-white/35 sm:flex-row sm:items-center sm:justify-between">
          <p>&copy; {new Date().getFullYear()} Unduhin. Dibuat untuk penggunaan pribadi.</p>
          <p>Dibangun dengan Next.js</p>
        </div>
      </div>
    </footer>
  );
}
