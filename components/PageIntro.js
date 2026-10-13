"use client";

// Kotak pembuka halaman yang ringkas: hanya label + judul, dan keterangan
// lengkapnya muncul kalau kotaknya diketuk (mirip daftar fitur di ChannelPromo).
// Dipakai di semua halaman supaya bagian atas tidak memakan banyak ruang.
//
// Judul tetap berupa <h1> (penting untuk SEO & pembaca layar). Tombol buka/tutup
// berupa lapisan tak terlihat di atas baris judul, jadi struktur heading tidak
// terganggu. Teks keterangan tetap ada di HTML walau sedang tertutup.

import { useId, useState } from "react";
import { ChevronDown } from "lucide-react";

const ACCENT = {
  signal: "text-signal-400",
  flare: "text-flare-400",
};

export default function PageIntro({ eyebrow, title, accent = "signal", defaultOpen = false, children }) {
  const [open, setOpen] = useState(defaultOpen);
  const panelId = useId();

  return (
    <section className="mb-6 max-w-2xl">
      <div className="rounded-2xl border border-white/10 bg-ink-900/60">
        <div className="relative">
          <div className="flex items-center gap-3 px-4 py-3">
            <div className="min-w-0 flex-1">
              {eyebrow && <p className={`text-xs font-medium ${ACCENT[accent] || ACCENT.signal}`}>{eyebrow}</p>}
              <h1 className="font-display text-lg font-semibold leading-snug text-white sm:text-xl">{title}</h1>
            </div>
            <ChevronDown
              size={18}
              aria-hidden="true"
              className={`flex-shrink-0 text-white/50 transition-transform duration-300 ${open ? "rotate-180" : ""}`}
            />
          </div>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-controls={panelId}
            aria-label={open ? "Sembunyikan keterangan halaman" : "Tampilkan keterangan halaman"}
            className="absolute inset-0 h-full w-full rounded-2xl focus-ring"
          />
        </div>

        <div
          id={panelId}
          aria-hidden={!open}
          className={`grid transition-[grid-template-rows] duration-300 ease-out ${
            open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
          }`}
        >
          <div className="overflow-hidden">
            <div className="border-t border-white/10 px-4 py-3 text-sm leading-relaxed text-white/60">{children}</div>
          </div>
        </div>
      </div>
    </section>
  );
}
