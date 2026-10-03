"use client";

import { useState } from "react";
import { Heart, MessageCircle, QrCode, ExternalLink, Download, Copy, Check } from "lucide-react";
import { SAWERIA_URL, SAWERIA_READY, QRIS_IMAGE, DANA_NUMBER, DANA_NAME } from "@/lib/support";

const OPTIONS = [
  {
    id: "saweria",
    title: "Lewat Saweria",
    desc: "Bisa sekalian kirim pesan dukungan.",
    icon: MessageCircle,
  },
  {
    id: "qris",
    title: "QRIS DANA",
    desc: "Langsung ke DANA tanpa perantara.",
    icon: QrCode,
  },
];

export default function SupportSection() {
  const [active, setActive] = useState("saweria");
  const [copied, setCopied] = useState(false);
  const [qrisFailed, setQrisFailed] = useState(false);

  async function copyNumber() {
    try {
      await navigator.clipboard.writeText(DANA_NUMBER);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* izin clipboard ditolak, pengguna bisa menyalin manual */
    }
  }

  return (
    <div className="max-w-xl">
      <div className="grid grid-cols-2 gap-3">
        {OPTIONS.map(({ id, title, desc, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => setActive(id)}
            aria-pressed={active === id}
            className={`rounded-2xl border p-4 text-left transition-colors ${
              active === id
                ? "border-signal-500 bg-signal-500/10"
                : "border-white/10 bg-ink-900/60 hover:bg-white/5"
            }`}
          >
            <Icon size={22} className={active === id ? "text-signal-400" : "text-white/60"} />
            <p className="mt-3 text-sm font-semibold text-white">{title}</p>
            <p className="mt-1 text-xs leading-relaxed text-white/55">{desc}</p>
          </button>
        ))}
      </div>

      <div className="mt-4 rounded-2xl border border-white/10 bg-ink-900/60 p-5">
        {active === "saweria" ? (
          <>
            <h2 className="flex items-center gap-2 font-display text-lg font-semibold text-white">
              <Heart size={18} className="text-signal-400" /> Dukung lewat Saweria
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-white/60">
              Kamu akan dibuka ke halaman Saweria. Di sana kamu bisa memilih nominal, menulis pesan
              dukungan, lalu membayar dengan QRIS atau e-wallet pilihanmu.
            </p>
            {SAWERIA_READY ? (
              <a
                href={SAWERIA_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-signal-500 px-6 py-3 text-sm font-semibold text-ink-950"
              >
                Buka Saweria <ExternalLink size={16} />
              </a>
            ) : (
              <button
                type="button"
                disabled
                className="mt-4 w-full rounded-xl bg-signal-500 px-6 py-3 text-sm font-semibold text-ink-950 opacity-50"
              >
                Segera hadir
              </button>
            )}
          </>
        ) : (
          <>
            <h2 className="flex items-center gap-2 font-display text-lg font-semibold text-white">
              <QrCode size={18} className="text-signal-400" /> Dukung lewat QRIS
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-white/60">
              Pindai QRIS di bawah dengan aplikasi e-wallet atau mobile banking apa pun. Lewat QRIS
              tidak ada kolom pesan. Kalau mau sekalian kirim pesan, pilih Saweria.
            </p>

            {qrisFailed ? (
              <p className="mt-4 rounded-xl border border-white/10 px-4 py-6 text-center text-sm text-white/50">
                Gambar QRIS belum tersedia.
              </p>
            ) : (
              <div className="mt-4 flex justify-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={QRIS_IMAGE}
                  alt="QRIS KOYEN"
                  onError={() => setQrisFailed(true)}
                  className="w-full max-w-[280px] rounded-xl bg-white p-2"
                />
              </div>
            )}

            {!qrisFailed && (
              <a
                href={QRIS_IMAGE}
                download="QRIS-KOYEN.png"
                className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-signal-500 px-6 py-3 text-sm font-semibold text-ink-950"
              >
                <Download size={16} /> Unduh QRIS
              </a>
            )}
            <p className="mt-3 text-xs leading-relaxed text-white/45">
              Di HP, simpan gambar ini lalu unggah dari galeri lewat fitur &quot;Scan dari galeri&quot; di
              aplikasi e-wallet kamu.
            </p>

            {DANA_NUMBER && (
              <div className="mt-4 flex items-center justify-between gap-3 rounded-xl border border-white/10 px-4 py-3">
                <div className="min-w-0">
                  <p className="text-xs text-white/45">DANA{DANA_NAME ? ` · ${DANA_NAME}` : ""}</p>
                  <p className="truncate font-mono text-sm text-white">{DANA_NUMBER}</p>
                </div>
                <button
                  type="button"
                  onClick={copyNumber}
                  className="flex shrink-0 items-center gap-1.5 rounded-lg border border-white/15 px-3 py-2 text-xs font-medium text-white hover:bg-white/10"
                >
                  {copied ? <Check size={14} /> : <Copy size={14} />}
                  {copied ? "Tersalin" : "Salin"}
                </button>
              </div>
            )}
          </>
        )}
      </div>

      <p className="mt-4 text-center text-xs text-white/40">
        Terima kasih sudah mendukung KOYEN tetap gratis dan berkembang.
      </p>
    </div>
  );
}
