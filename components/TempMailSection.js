"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Mail,
  Copy,
  Check,
  RefreshCw,
  Trash2,
  ArrowLeft,
  Loader2,
  Inbox,
  Shuffle,
  PencilLine,
  AlertCircle,
} from "lucide-react";
import TurnstileWidget from "@/components/TurnstileWidget";
import {
  loadTempMail,
  saveTempMail,
  findCodes,
  MAX_ACCOUNTS,
  MAX_MESSAGES,
} from "@/lib/tempMailStore";

// Daftar domain (sama dengan lib/scrapers/tempMail.js; ditulis ulang di sini
// supaya kode scraper server tidak ikut terbawa ke browser).
const DOMAINS = [
  "gmail10p.com",
  "oletters.com",
  "oemails.com",
  "oegmail.com",
  "suiemail.com",
  "voewo.com",
  "yanemail.com",
];

const POLL_MS = 12000;

const inputCls =
  "w-full rounded-xl border border-white/10 bg-ink-950 px-4 py-3 text-sm text-white placeholder:text-white/30 focus-ring";

function formatTime(ms) {
  if (!ms) return "";
  const d = new Date(ms);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  return sameDay
    ? d.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })
    : d.toLocaleDateString("id-ID", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

export default function TempMailSection() {
  const [ready, setReady] = useState(false);
  const [accounts, setAccounts] = useState([]);
  const [active, setActive] = useState(null);
  const [boxes, setBoxes] = useState({});

  // Form buat email
  const [mode, setMode] = useState("random"); // "random" | "custom"
  const [name, setName] = useState("");
  const [domain, setDomain] = useState("random");
  const [token, setToken] = useState("");
  const [tsReset, setTsReset] = useState(0);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");

  // Kotak masuk
  const [refreshing, setRefreshing] = useState(false);
  const [inboxError, setInboxError] = useState("");
  const [openId, setOpenId] = useState(null);
  const [copied, setCopied] = useState("");
  const busyRef = useRef(false);
  const boxesRef = useRef({});
  boxesRef.current = boxes;

  // Muat data tersimpan setelah halaman tampil (hindari mismatch hidrasi).
  useEffect(() => {
    const s = loadTempMail();
    setAccounts(s.accounts);
    setActive(s.active && s.accounts.some((a) => a.email === s.active) ? s.active : s.accounts[0]?.email || null);
    setBoxes(s.boxes);
    setReady(true);
  }, []);

  // Simpan otomatis setiap ada perubahan.
  useEffect(() => {
    if (!ready) return;
    saveTempMail({ accounts, active, boxes });
  }, [ready, accounts, active, boxes]);

  const messages = useMemo(() => (active ? boxes[active] || [] : []), [boxes, active]);
  const opened = messages.find((m) => m.id === openId) || null;

  const refresh = useCallback(async (email, { silent = false } = {}) => {
    if (!email || busyRef.current) return;
    busyRef.current = true;
    if (!silent) setRefreshing(true);
    try {
      const known = (boxesRef.current[email] || []).map((m) => m.id);
      const res = await fetch("/api/tempmail", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "inbox", email, known }),
      });
      const data = await res.json();
      if (!data.status) throw new Error(data.message || "Gagal memeriksa kotak masuk.");
      setInboxError("");
      if (data.messages?.length) {
        const now = Date.now();
        setBoxes((prev) => {
          const cur = prev[email] || [];
          const ids = new Set(cur.map((m) => m.id));
          const add = data.messages
            .filter((m) => !ids.has(m.id))
            .map((m) => ({ ...m, receivedAt: m.date || now, read: false }));
          if (!add.length) return prev;
          const merged = [...add, ...cur].sort((a, b) => b.receivedAt - a.receivedAt).slice(0, MAX_MESSAGES);
          return { ...prev, [email]: merged };
        });
      }
    } catch (err) {
      if (!silent) setInboxError(err.message || "Gagal memeriksa kotak masuk.");
    } finally {
      busyRef.current = false;
      setRefreshing(false);
    }
  }, []);

  // Cek saat alamat aktif berganti, lalu otomatis berkala selama tab terlihat.
  useEffect(() => {
    if (!ready || !active) return;
    setOpenId(null);
    setInboxError("");
    refresh(active);
    const t = setInterval(() => {
      if (document.visibilityState === "visible") refresh(active, { silent: true });
    }, POLL_MS);
    return () => clearInterval(t);
  }, [ready, active, refresh]);

  async function handleCreate(e) {
    e.preventDefault();
    setCreateError("");
    const cleanName = name.trim().toLowerCase();
    if (mode === "custom" && !/^[a-z0-9._-]{3,30}$/.test(cleanName)) {
      setCreateError("Nama email 3-30 karakter, hanya huruf kecil, angka, titik, strip, atau underscore.");
      return;
    }
    if (!token) {
      setCreateError("Verifikasi keamanan belum selesai. Tunggu sebentar lalu coba lagi.");
      return;
    }
    if (accounts.length >= MAX_ACCOUNTS) {
      setCreateError(`Maksimal ${MAX_ACCOUNTS} email tersimpan. Hapus salah satu dulu.`);
      return;
    }
    setCreating(true);
    try {
      const res = await fetch("/api/tempmail", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create",
          name: mode === "custom" ? cleanName : "",
          domain: domain === "random" ? "" : domain,
          turnstileToken: token,
        }),
      });
      const data = await res.json();
      if (!data.status) throw new Error(data.message || "Gagal membuat email.");
      setAccounts((prev) =>
        prev.some((a) => a.email === data.email) ? prev : [{ email: data.email, createdAt: Date.now() }, ...prev]
      );
      setActive(data.email);
      setName("");
    } catch (err) {
      setCreateError(err.message || "Gagal membuat email.");
    } finally {
      setCreating(false);
      setToken("");
      setTsReset((n) => n + 1);
    }
  }

  async function copyText(text, key) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      setTimeout(() => setCopied(""), 1800);
    } catch {
      /* izin clipboard ditolak, pengguna bisa menyalin manual */
    }
  }

  function removeAccount(email) {
    if (!window.confirm(`Hapus ${email} dari daftar? Semua pesannya di perangkat ini ikut terhapus.`)) return;
    const rest = accounts.filter((a) => a.email !== email);
    setAccounts(rest);
    setBoxes((prev) => {
      const next = { ...prev };
      delete next[email];
      return next;
    });
    if (active === email) setActive(rest[0]?.email || null);
  }

  function removeMessage(id) {
    setBoxes((prev) => ({ ...prev, [active]: (prev[active] || []).filter((m) => m.id !== id) }));
    setOpenId(null);
  }

  function openMessage(id) {
    setOpenId(id);
    setBoxes((prev) => ({
      ...prev,
      [active]: (prev[active] || []).map((m) => (m.id === id ? { ...m, read: true } : m)),
    }));
  }

  const unreadOf = (email) => (boxes[email] || []).filter((m) => !m.read).length;

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)]">
      {/* ---------- Kolom kiri: buat & daftar email ---------- */}
      <div className="min-w-0 space-y-6">
        <form onSubmit={handleCreate} className="min-w-0 rounded-2xl border border-white/10 bg-ink-900/60 p-5">
          <h2 className="font-display text-lg font-semibold text-white">Buat email baru</h2>

          <div className="mt-4 grid grid-cols-2 gap-2">
            {[
              { id: "random", label: "Acak", icon: Shuffle },
              { id: "custom", label: "Nama sendiri", icon: PencilLine },
            ].map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                onClick={() => setMode(id)}
                aria-pressed={mode === id}
                className={`flex items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-medium transition-colors ${
                  mode === id
                    ? "border-signal-500 bg-signal-500/10 text-white"
                    : "border-white/10 text-white/60 hover:bg-white/5"
                }`}
              >
                <Icon size={15} /> {label}
              </button>
            ))}
          </div>

          <div className="mt-4 space-y-3">
            {mode === "custom" && (
              <div>
                <label className="mb-1.5 block text-xs font-medium text-white/50">Nama email</label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value.toLowerCase())}
                  placeholder="contoh: budi.santoso"
                  maxLength={30}
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  className={inputCls}
                />
              </div>
            )}
            <div>
              <label className="mb-1.5 block text-xs font-medium text-white/50">Domain</label>
              <select value={domain} onChange={(e) => setDomain(e.target.value)} className={inputCls}>
                <option value="random">Acak</option>
                {DOMAINS.map((d) => (
                  <option key={d} value={d}>
                    @{d}
                  </option>
                ))}
              </select>
            </div>

            <div className="min-w-0 max-w-full">
              <TurnstileWidget onToken={setToken} resetKey={tsReset} />
            </div>

            {createError && (
              <p className="flex items-start gap-2 text-sm text-red-400">
                <AlertCircle size={16} className="mt-0.5 shrink-0" /> {createError}
              </p>
            )}

            <button
              type="submit"
              disabled={creating}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-signal-500 px-4 py-3 text-sm font-semibold text-ink-950 transition-transform hover:scale-[1.01] disabled:opacity-50 disabled:hover:scale-100"
            >
              {creating && <Loader2 size={16} className="animate-spin" />}
              {creating ? "Membuat..." : "Buat email"}
            </button>
          </div>
        </form>

        {ready && accounts.length > 0 && (
          <div className="min-w-0 rounded-2xl border border-white/10 bg-ink-900/60 p-5">
            <h2 className="font-display text-lg font-semibold text-white">Email tersimpan</h2>
            <p className="mt-1 text-xs text-white/50">Tersimpan di browser ini, tidak hilang saat halaman di-refresh.</p>
            <ul className="mt-3 space-y-2">
              {accounts.map((a) => {
                const unread = unreadOf(a.email);
                const isActive = a.email === active;
                return (
                  <li key={a.email} className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setActive(a.email)}
                      aria-pressed={isActive}
                      className={`flex min-w-0 flex-1 items-center gap-2 rounded-xl border px-3 py-2.5 text-left text-sm transition-colors ${
                        isActive
                          ? "border-signal-500 bg-signal-500/10 text-white"
                          : "border-white/10 text-white/70 hover:bg-white/5"
                      }`}
                    >
                      <Mail size={15} className="shrink-0" />
                      <span className="min-w-0 flex-1 truncate">{a.email}</span>
                      {unread > 0 && (
                        <span className="shrink-0 rounded-full bg-signal-500 px-2 py-0.5 text-xs font-semibold text-ink-950">
                          {unread}
                        </span>
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => removeAccount(a.email)}
                      aria-label={`Hapus ${a.email}`}
                      className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-white/10 text-white/50 hover:bg-white/5 hover:text-white"
                    >
                      <Trash2 size={15} />
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </div>

      {/* ---------- Kolom kanan: kotak masuk ---------- */}
      <div className="min-w-0 rounded-2xl border border-white/10 bg-ink-900/60 p-5">
        {!ready ? (
          <div className="grid place-items-center py-16 text-white/50">
            <Loader2 className="animate-spin" size={22} />
          </div>
        ) : !active ? (
          <div className="grid place-items-center gap-2 py-16 text-center">
            <Inbox size={32} className="text-white/30" />
            <p className="text-sm font-medium text-white">Belum ada email</p>
            <p className="max-w-xs text-xs leading-relaxed text-white/50">
              Buat email sementara dulu, lalu pakai untuk daftar akun atau menerima kode OTP.
            </p>
          </div>
        ) : (
          <>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-medium text-white/50">Email aktif</p>
                <p className="mt-1 break-all font-display text-lg font-semibold text-white">{active}</p>
              </div>
              <div className="flex shrink-0 gap-2">
                <button
                  type="button"
                  onClick={() => copyText(active, "addr")}
                  className="flex items-center gap-1.5 rounded-xl border border-white/10 px-3 py-2 text-xs font-medium text-white/80 hover:bg-white/5"
                >
                  {copied === "addr" ? <Check size={14} /> : <Copy size={14} />}
                  {copied === "addr" ? "Tersalin" : "Salin"}
                </button>
                <button
                  type="button"
                  onClick={() => refresh(active)}
                  disabled={refreshing}
                  aria-label="Periksa kotak masuk"
                  className="grid h-9 w-9 place-items-center rounded-xl border border-white/10 text-white/80 hover:bg-white/5 disabled:opacity-50"
                >
                  <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} />
                </button>
              </div>
            </div>

            <p className="mt-2 text-xs text-white/40">
              Kotak masuk diperiksa otomatis tiap beberapa detik. Hanya bisa menerima email, tidak bisa mengirim.
            </p>

            {inboxError && (
              <p className="mt-3 flex items-start gap-2 text-sm text-red-400">
                <AlertCircle size={16} className="mt-0.5 shrink-0" /> {inboxError}
              </p>
            )}

            <div className="mt-4 border-t border-white/10 pt-4">
              {opened ? (
                <MessageView
                  msg={opened}
                  copied={copied}
                  onCopy={copyText}
                  onBack={() => setOpenId(null)}
                  onDelete={() => removeMessage(opened.id)}
                />
              ) : messages.length === 0 ? (
                <div className="grid place-items-center gap-2 py-12 text-center">
                  <Inbox size={28} className="text-white/30" />
                  <p className="text-sm font-medium text-white">Kotak masuk kosong</p>
                  <p className="max-w-xs text-xs leading-relaxed text-white/50">
                    Pakai alamat di atas untuk mendaftar. Pesan yang masuk akan muncul di sini.
                  </p>
                </div>
              ) : (
                <ul className="space-y-2">
                  {messages.map((m) => (
                    <li key={m.id}>
                      <button
                        type="button"
                        onClick={() => openMessage(m.id)}
                        className="flex w-full items-start gap-3 rounded-xl border border-white/10 px-4 py-3 text-left transition-colors hover:bg-white/5"
                      >
                        <span
                          className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${m.read ? "bg-transparent" : "bg-signal-500"}`}
                        />
                        <span className="min-w-0 flex-1">
                          <span className="flex items-baseline justify-between gap-3">
                            <span className={`truncate text-sm ${m.read ? "text-white/70" : "font-semibold text-white"}`}>
                              {m.from || "Pengirim tidak diketahui"}
                            </span>
                            <span className="shrink-0 text-xs text-white/40">{formatTime(m.receivedAt)}</span>
                          </span>
                          <span className="mt-0.5 block truncate text-sm text-white/80">
                            {m.subject || "(tanpa subjek)"}
                          </span>
                          <span className="mt-0.5 line-clamp-1 text-xs text-white/40">
                            {(m.text || "").replace(/\s+/g, " ").slice(0, 120)}
                          </span>
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function MessageView({ msg, copied, onCopy, onBack, onDelete }) {
  const codes = useMemo(() => findCodes(msg), [msg]);
  const frameRef = useRef(null);

  // Isi HTML ditampilkan di iframe tanpa script (sandbox), jadi aman dari kode
  // berbahaya di email. "allow-same-origin" hanya dipakai untuk mengukur tinggi.
  const srcDoc = useMemo(
    () =>
      msg.html
        ? `<!doctype html><html><head><meta charset="utf-8"><base target="_blank"><style>body{margin:0;padding:12px;font-family:system-ui,sans-serif;font-size:14px;color:#111;background:#fff;word-break:break-word}img{max-width:100%;height:auto}</style></head><body>${msg.html}</body></html>`
        : "",
    [msg.html]
  );

  function fitFrame() {
    const f = frameRef.current;
    try {
      const h = f?.contentDocument?.documentElement?.scrollHeight;
      if (h) f.style.height = `${Math.min(h + 4, 1600)}px`;
    } catch {}
  }

  return (
    <div>
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-1.5 rounded-xl border border-white/10 px-3 py-2 text-xs font-medium text-white/80 hover:bg-white/5"
        >
          <ArrowLeft size={14} /> Kembali
        </button>
        <button
          type="button"
          onClick={onDelete}
          className="flex items-center gap-1.5 rounded-xl border border-white/10 px-3 py-2 text-xs font-medium text-white/60 hover:bg-white/5 hover:text-white"
        >
          <Trash2 size={14} /> Hapus pesan
        </button>
      </div>

      <h3 className="mt-4 break-words font-display text-lg font-semibold text-white">
        {msg.subject || "(tanpa subjek)"}
      </h3>
      <p className="mt-1 break-all text-xs text-white/50">
        Dari: {msg.from || "tidak diketahui"}
        {msg.receivedAt ? ` · ${formatTime(msg.receivedAt)}` : ""}
      </p>

      {codes.length > 0 && (
        <div className="mt-4 rounded-xl border border-signal-500/40 bg-signal-500/10 p-3">
          <p className="text-xs font-medium text-white/60">Kode terdeteksi</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {codes.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => onCopy(c.replace(/\D/g, ""), `code-${c}`)}
                className="flex items-center gap-2 rounded-lg border border-white/10 bg-ink-950 px-3 py-1.5 font-mono text-sm font-semibold tracking-wider text-white"
              >
                {c}
                {copied === `code-${c}` ? <Check size={14} /> : <Copy size={14} className="text-white/50" />}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="mt-4 overflow-hidden rounded-xl border border-white/10">
        {srcDoc ? (
          <iframe
            ref={frameRef}
            title="Isi email"
            srcDoc={srcDoc}
            sandbox="allow-same-origin allow-popups allow-popups-to-escape-sandbox"
            onLoad={fitFrame}
            className="block w-full bg-white"
            style={{ height: 320 }}
          />
        ) : (
          <pre className="whitespace-pre-wrap break-words p-4 font-sans text-sm leading-relaxed text-white/80">
            {msg.text || "(pesan kosong)"}
          </pre>
        )}
      </div>
    </div>
  );
}
