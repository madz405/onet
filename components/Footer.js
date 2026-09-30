import Link from "next/link";
import Image from "next/image";
import { User, Mail, Instagram } from "lucide-react";
import { SITE_NAME, SITE_LOGO, WHATSAPP_CHANNEL_URL } from "@/lib/site";

// Logo WhatsApp (lucide-react tidak punya ikon brand ini, jadi pakai SVG sendiri).
// Ukuran & warna mengikuti ikon lain di footer (size + currentColor).
function WhatsAppIcon({ size = 14, className = "" }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-hidden="true"
    >
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
    </svg>
  );
}

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
            <p className="mb-3 text-sm font-semibold text-white">Information</p>
            <ul className="space-y-2 text-sm text-white/50">
              <li className="flex items-center gap-2">
                <User size={14} className="flex-shrink-0" />
                A. muldi • vibecoder
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
              <li className="flex items-center gap-2">
                <WhatsAppIcon size={14} className="flex-shrink-0" />
                <a
                  href={WHATSAPP_CHANNEL_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-white"
                >
                  {SITE_NAME} WEB
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
