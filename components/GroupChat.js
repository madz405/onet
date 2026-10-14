"use client";

// Grup Chat publik ala WhatsApp. Backend: Supabase (Auth Google + Postgres +
// Realtime). Semua aturan siapa boleh melakukan apa ditegakkan di database lewat
// Row Level Security (supabase/grup-chat.sql); kode di sini hanya antarmuka.
//
// Fitur: login Google, pesan realtime & tersimpan, balas, reaksi emoji, hapus
// pesan (milik sendiri / admin), sematkan pesan (admin), indikator mengetik,
// daftar online, serta panel info & pengaturan grup (components/GroupInfoSheet.js).

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { ArrowDown, Info, Loader2, LogIn, Pin, Reply, Send, ShieldCheck, Trash2, Users, X } from "lucide-react";
import GroupInfoSheet from "@/components/GroupInfoSheet";
import { getSupabase } from "@/lib/supabaseClient";
import { REACTIONS, MAX_MESSAGE, PAGE_SIZE, formatClock, groupMessages, sendBlockReason, snippet } from "@/lib/groupChat";

const useIsoLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;
const TYPING_SEND_GAP_MS = 2500;

function Avatar({ person, size = 32 }) {
  const name = person?.display_name || "?";
  const style = { width: size, height: size, fontSize: Math.round(size * 0.42) };
  return person?.avatar_url ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={person.avatar_url}
      alt=""
      referrerPolicy="no-referrer"
      style={style}
      className="flex-shrink-0 rounded-full object-cover"
    />
  ) : (
    <span
      style={style}
      className="grid flex-shrink-0 place-items-center rounded-full bg-white/10 font-semibold uppercase text-white/70"
    >
      {name.slice(0, 1)}
    </span>
  );
}

function StateCard({ children }) {
  return <div className="rounded-2xl border border-white/10 bg-ink-900/60 p-6 text-center">{children}</div>;
}

function MessageRow({
  item,
  uid,
  author,
  admins,
  reactions,
  replied,
  repliedAuthor,
  menuOpen,
  isAdminMe,
  pinned,
  onToggleMenu,
  onReact,
  onReply,
  onDelete,
  onPin,
}) {
  const { msg, first, last } = item;
  const mine = msg.user_id === uid;
  const deleted = Boolean(msg.deleted_at);
  const counts = {};
  for (const r of reactions || []) counts[r.emoji] = (counts[r.emoji] || 0) + 1;
  const iReacted = (emoji) => (reactions || []).some((r) => r.user_id === uid && r.emoji === emoji);
  const canDelete = !deleted && (mine || isAdminMe);

  return (
    <div className={`flex gap-2 ${mine ? "justify-end" : "justify-start"} ${first ? "mt-3" : "mt-0.5"}`}>
      {!mine && <div className="w-8 flex-shrink-0 self-end">{last ? <Avatar person={author} size={32} /> : null}</div>}

      <div className={`flex min-w-0 max-w-[82%] flex-col ${mine ? "items-end" : "items-start"}`}>
        <button
          type="button"
          onClick={deleted ? undefined : onToggleMenu}
          aria-expanded={menuOpen}
          className={`block max-w-full rounded-2xl px-3 py-2 text-left ${
            mine ? "bg-signal-500 text-ink-950" : "bg-white/10 text-white"
          } ${mine ? (last ? "rounded-br-md" : "") : last ? "rounded-bl-md" : ""} ${deleted ? "cursor-default" : ""}`}
        >
          {!mine && first && (
            <span className="mb-0.5 flex items-center gap-1 text-xs font-semibold text-signal-400">
              {author?.display_name || "Anggota"}
              {author?.role === "admin" && <ShieldCheck size={12} aria-label="Admin" />}
            </span>
          )}

          {msg.reply_to && !deleted && (
            <span className="mb-1 block rounded-lg border-l-2 border-current bg-black/10 px-2 py-1 text-xs">
              <span className="block font-semibold opacity-90">{repliedAuthor?.display_name || "Anggota"}</span>
              <span className="block truncate opacity-75">
                {replied ? (replied.deleted_at ? "Pesan dihapus" : snippet(replied.content, 60)) : "Pesan"}
              </span>
            </span>
          )}

          {deleted ? (
            <span className="block text-sm italic opacity-60">Pesan ini dihapus</span>
          ) : (
            <span className="block whitespace-pre-wrap break-words text-sm leading-snug">{msg.content}</span>
          )}

          <span className="mt-0.5 flex items-center justify-end gap-1 text-[10px] opacity-60">
            {pinned && <Pin size={10} aria-label="Disematkan" />}
            {formatClock(msg.created_at)}
          </span>
        </button>

        {Object.keys(counts).length > 0 && !deleted && (
          <div className="-mt-1 flex flex-wrap gap-1">
            {Object.entries(counts).map(([emoji, n]) => (
              <button
                type="button"
                key={emoji}
                onClick={() => onReact(emoji)}
                className={`rounded-full border px-2 py-0.5 text-xs ${
                  iReacted(emoji) ? "border-signal-500/60 bg-signal-500/15 text-white" : "border-white/15 bg-ink-900 text-white/80"
                }`}
              >
                {emoji} {n}
              </button>
            ))}
          </div>
        )}

        {menuOpen && !deleted && (
          <div className="mt-1 flex flex-wrap items-center gap-1 rounded-xl border border-white/10 bg-ink-900 p-1.5 shadow-lg">
            {REACTIONS.map((emoji) => (
              <button
                type="button"
                key={emoji}
                onClick={() => onReact(emoji)}
                aria-label={`Reaksi ${emoji}`}
                className={`h-8 w-8 rounded-lg text-lg ${iReacted(emoji) ? "bg-signal-500/20" : "hover:bg-white/10"}`}
              >
                {emoji}
              </button>
            ))}
            <span className="mx-0.5 h-5 w-px bg-white/15" />
            <button
              type="button"
              onClick={onReply}
              aria-label="Balas"
              className="grid h-8 w-8 place-items-center rounded-lg text-white/80 hover:bg-white/10"
            >
              <Reply size={16} />
            </button>
            {isAdminMe && (
              <button
                type="button"
                onClick={onPin}
                aria-label={pinned ? "Lepas sematan" : "Sematkan"}
                className="grid h-8 w-8 place-items-center rounded-lg text-white/80 hover:bg-white/10"
              >
                <Pin size={16} />
              </button>
            )}
            {canDelete && (
              <button
                type="button"
                onClick={onDelete}
                aria-label="Hapus pesan"
                className="grid h-8 w-8 place-items-center rounded-lg text-flare-400 hover:bg-flare-500/10"
              >
                <Trash2 size={16} />
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default function GroupChat() {
  const supabase = useMemo(() => getSupabase(), []);

  const [session, setSession] = useState(undefined); // undefined = memuat, null = belum login
  const [profile, setProfile] = useState(null);
  const [profileError, setProfileError] = useState("");
  const [settings, setSettings] = useState(null);
  const [people, setPeople] = useState({});
  const [messages, setMessages] = useState([]);
  const [hasMore, setHasMore] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [reactions, setReactions] = useState({});
  const [online, setOnline] = useState([]);
  const [typing, setTyping] = useState({});
  const [pinnedMsg, setPinnedMsg] = useState(null);

  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [replyTo, setReplyTo] = useState(null);
  const [menuId, setMenuId] = useState(null);
  const [showInfo, setShowInfo] = useState(false);
  const [newCount, setNewCount] = useState(0);
  const [cooldownLeft, setCooldownLeft] = useState(0);

  const listRef = useRef(null);
  const inputRef = useRef(null);
  const stickRef = useRef(true);
  const prependRef = useRef(null);
  const peopleRef = useRef({});
  const liveRef = useRef(null);
  const lastTypingSent = useRef(0);
  const cooldownUntil = useRef(0);

  const uid = session?.user?.id || null;
  const ready = Boolean(profile && !profile.banned);
  const isAdminMe = profile?.role === "admin";

  useEffect(() => {
    peopleRef.current = people;
  }, [people]);

  // ---- Pengaturan grup (publik, juga dipakai layar login) ----
  useEffect(() => {
    if (!supabase) return;
    supabase
      .from("group_settings")
      .select("*")
      .eq("id", 1)
      .maybeSingle()
      .then(({ data }) => data && setSettings(data));
  }, [supabase]);

  // ---- Sesi login ----
  useEffect(() => {
    if (!supabase) return undefined;
    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSession(data.session ?? null);
      // Setelah kembali dari Google, bersihkan ?code=... di URL.
      if (data.session && window.location.search) window.history.replaceState({}, "", window.location.pathname);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      if (active) setSession(s ?? null);
    });
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, [supabase]);

  // ---- Profil sendiri (dibuat otomatis oleh trigger database saat pertama login) ----
  useEffect(() => {
    if (!supabase || !uid) {
      setProfile(null);
      return undefined;
    }
    let active = true;
    (async () => {
      for (let i = 0; i < 4; i++) {
        const { data, error: err } = await supabase.from("profiles").select("*").eq("id", uid).maybeSingle();
        if (!active) return;
        if (data) {
          setProfile(data);
          setProfileError("");
          setPeople((p) => ({ ...p, [data.id]: data }));
          return;
        }
        if (err) setProfileError(err.message);
        await new Promise((r) => setTimeout(r, 800));
      }
      if (active) setProfileError((prev) => prev || "Profilmu belum dibuat. Pastikan skrip SQL grup sudah dijalankan di Supabase.");
    })();
    return () => {
      active = false;
    };
  }, [supabase, uid]);

  // Ambil profil penulis & reaksi untuk sekumpulan pesan.
  const hydrate = useCallback(
    async (list) => {
      if (!supabase || !list.length) return;
      const missing = [...new Set(list.map((m) => m.user_id))].filter((id) => !peopleRef.current[id]);
      if (missing.length) {
        const { data } = await supabase
          .from("profiles")
          .select("id,display_name,avatar_url,role,banned,muted_until")
          .in("id", missing);
        if (data) {
          setPeople((p) => {
            const n = { ...p };
            data.forEach((x) => (n[x.id] = x));
            return n;
          });
        }
      }
      const ids = list.map((m) => m.id);
      const { data: rs } = await supabase.from("reactions").select("message_id,user_id,emoji").in("message_id", ids);
      if (rs) {
        setReactions((prev) => {
          const n = { ...prev };
          ids.forEach((id) => (n[id] = []));
          rs.forEach((r) => n[r.message_id].push({ user_id: r.user_id, emoji: r.emoji }));
          return n;
        });
      }
    },
    [supabase]
  );

  // ---- Pesan awal ----
  useEffect(() => {
    if (!supabase || !ready) {
      setLoaded(false);
      return undefined;
    }
    let active = true;
    (async () => {
      const { data, error: err } = await supabase
        .from("messages")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(PAGE_SIZE);
      if (!active) return;
      if (err) {
        setLoadError(err.message);
        return;
      }
      const list = (data || []).reverse();
      stickRef.current = true;
      setMessages(list);
      setHasMore((data || []).length === PAGE_SIZE);
      await hydrate(list);
      if (active) {
        setLoadError("");
        setLoaded(true);
      }
    })();
    return () => {
      active = false;
    };
  }, [supabase, ready, hydrate]);

  // ---- Perubahan data realtime ----
  useEffect(() => {
    if (!supabase || !ready) return undefined;
    const channel = supabase
      .channel("grup-db")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, ({ new: row }) => {
        setMessages((list) => (list.some((m) => m.id === row.id) ? list : [...list, row]));
        if (!stickRef.current && row.user_id !== uid) setNewCount((c) => c + 1);
        hydrate([row]);
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "messages" }, ({ new: row }) => {
        setMessages((list) => list.map((m) => (m.id === row.id ? { ...m, ...row } : m)));
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "reactions" }, ({ new: r }) => {
        setReactions((prev) => {
          const cur = prev[r.message_id] || [];
          if (cur.some((x) => x.user_id === r.user_id && x.emoji === r.emoji)) return prev;
          return { ...prev, [r.message_id]: [...cur, { user_id: r.user_id, emoji: r.emoji }] };
        });
      })
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "reactions" }, ({ old: r }) => {
        setReactions((prev) => ({
          ...prev,
          [r.message_id]: (prev[r.message_id] || []).filter((x) => !(x.user_id === r.user_id && x.emoji === r.emoji)),
        }));
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "group_settings" }, ({ new: row }) =>
        setSettings(row)
      )
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "profiles" }, ({ new: row }) => {
        setPeople((p) => ({ ...p, [row.id]: { ...p[row.id], ...row } }));
        if (row.id === uid) setProfile((cur) => ({ ...cur, ...row }));
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, ready, uid, hydrate]);

  // ---- Presence (online) + indikator mengetik ----
  useEffect(() => {
    if (!supabase || !ready) return undefined;
    const channel = supabase.channel("grup-live", { config: { presence: { key: uid }, broadcast: { self: false } } });
    channel
      .on("presence", { event: "sync" }, () => setOnline(Object.keys(channel.presenceState())))
      .on("broadcast", { event: "typing" }, ({ payload }) => {
        if (!payload?.id || payload.id === uid) return;
        setTyping((t) => ({ ...t, [payload.id]: Date.now() + 3500 }));
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") await channel.track({ at: Date.now() });
      });
    liveRef.current = channel;
    return () => {
      liveRef.current = null;
      supabase.removeChannel(channel);
    };
  }, [supabase, ready, uid]);

  // Buang status "sedang mengetik" yang sudah kedaluwarsa.
  useEffect(() => {
    const timer = setInterval(() => {
      setTyping((t) => {
        const now = Date.now();
        const keep = Object.entries(t).filter(([, until]) => until > now);
        return keep.length === Object.keys(t).length ? t : Object.fromEntries(keep);
      });
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Hitung mundur jeda mode lambat.
  useEffect(() => {
    if (cooldownLeft <= 0) return undefined;
    const timer = setInterval(() => {
      setCooldownLeft(Math.max(0, Math.ceil((cooldownUntil.current - Date.now()) / 1000)));
    }, 250);
    return () => clearInterval(timer);
  }, [cooldownLeft]);

  // ---- Pesan yang disematkan ----
  const pinnedId = settings?.pinned_message_id || null;
  useEffect(() => {
    if (!supabase || !ready || !pinnedId) {
      setPinnedMsg(null);
      return undefined;
    }
    const local = messages.find((m) => m.id === pinnedId);
    if (local) {
      setPinnedMsg(local);
      return undefined;
    }
    let active = true;
    supabase
      .from("messages")
      .select("*")
      .eq("id", pinnedId)
      .maybeSingle()
      .then(({ data }) => {
        if (active && data) {
          setPinnedMsg(data);
          hydrate([data]);
        }
      });
    return () => {
      active = false;
    };
  }, [supabase, ready, pinnedId, messages, hydrate]);

  // ---- Scroll ----
  useIsoLayoutEffect(() => {
    const el = listRef.current;
    if (!el) return;
    if (prependRef.current) {
      el.scrollTop = el.scrollHeight - prependRef.current.h + prependRef.current.t;
      prependRef.current = null;
    } else if (stickRef.current) {
      el.scrollTop = el.scrollHeight;
      setNewCount(0);
    }
  }, [messages, loaded]);

  function handleScroll() {
    const el = listRef.current;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
    stickRef.current = atBottom;
    if (atBottom) setNewCount(0);
  }

  function jumpToBottom() {
    const el = listRef.current;
    if (!el) return;
    stickRef.current = true;
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
    setNewCount(0);
  }

  async function loadOlder() {
    if (loadingOlder || !messages.length) return;
    setLoadingOlder(true);
    const { data, error: err } = await supabase
      .from("messages")
      .select("*")
      .lt("created_at", messages[0].created_at)
      .order("created_at", { ascending: false })
      .limit(PAGE_SIZE);
    if (!err) {
      const older = (data || []).reverse();
      const el = listRef.current;
      if (el) prependRef.current = { h: el.scrollHeight, t: el.scrollTop };
      setMessages((list) => [...older.filter((o) => !list.some((m) => m.id === o.id)), ...list]);
      setHasMore((data || []).length === PAGE_SIZE);
      await hydrate(older);
    }
    setLoadingOlder(false);
  }

  // ---- Aksi ----
  const blockReason = sendBlockReason(profile, settings);

  async function handleSend(e) {
    e?.preventDefault();
    const content = text.trim();
    if (!content || sending || blockReason || cooldownLeft > 0) return;
    setSending(true);
    setError("");
    const { data, error: err } = await supabase
      .from("messages")
      .insert({ content: content.slice(0, MAX_MESSAGE), reply_to: replyTo?.id || null })
      .select()
      .single();
    setSending(false);
    if (err) {
      setError(
        err.code === "42501" || /row-level security/i.test(err.message || "")
          ? "Pesan ditolak. Mungkin terlalu cepat, kamu sedang dibisukan, atau grup sedang hanya-admin."
          : err.message || "Gagal mengirim pesan."
      );
      return;
    }
    stickRef.current = true;
    setMessages((list) => (list.some((m) => m.id === data.id) ? list : [...list, data]));
    setText("");
    setReplyTo(null);
    if (inputRef.current) inputRef.current.style.height = "auto";
    const gap = isAdminMe ? 0 : Math.max(settings?.slow_mode_seconds || 0, 1);
    if (gap > 0) {
      cooldownUntil.current = Date.now() + gap * 1000;
      setCooldownLeft(gap);
    }
  }

  function handleChange(e) {
    const el = e.target;
    setText(el.value.slice(0, MAX_MESSAGE));
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 112)}px`;
    const now = Date.now();
    if (liveRef.current && el.value && now - lastTypingSent.current > TYPING_SEND_GAP_MS) {
      lastTypingSent.current = now;
      liveRef.current.send({ type: "broadcast", event: "typing", payload: { id: uid } });
    }
  }

  function handleKeyDown(e) {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      handleSend();
    }
  }

  async function toggleReaction(m, emoji) {
    const mine = (reactions[m.id] || []).some((r) => r.user_id === uid && r.emoji === emoji);
    setReactions((prev) => {
      const cur = prev[m.id] || [];
      return {
        ...prev,
        [m.id]: mine
          ? cur.filter((r) => !(r.user_id === uid && r.emoji === emoji))
          : [...cur, { user_id: uid, emoji }],
      };
    });
    setMenuId(null);
    const { error: err } = mine
      ? await supabase.from("reactions").delete().match({ message_id: m.id, user_id: uid, emoji })
      : await supabase.from("reactions").insert({ message_id: m.id, emoji });
    if (err) setError(err.message || "Gagal memberi reaksi.");
  }

  async function deleteMessage(m) {
    setMenuId(null);
    const { error: err } = await supabase.from("messages").update({ deleted_at: new Date().toISOString() }).eq("id", m.id);
    if (err) setError(err.message || "Gagal menghapus pesan.");
    else setMessages((list) => list.map((x) => (x.id === m.id ? { ...x, deleted_at: new Date().toISOString(), content: "" } : x)));
  }

  async function togglePin(m) {
    setMenuId(null);
    const next = pinnedId === m.id ? null : m.id;
    const { error: err } = await supabase.from("group_settings").update({ pinned_message_id: next }).eq("id", 1);
    if (err) setError(err.message || "Gagal menyematkan pesan.");
    else setSettings((s) => ({ ...s, pinned_message_id: next }));
  }

  function startReply(m) {
    setReplyTo(m);
    setMenuId(null);
    inputRef.current?.focus();
  }

  const signInWithGoogle = () =>
    supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo: `${window.location.origin}/grup` } });
  const signOut = async () => {
    setShowInfo(false);
    await supabase.auth.signOut();
  };

  const items = useMemo(() => groupMessages(messages), [messages]);
  const msgById = useMemo(() => Object.fromEntries(messages.map((m) => [m.id, m])), [messages]);
  const typingNames = Object.keys(typing)
    .filter((id) => id !== uid)
    .map((id) => people[id]?.display_name)
    .filter(Boolean);

  // ---------- Tampilan ----------
  if (!supabase) {
    return (
      <StateCard>
        <h2 className="font-display text-lg font-semibold text-white">Grup chat belum aktif</h2>
        <p className="mt-2 text-sm text-white/60">Layanan grup belum disambungkan. Kembali lagi nanti ya.</p>
      </StateCard>
    );
  }

  if (session === undefined) {
    return (
      <StateCard>
        <Loader2 className="mx-auto animate-spin text-white/60" />
      </StateCard>
    );
  }

  if (!session) {
    return (
      <StateCard>
        <h2 className="font-display text-xl font-semibold text-white">{settings?.name || "Grup KOYEN"}</h2>
        {settings?.description && <p className="mx-auto mt-2 max-w-sm text-sm text-white/60">{settings.description}</p>}
        <button
          type="button"
          onClick={signInWithGoogle}
          className="mx-auto mt-5 flex items-center gap-2 rounded-xl bg-signal-500 px-6 py-3 text-sm font-semibold text-ink-950 transition-transform hover:scale-[1.02]"
        >
          <LogIn size={18} />
          Masuk dengan Google
        </button>
        <p className="mx-auto mt-4 max-w-sm text-xs leading-relaxed text-white/40">
          Yang tampil di grup hanya nama depan dan foto profil Google-mu. Email tidak ditampilkan ke anggota lain.
        </p>
      </StateCard>
    );
  }

  if (profileError && !profile) {
    return (
      <StateCard>
        <p className="text-sm text-flare-400">{profileError}</p>
        <button type="button" onClick={signOut} className="mt-4 rounded-xl border border-white/15 px-4 py-2 text-sm text-white">
          Keluar
        </button>
      </StateCard>
    );
  }

  if (!profile) {
    return (
      <StateCard>
        <Loader2 className="mx-auto animate-spin text-white/60" />
      </StateCard>
    );
  }

  if (profile.banned) {
    return (
      <StateCard>
        <h2 className="font-display text-lg font-semibold text-white">Akunmu diblokir</h2>
        <p className="mt-2 text-sm text-white/60">Kamu tidak bisa membaca atau mengirim pesan di grup ini.</p>
        <button type="button" onClick={signOut} className="mt-4 rounded-xl border border-white/15 px-4 py-2 text-sm text-white">
          Keluar
        </button>
      </StateCard>
    );
  }

  return (
    <div className="flex h-[calc(100dvh-15rem)] min-h-[480px] flex-col overflow-hidden rounded-2xl border border-white/10 bg-ink-900/60">
      {/* Header grup */}
      <div className="flex items-center gap-3 border-b border-white/10 px-4 py-3">
        <Avatar person={{ display_name: settings?.name || "G", avatar_url: settings?.avatar_url }} size={40} />
        <div className="min-w-0 flex-1">
          <h2 className="truncate font-display text-base font-semibold text-white">{settings?.name || "Grup KOYEN"}</h2>
          <p className="flex items-center gap-1 text-xs text-white/50">
            <Users size={12} />
            {online.length} online
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowInfo(true)}
          aria-label="Info grup"
          className="grid h-9 w-9 place-items-center rounded-full text-white/60 hover:bg-white/10 hover:text-white"
        >
          <Info size={20} />
        </button>
      </div>

      {/* Pesan yang disematkan */}
      {pinnedMsg && !pinnedMsg.deleted_at && (
        <div className="flex items-center gap-2 border-b border-white/10 bg-white/5 px-4 py-2 text-xs">
          <Pin size={13} className="flex-shrink-0 text-signal-400" />
          <span className="min-w-0 flex-1 truncate text-white/70">
            <span className="font-semibold text-white">{people[pinnedMsg.user_id]?.display_name || "Anggota"}: </span>
            {snippet(pinnedMsg.content, 90)}
          </span>
        </div>
      )}

      {/* Daftar pesan */}
      <div className="relative flex-1 overflow-hidden">
        <div ref={listRef} onScroll={handleScroll} className="h-full overflow-y-auto px-3 py-3">
          {!loaded && !loadError && (
            <div className="grid h-full place-items-center">
              <Loader2 className="animate-spin text-white/50" />
            </div>
          )}
          {loadError && <p className="py-6 text-center text-sm text-flare-400">{loadError}</p>}

          {loaded && hasMore && (
            <button
              type="button"
              onClick={loadOlder}
              disabled={loadingOlder}
              className="mx-auto mb-2 flex items-center gap-1.5 rounded-full border border-white/15 px-3 py-1 text-xs text-white/70 hover:bg-white/10 disabled:opacity-60"
            >
              {loadingOlder && <Loader2 size={12} className="animate-spin" />}
              Muat pesan sebelumnya
            </button>
          )}

          {loaded && messages.length === 0 && (
            <p className="py-10 text-center text-sm text-white/40">Belum ada pesan. Jadilah yang pertama menyapa!</p>
          )}

          {items.map((it) =>
            it.type === "day" ? (
              <div key={it.key} className="my-3 flex justify-center">
                <span className="rounded-full bg-white/10 px-3 py-1 text-xs text-white/60">{it.label}</span>
              </div>
            ) : (
              <MessageRow
                key={it.key}
                item={it}
                uid={uid}
                author={people[it.msg.user_id]}
                reactions={reactions[it.msg.id]}
                replied={it.msg.reply_to ? msgById[it.msg.reply_to] : null}
                repliedAuthor={it.msg.reply_to && msgById[it.msg.reply_to] ? people[msgById[it.msg.reply_to].user_id] : null}
                menuOpen={menuId === it.msg.id}
                isAdminMe={isAdminMe}
                pinned={pinnedId === it.msg.id}
                onToggleMenu={() => setMenuId((cur) => (cur === it.msg.id ? null : it.msg.id))}
                onReact={(emoji) => toggleReaction(it.msg, emoji)}
                onReply={() => startReply(it.msg)}
                onDelete={() => deleteMessage(it.msg)}
                onPin={() => togglePin(it.msg)}
              />
            )
          )}
        </div>

        {newCount > 0 && (
          <button
            type="button"
            onClick={jumpToBottom}
            className="absolute bottom-3 right-3 flex items-center gap-1.5 rounded-full bg-signal-500 px-3 py-1.5 text-xs font-semibold text-ink-950 shadow-lg"
          >
            <ArrowDown size={14} />
            {newCount} pesan baru
          </button>
        )}
      </div>

      {typingNames.length > 0 && (
        <p className="px-4 pb-1 text-xs italic text-white/50">
          {typingNames.slice(0, 2).join(", ")} sedang mengetik...
        </p>
      )}

      {/* Penulis pesan */}
      <div className="border-t border-white/10 p-3">
        {error && (
          <p className="mb-2 flex items-start gap-2 rounded-xl border border-flare-500/30 bg-flare-500/10 px-3 py-2 text-xs text-flare-400">
            <span className="min-w-0 flex-1">{error}</span>
            <button type="button" onClick={() => setError("")} aria-label="Tutup pesan error">
              <X size={14} />
            </button>
          </p>
        )}

        {replyTo && (
          <div className="mb-2 flex items-center gap-2 rounded-xl bg-white/5 px-3 py-2 text-xs">
            <Reply size={14} className="flex-shrink-0 text-signal-400" />
            <span className="min-w-0 flex-1 truncate text-white/70">
              Membalas <span className="font-semibold text-white">{people[replyTo.user_id]?.display_name || "Anggota"}</span>:{" "}
              {snippet(replyTo.content, 60)}
            </span>
            <button type="button" onClick={() => setReplyTo(null)} aria-label="Batal membalas">
              <X size={14} />
            </button>
          </div>
        )}

        {blockReason ? (
          <p className="rounded-xl bg-white/5 px-4 py-3 text-center text-sm text-white/60">{blockReason}</p>
        ) : (
          <>
            <form onSubmit={handleSend} className="flex items-end gap-2">
              <textarea
                ref={inputRef}
                value={text}
                onChange={handleChange}
                onKeyDown={handleKeyDown}
                rows={1}
                maxLength={MAX_MESSAGE}
                placeholder="Tulis pesan..."
                aria-label="Tulis pesan"
                className="max-h-28 min-w-0 flex-1 resize-none rounded-2xl border border-white/10 bg-ink-950 px-4 py-2.5 text-base text-white placeholder:text-white/30 focus-ring"
              />
              <button
                type="submit"
                aria-label="Kirim"
                disabled={!text.trim() || sending || cooldownLeft > 0}
                className="grid h-11 w-11 flex-shrink-0 place-items-center rounded-full bg-signal-500 text-ink-950 disabled:opacity-50"
              >
                {sending ? <Loader2 size={18} className="animate-spin" /> : cooldownLeft > 0 ? <span className="text-xs font-bold">{cooldownLeft}</span> : <Send size={18} />}
              </button>
            </form>
            {!isAdminMe && (settings?.slow_mode_seconds || 0) > 0 && (
              <p className="mt-1.5 text-center text-[11px] text-white/40">
                Mode lambat aktif: jeda {settings.slow_mode_seconds} detik antar pesan.
              </p>
            )}
          </>
        )}
      </div>

      {showInfo && (
        <GroupInfoSheet
          supabase={supabase}
          uid={uid}
          profile={profile}
          settings={settings}
          online={online}
          onClose={() => setShowInfo(false)}
          onSignOut={signOut}
          onProfileSaved={(row) => {
            setProfile((cur) => ({ ...cur, ...row }));
            setPeople((p) => ({ ...p, [row.id]: { ...p[row.id], ...row } }));
          }}
          onSettingsSaved={(row) => setSettings(row)}
        />
      )}
    </div>
  );
}
