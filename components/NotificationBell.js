"use client";

// Ikon lonceng di navbar: info update / perbaikan / pengumuman web.
// Daftar info diambil dari /api/notifikasi (lihat app/api/notifikasi/route.js).
// Info yang sudah dibuka dicatat di localStorage perangkat; titik merah di lonceng
// menampilkan jumlah info yang BELUM pernah dibuka (1, 2, ... "9+").

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Bell, Info, Loader2, Sparkles, Wrench, X, ExternalLink } from "lucide-react";
import useBackToClose from "@/lib/useBackToClose";

const READ_KEY = "koyen-notif-read";
const POLL_MS = 5 * 60 * 1000;
const MIN_GAP_MS = 60 * 1000;

const TYPE_META = {
  info: { label: "Info", icon: Info, color: "text-white/70" },
  update: { label: "Update", icon: Sparkles, color: "text-signal-400" },
  maintenance: { label: "Perbaikan", icon: Wrench, color: "text-flare-400" },
};

function loadRead() {
  try {
    const arr = JSON.parse(window.localStorage.getItem(READ_KEY) || "[]");
    return new Set(Array.isArray(arr) ? arr.filter((x) => typeof x === "string") : []);
  } catch {
    return new Set();
  }
}

function saveRead(set) {
  try {
    window.localStorage.setItem(READ_KEY, JSON.stringify([...set].slice(-200)));
  } catch {
    // localStorage diblokir — abaikan
  }
}

function formatDate(iso) {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
  } catch {
    return "";
  }
}

export default function NotificationBell() {
  const [mounted, setMounted] = useState(false);
  const [items, setItems] = useState([]);
  const [state, setState] = useState("loading"); // loading | ok | error
  const [read, setRead] = useState(() => new Set());
  const [open, setOpen] = useState(false);
  const [freshIds, setFreshIds] = useState(() => new Set()); // yang baru saat panel dibuka
  const lastLoad = useRef(0);

  const load = useCallback(async () => {
    lastLoad.current = Date.now();
    try {
      const res = await fetch("/api/notifikasi", { cache: "no-store" });
      const data = await res.json();
      if (!data?.status || !Array.isArray(data.items)) throw new Error("gagal");
      setItems(data.items);
      setState("ok");
    } catch {
      setState((s) => (s === "ok" ? s : "error"));
    }
  }, []);

  useEffect(() => {
    setMounted(true);
    setRead(loadRead());
    load();
    const timer = setInterval(load, POLL_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible" && Date.now() - lastLoad.current > MIN_GAP_MS) load();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [load]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  // Tombol BACK di HP menutup panel dulu.
  useBackToClose(open, () => setOpen(false));

  const unread = items.filter((i) => !read.has(i.id)).length;

  function openPanel() {
    if (open) {
      setOpen(false);
      return;
    }
    // Yang belum dibaca ditandai "Baru" selama panel terbuka, lalu dianggap sudah dibaca.
    const current = loadRead();
    setFreshIds(new Set(items.filter((i) => !current.has(i.id)).map((i) => i.id)));
    items.forEach((i) => current.add(i.id));
    saveRead(current);
    setRead(current);
    setOpen(true);
    if (Date.now() - lastLoad.current > MIN_GAP_MS) load();
  }

  const panel = (
    <>
      <button
        type="button"
        aria-hidden="true"
        tabIndex={-1}
        onClick={() => setOpen(false)}
        className="fixed inset-0 z-50 cursor-default"
      />
      <div
        role="dialog"
        aria-label="Notifikasi"
        className="glass-surface-solid glass-menu fixed inset-x-3 top-[72px] z-[51] flex max-h-[calc(100dvh-88px)] animate-rise flex-col overflow-hidden rounded-xl border border-white/10 bg-ink-900 shadow-glow md:inset-x-auto md:right-6 md:w-[26rem]"
      >
        <div className="flex shrink-0 items-center justify-between border-b border-white/10 px-4 py-3">
          <p className="font-display text-base font-semibold text-white">Notifikasi</p>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Tutup notifikasi"
            className="grid h-8 w-8 place-items-center rounded-lg text-white/60 hover:bg-white/5 hover:text-white focus-ring"
          >
            <X size={18} />
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-3">
          {state === "loading" && (
            <p className="flex items-center justify-center gap-2 py-8 text-sm text-white/60">
              <Loader2 size={16} className="animate-spin" />
              Memuat...
            </p>
          )}

          {state === "error" && (
            <div className="flex flex-col items-center gap-3 py-8 text-center">
              <p className="text-sm text-white/70">Gagal memuat notifikasi.</p>
              <button
                type="button"
                onClick={() => {
                  setState("loading");
                  load();
                }}
                className="rounded-full bg-signal-500 px-5 py-2 text-sm font-semibold text-ink-950"
              >
                Coba lagi
              </button>
            </div>
          )}

          {state === "ok" && items.length === 0 && (
            <p className="py-8 text-center text-sm text-white/60">Belum ada informasi.</p>
          )}

          {state === "ok" &&
            items.map((it) => {
              const meta = TYPE_META[it.type] || TYPE_META.info;
              const Icon = meta.icon;
              return (
                <article key={it.id} className="rounded-xl border border-white/10 bg-white/5 p-3">
                  <div className="flex items-start gap-3">
                    <span className={`mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-white/10 ${meta.color}`}>
                      <Icon size={16} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-white/50">
                        <span className={`font-semibold uppercase tracking-wide ${meta.color}`}>{meta.label}</span>
                        {it.date && <span>{formatDate(it.date)}</span>}
                        {freshIds.has(it.id) && (
                          <span
                            className="rounded-full px-1.5 py-px text-[10px] font-bold"
                            style={{ background: "#ef4444", color: "#fff" }}
                          >
                            Baru
                          </span>
                        )}
                      </div>
                      <h3 className="mt-0.5 text-sm font-semibold text-white">{it.title}</h3>
                      {it.body && <p className="mt-1 whitespace-pre-line break-words text-sm text-white/60">{it.body}</p>}
                      {it.url && (
                        <a
                          href={it.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-signal-500 px-3 py-1.5 text-xs font-semibold text-ink-950"
                        >
                          <ExternalLink size={13} />
                          {it.linkLabel}
                        </a>
                      )}
                    </div>
                  </div>
                </article>
              );
            })}
        </div>
      </div>
    </>
  );

  return (
    <>
      <button
        type="button"
        onClick={openPanel}
        className="relative grid h-9 w-9 place-items-center rounded-lg text-white/70 hover:bg-white/5 hover:text-white focus-ring"
        aria-label={unread > 0 ? `Notifikasi, ${unread} belum dibaca` : "Notifikasi"}
        aria-expanded={open}
      >
        <Bell size={18} />
        {unread > 0 && (
          // Warna di-inline supaya tetap merah/putih di semua tema.
          <span
            className="absolute -right-0.5 -top-0.5 grid h-[18px] min-w-[18px] place-items-center rounded-full px-1 text-[10px] font-bold leading-none"
            style={{ background: "#ef4444", color: "#fff" }}
          >
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>
      {/* Panel lewat portal: <header> memakai backdrop-filter, jadi elemen "fixed"
          di dalamnya terpotong ke area header, bukan ke layar. */}
      {mounted && open && createPortal(panel, document.body)}
    </>
  );
}
