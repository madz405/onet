"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Menu, X, Download, Wand2, Music2, Bot, Heart, Mail } from "lucide-react";
import ThemeSwitcher from "@/components/ThemeSwitcher";
import { SITE_NAME, SITE_LOGO } from "@/lib/site";

const LINKS = [
  { href: "/", label: "Downloader", icon: Download },
  { href: "/tools", label: "Tools", icon: Wand2 },
  { href: "/musik", label: "Musik", icon: Music2 },
  { href: "/tempmail", label: "Temp Mail", icon: Mail },
  { href: "/chat", label: "Chat AI", icon: Bot },
  { href: "/dukungan", label: "Dukungan", icon: Heart },
];

export default function Navbar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  // Sidebar terbuka: Esc menutup, scroll halaman dikunci, dan otomatis menutup
  // kalau layar melebar ke ukuran desktop (menu desktop sudah tampil sendiri).
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === "Escape" && setOpen(false);
    const onResize = () => window.innerWidth >= 768 && setOpen(false);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    window.addEventListener("resize", onResize);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", onResize);
    };
  }, [open]);

  return (
    <>
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
            onClick={() => setOpen(true)}
            aria-label="Buka menu"
            aria-expanded={open}
            aria-controls="sidebar-menu"
          >
            <Menu size={20} />
          </button>
        </div>
      </div>
    </header>

    {/* Sidebar kanan (mobile). Sengaja DI LUAR <header>: header memakai
        backdrop-filter, dan elemen "fixed" di dalamnya jadi ikut terpotong
        ke area header, bukan ke layar. Selalu dirender (bukan {open && ...})
        supaya animasi geser saat menutup tetap jalan. */}
    <div className="md:hidden">
      <button
        type="button"
        tabIndex={-1}
        aria-hidden="true"
        onClick={() => setOpen(false)}
        className={`fixed inset-0 z-50 cursor-default bg-black/50 transition-opacity duration-300 ${
          open ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      />

      <aside
        id="sidebar-menu"
        role="dialog"
        aria-modal="true"
        aria-label="Menu navigasi"
        aria-hidden={!open}
        className={`glass-surface-solid glass-menu fixed right-0 top-0 z-50 flex h-dvh w-72 max-w-[85vw] flex-col border-l border-white/10 bg-ink-950 shadow-glow transition-[transform,visibility] duration-300 ease-out ${
          open ? "visible translate-x-0" : "invisible translate-x-full"
        }`}
      >
        <div className="flex h-16 shrink-0 items-center justify-between border-b border-white/10 px-5">
          <span className="font-display text-lg font-semibold text-white">Menu</span>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Tutup menu"
            className="grid h-9 w-9 place-items-center rounded-lg text-white/80 hover:bg-white/5 focus-ring"
          >
            <X size={20} />
          </button>
        </div>

        <nav className="flex flex-1 flex-col gap-1 overflow-y-auto p-3">
          {LINKS.map(({ href, label, icon: Icon }, i) => {
            const active = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                onClick={() => setOpen(false)}
                tabIndex={open ? 0 : -1}
                style={{ "--i": i }}
                className={`flex items-center gap-3 rounded-xl px-3 py-3 text-base font-medium focus-ring ${
                  active ? "bg-white/10 text-white" : "text-white/80 hover:bg-white/5"
                } ${open ? "drawer-item-in" : "opacity-0"}`}
              >
                <Icon size={20} />
                {label}
              </Link>
            );
          })}
        </nav>
      </aside>
    </div>
    </>
  );
}
