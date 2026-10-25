"use client";

// Pop up pemutar musik penuh: meluncur dari bawah menutupi seluruh layar, bisa
// ditutup (tombol panah bawah, Esc, atau seret ke bawah) kembali ke mini player.
// Isinya tombol-tombol yang sama dengan pemutar lama di halaman Musik (unduh,
// sebelumnya, putar/jeda, berikutnya, mode putar, progres, volume, tambah ke
// playlist), ditambah tab "Lirik" yang bergulir otomatis sesuai menit lagu.
// Dibuka lewat MiniPlayer (state playerOpen ada di MusicPlayerProvider).
// Ikon gear di sebelah tab Cover/Lirik membuka menu "Tampilan album": Kotak lembut
// (bawaan), Kotak penuh (sejajar bar waktu, seperti Spotify), dan Piringan hitam
// (berputar saat lagu diputar). Pilihan disimpan di localStorage (COVER_STYLE_KEY).
// Ikon di sisi kiri tab membuka panel "Suara": kecepatan putar (slow/fast) dan
// equalizer 5 pita. Mesin audionya ada di MusicPlayerProvider + lib/audioFx.js.

import "./fullplayer.css";
import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import {
  Check,
  ChevronDown,
  Download,
  ListPlus,
  Loader2,
  Minus,
  Music2,
  Pause,
  Play,
  Plus,
  Repeat,
  Repeat1,
  Shuffle,
  SkipBack,
  Settings,
  SkipForward,
  SlidersHorizontal,
  Volume1,
  Volume2,
} from "lucide-react";
import MarqueeText from "@/components/MarqueeText";
import { useMusicPlayer } from "@/components/MusicPlayerProvider";
import {
  EQ_BANDS,
  EQ_MAX_DB,
  EQ_MIN_DB,
  EQ_PRESETS,
  RATE_MAX,
  RATE_MIN,
  RATE_PRESETS,
  sameGains,
} from "@/lib/audioFx";
import useBackToClose from "@/lib/useBackToClose";

const COVER_STYLE_KEY = "fp-cover-style";
const COVER_STYLES = [
  { id: "soft", label: "Kotak lembut", hint: "Sudut membulat" },
  { id: "square", label: "Kotak penuh", hint: "Sejajar bar waktu" },
  { id: "vinyl", label: "Piringan hitam", hint: "Berputar saat diputar" },
];

const SOURCE_LABEL = { youtube: "YouTube", spotify: "Spotify", soundcloud: "SoundCloud" };

function formatTime(sec) {
  if (!Number.isFinite(sec) || sec <= 0) return "0:00";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60)
    .toString()
    .padStart(2, "0");
  return `${m}:${s}`;
}

function slug(text) {
  return (
    (text || "lagu")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "")
      .slice(0, 50) || "lagu"
  );
}

export default function FullPlayer() {
  const pathname = usePathname();
  const {
    track,
    playMode,
    isPlaying,
    progress,
    duration,
    volume,
    playbackError,
    refreshing,
    listLength,
    playerOpen,
    setPlayerOpen,
    setPlaylistTarget,
    setVolume,
    togglePlay,
    playByOffset,
    seek,
    cycleMode,
    fx,
    fxError,
    eqEngine,
    setRate,
    setKeepPitch,
    setEqOn,
    setGain,
    applyPreset,
    resetFx,
  } = useMusicPlayer();

  const [view, setView] = useState("cover"); // cover | lirik
  const [lyrics, setLyrics] = useState({ key: null, state: "idle", synced: [], plain: "", instrumental: false });
  const [retry, setRetry] = useState(0);
  const [dragY, setDragY] = useState(0);
  // Layar lebar (desktop / "situs desktop" di HP): cover & lirik tampil berdampingan.
  const [wide, setWide] = useState(false);
  // Tampilan album (soft | square | vinyl) + menu gear untuk menggantinya.
  const [coverStyle, setCoverStyle] = useState("soft");
  const [menuOpen, setMenuOpen] = useState(false);
  const [fxOpen, setFxOpen] = useState(false); // panel Suara (kecepatan + equalizer)

  const cacheRef = useRef(new Map()); // id lagu -> hasil lirik
  const fetchedKeyRef = useRef(null); // id lagu yang lirik-nya sedang/sudah diambil
  const boxRef = useRef(null);
  const lineRefs = useRef([]);
  const userScrollUntil = useRef(0);
  const scrolledOnce = useRef(false);
  const dragStart = useRef(null);
  const rootRef = useRef(null);
  const menuRef = useRef(null);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    const sync = () => setWide(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  // Muat pilihan tampilan album yang tersimpan.
  useEffect(() => {
    try {
      const saved = localStorage.getItem(COVER_STYLE_KEY);
      if (COVER_STYLES.some((c) => c.id === saved)) setCoverStyle(saved);
    } catch {
      // localStorage tidak tersedia: pakai tampilan bawaan
    }
  }, []);

  function chooseCoverStyle(id) {
    setCoverStyle(id);
    setMenuOpen(false);
    try {
      localStorage.setItem(COVER_STYLE_KEY, id);
    } catch {
      // abaikan
    }
  }

  // Menu gear: tutup saat mengetuk di luar menu, atau Esc (Esc menutup menu dulu,
  // pemutar baru tertutup pada Esc berikutnya).
  const panelOpen = menuOpen || fxOpen;
  useEffect(() => {
    if (!panelOpen) return undefined;
    const closeAll = () => {
      setMenuOpen(false);
      setFxOpen(false);
    };
    const onDown = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) closeAll();
    };
    const onKey = (e) => {
      if (e.key !== "Escape") return;
      e.stopPropagation();
      closeAll();
    };
    document.addEventListener("pointerdown", onDown);
    window.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      window.removeEventListener("keydown", onKey, true);
    };
  }, [panelOpen]);

  useEffect(() => {
    if (!playerOpen) {
      setMenuOpen(false);
      setFxOpen(false);
    }
  }, [playerOpen]);

  const trackId = track?.id;
  const showLyrics = view === "lirik" || wide;
  const hasDuration = duration > 0;

  function close() {
    setPlayerOpen(false);
  }

  // Tombol BACK di HP menutup pemutar penuh (kembali ke mini player).
  useBackToClose(playerOpen, () => setPlayerOpen(false));

  // Tutup kalau pindah halaman; Esc menutup; scroll halaman di belakang dikunci.
  useEffect(() => {
    setPlayerOpen(false);
  }, [pathname, setPlayerOpen]);

  // Tinggi pemutar = tinggi layar yang benar-benar terlihat saat ini. Di Chrome HP,
  // bar alamat yang muncul/hilang bisa membuat elemen "fixed" lebih pendek dari layar
  // (muncul celah di bawah dan halaman di belakangnya kelihatan), jadi tinggi dihitung ulang
  // saat dibuka dan setiap ukuran layar berubah.
  useEffect(() => {
    if (!playerOpen) return;
    const el = rootRef.current;
    if (!el) return;
    const fit = () => {
      const h = Math.max(window.visualViewport?.height || 0, window.innerHeight, document.documentElement.clientHeight);
      // +6px: sedikit melebihi layar (yang berlebih tidak terlihat) supaya tidak ada garis tipis di dasar.
      el.style.height = `${Math.round(h) + 6}px`;
    };
    fit();
    const t1 = setTimeout(fit, 120);
    const t2 = setTimeout(fit, 450); // setelah animasi naik selesai
    window.addEventListener("resize", fit);
    window.visualViewport?.addEventListener("resize", fit);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      window.removeEventListener("resize", fit);
      window.visualViewport?.removeEventListener("resize", fit);
    };
  }, [playerOpen]);

  useEffect(() => {
    if (!playerOpen) return;
    const onKey = (e) => e.key === "Escape" && setPlayerOpen(false);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [playerOpen, setPlayerOpen]);

  // Lagu berganti: kembali ke posisi awal daftar lirik.
  useEffect(() => {
    scrolledOnce.current = false;
    userScrollUntil.current = 0;
  }, [trackId, showLyrics, playerOpen]);

  // Ambil lirik hanya saat tab Lirik dibuka (hemat request). Menunggu durasi lagu
  // terbaca supaya versi lagu yang dipilih lebih tepat (maksimal tunggu 2,5 detik).
  useEffect(() => {
    if (!track || !showLyrics || !playerOpen) return;
    const cached = cacheRef.current.get(trackId);
    if (cached) {
      setLyrics({ key: trackId, ...cached });
      return;
    }
    if (fetchedKeyRef.current === trackId) return;

    const run = () => {
      fetchedKeyRef.current = trackId;
      setLyrics({ key: trackId, state: "loading", synced: [], plain: "", instrumental: false });
      const qs = new URLSearchParams({
        title: track.title || "",
        artist: track.artist || "",
        ...(hasDuration ? { duration: String(Math.round(duration)) } : {}),
      });
      fetch(`/api/lyrics?${qs.toString()}`)
        .then((r) => r.json())
        .then((data) => {
          if (!data?.status) throw new Error("gagal");
          const result = data.found
            ? { state: "found", synced: data.synced || [], plain: data.plain || "", instrumental: false }
            : { state: "none", synced: [], plain: "", instrumental: Boolean(data.instrumental) };
          cacheRef.current.set(trackId, result);
          setLyrics({ key: trackId, ...result });
        })
        .catch(() => {
          if (fetchedKeyRef.current === trackId) fetchedKeyRef.current = null;
          setLyrics({ key: trackId, state: "error", synced: [], plain: "", instrumental: false });
        });
    };

    if (hasDuration) {
      run();
      return;
    }
    const t = setTimeout(run, 2500);
    return () => clearTimeout(t);
  }, [trackId, showLyrics, playerOpen, hasDuration, retry]); // eslint-disable-line react-hooks/exhaustive-deps

  const current =
    lyrics.key === trackId ? lyrics : { state: showLyrics ? "loading" : "idle", synced: [], plain: "", instrumental: false };
  const synced = current.synced;

  // Baris yang sedang dinyanyikan = baris terakhir yang waktunya sudah lewat.
  const activeIdx = useMemo(() => {
    if (!synced.length) return -1;
    const t = progress + 0.2;
    let lo = 0;
    let hi = synced.length - 1;
    let ans = -1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if (synced[mid].t <= t) {
        ans = mid;
        lo = mid + 1;
      } else hi = mid - 1;
    }
    return ans;
  }, [synced, progress]);

  // Gulirkan baris aktif ke tengah. Berhenti 3,5 detik kalau user menggulir sendiri.
  useEffect(() => {
    if (!showLyrics || !playerOpen || activeIdx < 0) return;
    if (Date.now() < userScrollUntil.current) return;
    const box = boxRef.current;
    const el = lineRefs.current[activeIdx];
    if (!box || !el) return;
    box.scrollTo({
      top: el.offsetTop - box.clientHeight / 2 + el.offsetHeight / 2,
      behavior: scrolledOnce.current ? "smooth" : "auto",
    });
    scrolledOnce.current = true;
  }, [activeIdx, showLyrics, playerOpen, current.state]);

  if (!track) return null;

  const ModeIcon = playMode === "repeat" ? Repeat1 : playMode === "shuffle" ? Shuffle : Repeat;
  const modeLabel = playMode === "repeat" ? "Ulangi satu lagu" : playMode === "shuffle" ? "Acak" : "Berurutan";
  const downloadHref = `/api/fetch-media?${new URLSearchParams({
    url: track.streamUrl,
    filename: `${slug(track.title)}.mp3`,
  }).toString()}`;

  // Seret panel header ke bawah untuk menutup.
  const touch = {
    onTouchStart: (e) => {
      dragStart.current = e.touches[0].clientY;
    },
    onTouchMove: (e) => {
      if (dragStart.current == null) return;
      setDragY(Math.max(0, e.touches[0].clientY - dragStart.current));
    },
    onTouchEnd: () => {
      if (dragY > 110) close();
      dragStart.current = null;
      setDragY(0);
    },
  };

  // Satu tingkat volume = 10%.
  const stepVolume = (dir) => setVolume(Math.min(1, Math.max(0, Math.round(volume * 10 + dir) / 10)));

  const holdAutoScroll = () => {
    userScrollUntil.current = Date.now() + 3500;
  };

  return (
    <div
      ref={rootRef}
      className="fullplayer"
      data-open={playerOpen ? "true" : "false"}
      aria-hidden={!playerOpen}
      role="dialog"
      aria-label="Pemutar musik"
      style={dragY > 0 ? { transform: `translateY(${dragY}px)`, transition: "none" } : undefined}
    >
      {track.thumbnail && (
        <div className="fp-bg" aria-hidden="true">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={track.thumbnail} alt="" referrerPolicy="no-referrer" />
        </div>
      )}

      <div className="fp-body">
        <div {...touch} className="flex-shrink-0 touch-pan-x">
          <div className="flex items-center justify-between gap-2 px-4 pt-[calc(0.75rem+env(safe-area-inset-top,0px))] md:px-8 md:pt-[calc(1.25rem+env(safe-area-inset-top,0px))]">
            <button
              type="button"
              onClick={close}
              className="grid h-11 w-11 place-items-center rounded-full text-white/80 hover:bg-white/10 hover:text-white"
              aria-label="Tutup pemutar penuh"
              title="Tutup"
            >
              <ChevronDown size={28} />
            </button>
            <div className="min-w-0 text-center">
              <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-white/50">Sedang diputar</p>
              <p className="truncate text-sm font-medium text-white">{SOURCE_LABEL[track.source] || "YouTube"}</p>
            </div>
            <button
              type="button"
              onClick={() => setPlaylistTarget(track)}
              aria-label="Tambah ke playlist"
              title="Tambah ke playlist"
              className="grid h-11 w-11 place-items-center rounded-full text-white/60 hover:bg-white/10 hover:text-white"
            >
              <ListPlus size={22} />
            </button>
          </div>

          <div ref={menuRef} className="relative mt-2 h-10 md:h-11">
            <div className="mx-auto flex w-56 rounded-xl md:hidden border border-white/10 bg-white/5 p-1" role="tablist">
              {[
                { id: "cover", label: "Cover" },
                { id: "lirik", label: "Lirik" },
              ].map((t) => (
                <button
                  type="button"
                  role="tab"
                  key={t.id}
                  aria-selected={view === t.id}
                  onClick={() => setView(t.id)}
                  className={`flex-1 rounded-lg px-4 py-1.5 text-sm font-medium transition-colors ${
                    view === t.id ? "bg-signal-500 text-ink-950" : "text-white/60 hover:text-white"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={() => {
                setMenuOpen(false);
                setFxOpen((o) => !o);
              }}
              aria-label="Pengaturan suara"
              aria-haspopup="dialog"
              aria-expanded={fxOpen}
              title="Suara: kecepatan & equalizer"
              className="absolute left-4 top-0 grid h-10 w-10 place-items-center rounded-xl border border-white/10 bg-white/5 text-white/80 hover:text-white md:left-8 md:h-11 md:w-11"
            >
              <SlidersHorizontal size={20} />
              {(fx.eqOn || fx.rate !== 1) && <span className="fp-fx-dot" aria-hidden="true" />}
            </button>

            {fxOpen && (
              <div
                className="fp-menu fp-fx text-white"
                role="dialog"
                aria-label="Pengaturan suara"
                // Geser slider tidak boleh dianggap gestur "tarik ke bawah untuk menutup pemutar".
                onTouchStart={(e) => e.stopPropagation()}
                onTouchMove={(e) => e.stopPropagation()}
                onTouchEnd={(e) => e.stopPropagation()}
              >
                <div className="fp-fx-head">
                  <p className="fp-menu-title text-white/50">Suara</p>
                  <button type="button" onClick={resetFx} className="fp-chip text-white/80">
                    Reset
                  </button>
                </div>

                <section className="fp-fx-sec">
                  <div className="fp-fx-row">
                    <span className="fp-fx-label">Kecepatan</span>
                    <span className="fp-fx-val tabular-nums">{fx.rate.toFixed(2)}×</span>
                  </div>
                  <input
                    type="range"
                    min={RATE_MIN}
                    max={RATE_MAX}
                    step={0.05}
                    value={fx.rate}
                    onChange={(e) => setRate(Number(e.target.value))}
                    aria-label="Kecepatan putar"
                    className="h-1 w-full accent-signal-500"
                  />
                  <div className="fp-chips">
                    {RATE_PRESETS.map((r) => (
                      <button
                        type="button"
                        key={r}
                        onClick={() => setRate(r)}
                        className="fp-chip text-white/80"
                        data-active={Math.abs(fx.rate - r) < 0.001 ? "true" : "false"}
                      >
                        {r}×
                      </button>
                    ))}
                  </div>
                  <label className="fp-fx-check text-white/70">
                    <input
                      type="checkbox"
                      checked={fx.keepPitch}
                      onChange={(e) => setKeepPitch(e.target.checked)}
                      className="accent-signal-500"
                    />
                    <span>Nada tetap (matikan untuk efek slowed / nightcore)</span>
                  </label>
                </section>

                <section className="fp-fx-sec">
                  <div className="fp-fx-row">
                    <span className="fp-fx-label">Equalizer</span>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={fx.eqOn}
                      aria-label="Equalizer"
                      onClick={() => setEqOn(!fx.eqOn)}
                      className="fp-switch"
                      data-on={fx.eqOn ? "true" : "false"}
                    >
                      <span className="fp-switch-knob" />
                    </button>
                  </div>

                  <div className="fp-chips" aria-disabled={!fx.eqOn}>
                    {EQ_PRESETS.map((p) => (
                      <button
                        type="button"
                        key={p.id}
                        disabled={!fx.eqOn}
                        onClick={() => applyPreset(p.id)}
                        className="fp-chip text-white/80"
                        data-active={fx.eqOn && sameGains(fx.gains, p.gains) ? "true" : "false"}
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>

                  <div className="fp-eq" data-off={fx.eqOn ? "false" : "true"}>
                    {EQ_BANDS.map((b, i) => (
                      <div className="fp-eq-band" key={b.id}>
                        <span className="fp-eq-name">
                          {b.label}
                          <small>{b.freq >= 1000 ? `${b.freq / 1000} kHz` : `${b.freq} Hz`}</small>
                        </span>
                        <input
                          type="range"
                          min={EQ_MIN_DB}
                          max={EQ_MAX_DB}
                          step={1}
                          value={fx.gains[i]}
                          disabled={!fx.eqOn}
                          onChange={(e) => setGain(i, Number(e.target.value))}
                          aria-label={`${b.label} (desibel)`}
                          className="h-1 min-w-0 flex-1 accent-signal-500"
                        />
                        <span className="fp-eq-db tabular-nums">
                          {fx.gains[i] > 0 ? `+${fx.gains[i]}` : fx.gains[i]} dB
                        </span>
                      </div>
                    ))}
                  </div>

                  <p className="fp-fx-note text-white/60">
                    {fxError
                      ? fxError
                      : eqEngine === "proxy"
                        ? "EQ aktif lewat server, karena sumber lagu ini tidak mengizinkan akses langsung. Pemakaian data server bertambah."
                        : eqEngine === "direct"
                          ? "EQ aktif langsung dari sumber lagu."
                          : eqEngine === "pending"
                            ? "Menyiapkan EQ…"
                            : "Nyalakan equalizer untuk mengatur bass dan treble. Lagu dimuat ulang sebentar di posisi yang sama."}
                  </p>
                </section>
              </div>
            )}

            <button
              type="button"
              onClick={() => {
                setFxOpen(false);
                setMenuOpen((o) => !o);
              }}
              aria-label="Pengaturan tampilan album"
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              title="Tampilan album"
              className="absolute right-4 top-0 grid h-10 w-10 place-items-center rounded-xl border border-white/10 bg-white/5 text-white/80 hover:text-white md:right-8 md:h-11 md:w-11"
            >
              <Settings size={20} />
            </button>

            {menuOpen && (
              <div className="fp-menu" role="menu" aria-label="Tampilan album">
                <p className="fp-menu-title text-white/50">Tampilan album</p>
                {COVER_STYLES.map((c) => {
                  const active = coverStyle === c.id;
                  return (
                    <button
                      type="button"
                      role="menuitemradio"
                      aria-checked={active}
                      key={c.id}
                      onClick={() => chooseCoverStyle(c.id)}
                      className="fp-menu-item text-white/80"
                      data-active={active ? "true" : "false"}
                    >
                      <span className={`fp-menu-shape fp-menu-shape-${c.id}`} aria-hidden="true" />
                      <span className="fp-menu-text">
                        <span className="fp-menu-label">{c.label}</span>
                        <span className="fp-menu-hint">{c.hint}</span>
                      </span>
                      {active && <Check size={18} strokeWidth={3} aria-hidden="true" />}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <div className="flex min-h-0 flex-1 flex-col md:flex-row md:items-stretch md:gap-12 md:px-10 md:py-6">
          <div
            className={`min-h-0 flex-1 items-center justify-center py-4 md:flex md:flex-none md:basis-[42%] md:p-0 ${
              coverStyle === "square" ? "px-6" : "px-8"
            } ${view === "cover" ? "flex" : "hidden"}`}
          >
            {coverStyle === "vinyl" ? (
              <div className="fp-vinyl fp-cover fp-cover-size" data-playing={isPlaying ? "true" : "false"}>
                <div className="fp-vinyl-disc">
                  {track.thumbnail ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={track.thumbnail} alt="" referrerPolicy="no-referrer" className="fp-vinyl-label" />
                  ) : (
                    <div className="fp-vinyl-label fp-vinyl-label-empty">
                      <Music2 size={40} />
                    </div>
                  )}
                  <span className="fp-vinyl-hole" aria-hidden="true" />
                </div>
              </div>
            ) : track.thumbnail ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={track.thumbnail}
                alt=""
                referrerPolicy="no-referrer"
                className={
                  coverStyle === "square"
                    ? "fp-cover fp-cover-square aspect-square object-cover"
                    : "fp-cover fp-cover-size aspect-square rounded-3xl object-cover"
                }
              />
            ) : (
              <div
                className={`fp-cover grid aspect-square place-items-center bg-white/5 text-white/30 ${
                  coverStyle === "square" ? "fp-cover-square" : "fp-cover-size rounded-3xl"
                }`}
              >
                <Music2 size={56} />
              </div>
            )}
          </div>

          <div
            ref={boxRef}
            className={`fp-lyrics relative mt-3 min-h-0 flex-1 overflow-y-auto px-6 md:mt-0 md:block md:px-2 ${
              view === "lirik" ? "block" : "hidden"
            }`}
            onTouchStart={holdAutoScroll}
            onWheel={holdAutoScroll}
            onPointerDown={holdAutoScroll}
          >
            {current.state === "loading" && (
              <p className="flex items-center justify-center gap-2 pt-24 text-sm text-white/60">
                <Loader2 size={16} className="animate-spin" />
                Memuat lirik...
              </p>
            )}

            {current.state === "none" && (
              <p className="px-4 pt-24 text-center text-base font-medium text-white/70">
                {current.instrumental ? "Lagu ini instrumental, tidak ada liriknya." : "Lirik untuk lagu ini tidak ditemukan"}
              </p>
            )}

            {current.state === "error" && (
              <div className="flex flex-col items-center gap-3 px-4 pt-24 text-center">
                <p className="text-sm text-white/70">Gagal memuat lirik.</p>
                <button
                  type="button"
                  onClick={() => setRetry((n) => n + 1)}
                  className="rounded-full bg-signal-500 px-5 py-2 text-sm font-semibold text-ink-950"
                >
                  Coba lagi
                </button>
              </div>
            )}

            {current.state === "found" && synced.length > 0 && (
              <div>
                <div className="h-[34dvh]" aria-hidden="true" />
                {synced.map((line, i) => (
                  <button
                    type="button"
                    key={`${line.t}-${i}`}
                    ref={(el) => {
                      lineRefs.current[i] = el;
                    }}
                    onClick={() => seek(line.t)}
                    data-active={i === activeIdx ? "true" : "false"}
                    className={`fp-line ${i === activeIdx ? "text-white" : i < activeIdx ? "text-white/40" : "text-white/50"}`}
                  >
                    {line.text}
                  </button>
                ))}
                <div className="h-[34dvh]" aria-hidden="true" />
              </div>
            )}

            {current.state === "found" && synced.length === 0 && current.plain && (
              <div className="pb-10 pt-4">
                <p className="mb-4 text-xs text-white/50">Lirik ini belum punya penanda waktu, jadi tidak bergulir otomatis.</p>
                <p className="whitespace-pre-line text-lg font-semibold leading-relaxed text-white">{current.plain}</p>
              </div>
            )}
          </div>
        </div>

        <div className="mx-auto w-full flex-shrink-0 px-6 md:max-w-2xl md:px-0 pb-[calc(1.25rem+env(safe-area-inset-bottom,0px))] pt-3 md:pb-[calc(2rem+env(safe-area-inset-bottom,0px))]">
          <div className="min-w-0">
            <h2 className="font-display text-xl font-semibold text-white md:text-2xl">
              <MarqueeText text={track.title} />
            </h2>
            <p className="truncate text-sm text-white/50">{track.artist}</p>
            {refreshing && !playbackError && (
              <p className="mt-1 flex items-center gap-1.5 text-xs text-white/60">
                <Loader2 size={12} className="animate-spin" />
                Link lagu kedaluwarsa, mengambil link baru...
              </p>
            )}
            {playbackError && <p className="mt-1 text-xs text-flare-400">{playbackError}</p>}
          </div>

          <div className="mt-3">
            <input
              type="range"
              min={0}
              max={duration > 0 ? duration : 0}
              disabled={!(duration > 0)}
              value={progress}
              onChange={(e) => seek(Number(e.target.value))}
              className="h-1 w-full accent-signal-500"
            />
            <div className="mt-1 flex justify-between text-[11px] tabular-nums text-white/40">
              <span>{formatTime(progress)}</span>
              <span>{duration > 0 ? `-${formatTime(duration - progress)}` : "--:--"}</span>
            </div>
          </div>

          <div className="mt-3 flex items-center justify-center gap-4">
            <a
              href={downloadHref}
              className="grid h-11 w-11 flex-shrink-0 place-items-center rounded-full text-white/40 hover:text-white/70"
              aria-label="Unduh lagu"
              title="Unduh lagu"
            >
              <Download size={20} />
            </a>
            <button
              onClick={() => playByOffset(-1)}
              disabled={listLength < 2}
              className="grid h-11 w-11 place-items-center text-white/70 hover:text-white disabled:opacity-30"
              aria-label="Lagu sebelumnya"
            >
              <SkipBack size={22} />
            </button>
            <button
              onClick={togglePlay}
              className="grid h-14 w-14 place-items-center rounded-full bg-signal-500 text-ink-950"
              aria-label={isPlaying ? "Jeda" : "Putar"}
            >
              {isPlaying ? <Pause size={24} /> : <Play size={24} className="ml-0.5" />}
            </button>
            <button
              onClick={() => playByOffset(1)}
              disabled={listLength < 2}
              className="grid h-11 w-11 place-items-center text-white/70 hover:text-white disabled:opacity-30"
              aria-label="Lagu berikutnya"
            >
              <SkipForward size={22} />
            </button>
            <button
              onClick={cycleMode}
              className={`grid h-11 w-11 place-items-center rounded-full ${
                playMode === "sequential" ? "text-white/40 hover:text-white/70" : "text-signal-400"
              }`}
              aria-label={`Mode putar: ${modeLabel}`}
              title={modeLabel}
            >
              <ModeIcon size={20} />
            </button>
          </div>

          {/* Volume: speaker (-) turun 1 tingkat (10%), speaker (+) naik 1 tingkat, atau geser bar. */}
          <div className="mt-4 flex items-center gap-2">
            <button
              type="button"
              onClick={() => stepVolume(-1)}
              disabled={volume <= 0}
              className="flex h-9 flex-shrink-0 items-center gap-0.5 rounded-full px-2 text-white/60 hover:text-white disabled:opacity-30"
              aria-label="Kecilkan volume"
              title="Kecilkan volume"
            >
              <Volume1 size={18} />
              <Minus size={11} strokeWidth={3} />
            </button>
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={volume}
              onChange={(e) => setVolume(Number(e.target.value))}
              aria-label="Volume"
              className="h-1 min-w-0 flex-1 accent-signal-500"
            />
            <button
              type="button"
              onClick={() => stepVolume(1)}
              disabled={volume >= 1}
              className="flex h-9 flex-shrink-0 items-center gap-0.5 rounded-full px-2 text-white/60 hover:text-white disabled:opacity-30"
              aria-label="Besarkan volume"
              title="Besarkan volume"
            >
              <Volume2 size={18} />
              <Plus size={11} strokeWidth={3} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
