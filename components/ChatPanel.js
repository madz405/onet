"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { Send, Loader2 } from "lucide-react";
import { CHAT_BOT_NAME } from "@/lib/chatPersona";
import { SITE_NAME, KAYNA_AVATAR } from "@/lib/site";

// Ganti logo bulat di header chat di lib/site.js (KAYNA_AVATAR) kalau perlu.
function LogoBubble() {
  return <Image src={KAYNA_AVATAR} alt={CHAT_BOT_NAME} width={40} height={40} className="h-full w-full object-cover" />;
}

// ID sesi persisten per pengunjung (disimpan di localStorage), dikirim ke
// /api/chat supaya fallback Logic Bell bisa mengingat percakapan lintas
// pesan. Kalau localStorage tidak tersedia, chat tetap jalan tanpa memori.
function getSessionId() {
  if (typeof window === "undefined") return null;
  try {
    const KEY = "koyen_chat_session_id";
    let id = localStorage.getItem(KEY);
    if (!id) {
      id =
        typeof crypto !== "undefined" && crypto.randomUUID
          ? crypto.randomUUID()
          : `web-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      localStorage.setItem(KEY, id);
    }
    return id;
  } catch {
    return null;
  }
}

export default function ChatPanel() {
  const [messages, setMessages] = useState([
    { role: "bot", text: `Hai! Aku ${CHAT_BOT_NAME}, ada yang bisa dibantu seputar ${SITE_NAME}? 👋` },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const listRef = useRef(null);
  const sessionIdRef = useRef(null);

  useEffect(() => {
    sessionIdRef.current = getSessionId();
  }, []);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  async function handleSend(e) {
    e.preventDefault();
    const text = input.trim();
    if (!text || loading) return;
    setMessages((m) => [...m, { role: "user", text }]);
    setInput("");
    setLoading(true);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, sessionId: sessionIdRef.current }),
      });
      const data = await res.json();
      setMessages((m) => [
        ...m,
        { role: "bot", text: data.status ? data.reply : data.message || "Maaf, gagal membalas." },
      ]);
    } catch {
      setMessages((m) => [...m, { role: "bot", text: "Koneksi lagi bermasalah, coba lagi ya." }]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex h-[70vh] min-h-[420px] flex-col overflow-hidden rounded-3xl border border-white/10 bg-ink-900">
      <div className="flex items-center gap-3 border-b border-white/8 px-5 py-4">
        <span className="h-10 w-10 flex-shrink-0 overflow-hidden rounded-full">
          <LogoBubble />
        </span>
        <div>
          <p className="text-sm font-semibold text-white">{CHAT_BOT_NAME}</p>
          <p className="text-xs text-white/40">Biasanya balas dalam beberapa detik</p>
        </div>
      </div>

      <div ref={listRef} className="flex-1 space-y-3 overflow-y-auto px-5 py-4">
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            <p
              className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-snug ${
                m.role === "user"
                  ? "rounded-br-sm bg-signal-500 text-ink-950"
                  : "rounded-bl-sm border border-white/10 bg-ink-800 text-white/90"
              }`}
            >
              {m.text}
            </p>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <span className="flex items-center gap-2 rounded-2xl rounded-bl-sm border border-white/10 bg-ink-800 px-4 py-2.5 text-sm text-white/60">
              <Loader2 size={14} className="animate-spin" /> mengetik...
            </span>
          </div>
        )}
      </div>

      <form onSubmit={handleSend} className="flex items-center gap-2 border-t border-white/8 p-4">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Tulis pesan..."
          className="flex-1 rounded-full border border-white/10 bg-ink-950 px-4 py-2.5 text-sm text-white placeholder:text-white/30 focus-ring"
        />
        <button
          type="submit"
          disabled={loading}
          className="grid h-11 w-11 flex-shrink-0 place-items-center rounded-full bg-signal-500 text-ink-950 disabled:opacity-60"
          aria-label="Kirim"
        >
          <Send size={18} />
        </button>
      </form>
    </div>
  );
}
