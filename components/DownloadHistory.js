"use client";

import { useEffect, useState } from "react";
import { Download, X, Trash2, History } from "lucide-react";
import { getPlatform } from "@/lib/platforms";
import {
  loadDownloadHistory,
  removeDownloadHistory,
  clearDownloadHistory,
  subscribeDownloadHistory,
} from "@/lib/downloadHistory";

const KINDS = ["Video", "Audio", "Foto"];

function pad(n) {
  return String(n).padStart(2, "0");
}

function formatTime(ts) {
  const now = new Date();
  const d = new Date(ts);
  const diffMin = Math.floor((now - d) / 60000);
  if (diffMin < 1) return "Baru saja";
  if (diffMin < 60) return `${diffMin} menit lalu`;
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (d >= startOfToday) return `Hari ini, ${pad(d.getHours())}.${pad(d.getMinutes())}`;
  const dayDiff = Math.round((startOfToday - new Date(d.getFullYear(), d.getMonth(), d.getDate())) / 86400000);
  if (dayDiff === 1) return "Kemarin";
  if (dayDiff < 30) return `${dayDiff} hari lalu`;
  return d.toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
}

function hostOf(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function PlatformLogo({ platform }) {
  const [failed, setFailed] = useState(false);
  if (!platform) return <span className="h-9 w-9 shrink-0 rounded-lg bg-white/10" />;
  return (
    <span
      className="grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-lg text-xs font-bold text-ink-950"
      style={{ backgroundColor: platform.accent }}
    >
      {platform.logo && !failed ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={platform.logo}
          alt={platform.name}
          className="h-full w-full object-cover"
          onError={() => setFailed(true)}
        />
      ) : (
        platform.mono
      )}
    </span>
  );
}

export default function DownloadHistory({ onReprocess }) {
  const [list, setList] = useState([]);
  const [filter, setFilter] = useState("Semua");
  const [confirmClear, setConfirmClear] = useState(false);

  useEffect(() => {
    const sync = () => setList(loadDownloadHistory());
    sync();
    return subscribeDownloadHistory(sync);
  }, []);

  // Tombol "Hapus semua" meminta konfirmasi sekali tekan lagi (3 detik).
  useEffect(() => {
    if (!confirmClear) return;
    const t = setTimeout(() => setConfirmClear(false), 3000);
    return () => clearTimeout(t);
  }, [confirmClear]);

  if (list.length === 0) return null;

  const kindsPresent = KINDS.filter((k) => list.some((h) => h.kind === k));
  const activeFilter = filter === "Semua" || kindsPresent.includes(filter) ? filter : "Semua";
  const rows = activeFilter === "Semua" ? list : list.filter((h) => h.kind === activeFilter);

  return (
    <section className="mt-10" aria-label="Riwayat unduhan">
      <div className="rounded-2xl border border-white/10 bg-ink-900/60 p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 font-display text-lg font-semibold text-white">
              <History size={18} aria-hidden="true" /> Riwayat unduhan
            </h2>
            <p className="mt-0.5 text-xs text-white/50">{list.length} unduhan</p>
          </div>
          <button
            type="button"
            onClick={() => {
              if (confirmClear) {
                clearDownloadHistory();
                setConfirmClear(false);
              } else {
                setConfirmClear(true);
              }
            }}
            className={`flex shrink-0 items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium ${
              confirmClear
                ? "border-flare-500 bg-flare-500/10 text-flare-400"
                : "border-white/15 text-white/60 hover:bg-white/10"
            }`}
          >
            <Trash2 size={14} aria-hidden="true" />
            {confirmClear ? "Ya, hapus semua" : "Hapus semua"}
          </button>
        </div>

        {kindsPresent.length > 1 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {["Semua", ...kindsPresent].map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => setFilter(k)}
                aria-pressed={activeFilter === k}
                className={`rounded-lg border px-3 py-1.5 text-xs font-medium ${
                  activeFilter === k
                    ? "border-signal-500 bg-signal-500/10 text-signal-400"
                    : "border-white/10 text-white/60 hover:bg-white/5"
                }`}
              >
                {k}
              </button>
            ))}
          </div>
        )}

        <ul className="mt-3">
          {rows.map((h) => {
            const platform = getPlatform(h.platform);
            return (
              <li key={h.id} className="flex items-center gap-3 border-t border-white/10 py-3">
                <PlatformLogo platform={platform} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-white">{h.title || hostOf(h.url)}</p>
                  <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-xs text-white/50">
                    <span className="rounded-md bg-signal-500/10 px-1.5 py-0.5 font-medium text-signal-400">
                      {h.kind}
                    </span>
                    <span>
                      {platform?.name || h.platform} · {formatTime(h.at)}
                    </span>
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onReprocess?.(h)}
                  aria-label={`Unduh lagi: ${h.title || hostOf(h.url)}`}
                  className="grid h-10 w-10 shrink-0 place-items-center rounded-lg border border-white/15 text-white hover:bg-white/10"
                >
                  <Download size={16} aria-hidden="true" />
                </button>
                <button
                  type="button"
                  onClick={() => removeDownloadHistory(h.id)}
                  aria-label="Hapus dari riwayat"
                  className="grid h-10 w-10 shrink-0 place-items-center rounded-lg text-white/60 hover:bg-white/10"
                >
                  <X size={16} aria-hidden="true" />
                </button>
              </li>
            );
          })}
        </ul>

        <p className="mt-2 text-xs text-white/40">Tersimpan di browser ini, tidak dikirim ke server.</p>
      </div>
    </section>
  );
}
