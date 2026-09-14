"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Menu, X, Download, Wand2, Music2, Bot } from "lucide-react";
import ThemeSwitcher from "@/components/ThemeSwitcher";
import { SITE_NAME, SITE_LOGO } from "@/lib/site";

const LINKS = [
  { href: "/", label: "Downloader", icon: Download },
  { href: "/tools", label: "Tools", icon: Wand2 },
  { href: "/musik", label: "Musik", icon: Music2 },
  { href: "/chat", label: "Chat AI", icon: Bot },
];

export default function Navbar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-white/5 bg-ink-950/80 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5">
        <Link href="/" className="flex items-center gap-2 font-display text-lg font-semibold tracking-tight text-white">
          <Image src={SITE_LOGO} alt={SITE_NAME} width={32} height={32} className="h-8 w-8 rounded-lg object-cover" />
          {SITE_NAME}
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          {LINKS.map(({ href, label, icon: Icon }) => {
            const active = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-colors focus-ring ${
                  active
                    ? "bg-white/10 text-white"
                    : "text-white/60 hover:text-white hover:bg-white/5"
                }`}
              >
                <Icon size={16} />
                {label}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-1.5">
          <ThemeSwitcher />
          <button
            className="grid h-9 w-9 place-items-center rounded-lg text-white/80 hover:bg-white/5 md:hidden focus-ring"
            onClick={() => setOpen((v) => !v)}
            aria-label="Buka menu"
          >
            {open ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>

      {open && (
        <nav className="flex flex-col gap-1 border-t border-white/5 px-5 py-3 md:hidden">
          {LINKS.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              onClick={() => setOpen(false)}
              className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-white/80 hover:bg-white/5"
            >
              <Icon size={18} />
              {label}
            </Link>
          ))}
        </nav>
      )}
    </header>
  );
}
