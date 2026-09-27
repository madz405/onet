import Link from "next/link";
import Image from "next/image";
import { User, Mail, Instagram } from "lucide-react";
import { SITE_NAME, SITE_LOGO } from "@/lib/site";

export default function Footer() {
  return (
    <footer className="border-t border-white/8 bg-ink-950">
      <div className="mx-auto max-w-6xl px-5 py-10">
        <div className="grid gap-8 sm:grid-cols-3">
          <div>
            <p className="flex items-center gap-2 font-display text-lg font-semibold text-white">
              <Image src={SITE_LOGO} alt={SITE_NAME} width={28} height={28} className="h-7 w-7 rounded-lg object-cover" />
              {SITE_NAME}
            </p>
            <p className="mt-3 max-w-xs text-sm leading-relaxed text-white/50">
              Download video &amp; foto dari berbagai sosial media, tools edit cepat, dan pemutar musik
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
            <p className="mb-3 text-sm font-semibold text-white">Developer</p>
            <ul className="space-y-2 text-sm text-white/50">
              <li className="flex items-center gap-2">
                <User size={14} className="flex-shrink-0" />
                A. muldi
              </li>
              <li className="flex items-center gap-2">
                <Mail size={14} className="flex-shrink-0" />
                <a href="mailto:madz@goatmail.uk" className="hover:text-white">
                  madz@goatmail.uk
                </a>
              </li>
              <li className="flex items-center gap-2">
                <Instagram size={14} className="flex-shrink-0" />
                <a
                  href="https://www.instagram.com/madzmuldi_"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-white"
                >
                  @madzmuldi_
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-8 flex flex-col gap-2 border-t border-white/8 pt-6 text-xs text-white/35 sm:flex-row sm:items-center sm:justify-between">
          <p>&copy; {new Date().getFullYear()} {SITE_NAME}. All right reserved by madz.</p>
          <p></p>
        </div>
      </div>
    </footer>
  );
}
