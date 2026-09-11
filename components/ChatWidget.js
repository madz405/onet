"use client";

import { useEffect, useRef, useState } from "react";
import { X, Send, Loader2 } from "lucide-react";
import { CHAT_BOT_NAME } from "@/lib/chatPersona";

// Ganti logo bulat di tombol & header chat di sini. Cara paling gampang:
// 1) taruh file logo kamu di /public, misal /public/chat-logo.png
// 2) ganti isi <LogoBubble /> di bawah jadi:
//      <img src="/chat-logo.png" alt={CHAT_BOT_NAME} className="h-full w-full object-cover" />
function LogoBubble() {
  return (
    <span className="grid h-full w-full place-items-center bg-gradient-to-br from-signal-500 to-flare-500 font-display text-lg font-bold text-ink-950">
      {CHAT_BOT_NAME.charAt(0)}
    </span>
  );
}

export default function ChatWidget() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([
    { role: "bot", text: `Hai! Aku ${CHAT_BOT_NAME}, ada yang bisa dibantu seputar Unduhin? 👋` },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const listRef = useRef(null);

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
        body: JSON.stringify({ message: text }),
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
    <>
      {open && (
        <div className="fixed bottom-24 right-5 z-50 flex h-[min(70vh,32rem)] w-[min(92vw,22rem)] flex-col overflow-hidden rounded-3xl border border-white/10 bg-ink-900 shadow-glow animate-rise">
          <div className="flex items-center gap-3 border-b border-white/8 px-4 py-3">
            <span className="h-9 w-9 overflow-hidden rounded-full">
              <LogoBubble />
            </span>
            <div>
              <p className="text-sm font-semibold text-white">{CHAT_BOT_NAME}</p>
              <p className="text-xs text-white/40">Biasanya balas dalam beberapa detik</p>
            </div>
          </div>

          <div ref={listRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                <p
                  className={`max-w-[80%] rounded-2xl px-3.5 py-2 text-sm leading-snug ${
                    m.role === "user"
                      ? "rounded-br-sm bg-signal-500 text-ink-950"
                      : "rounded-bl-sm bg-white/8 text-white/90"
                  }`}
                >
                  {m.text}
                </p>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <span className="flex items-center gap-2 rounded-2xl rounded-bl-sm bg-white/8 px-3.5 py-2 text-sm text-white/60">
                  <Loader2 size={14} className="animate-spin" /> mengetik...
                </span>
              </div>
            )}
          </div>

          <form onSubmit={handleSend} className="flex items-center gap-2 border-t border-white/8 p-3">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Tulis pesan..."
              className="flex-1 rounded-full border border-white/10 bg-ink-950 px-4 py-2.5 text-sm text-white placeholder:text-white/30 focus-ring"
            />
            <button
              type="submit"
              disabled={loading}
              className="grid h-10 w-10 flex-shrink-0 place-items-center rounded-full bg-signal-500 text-ink-950 disabled:opacity-60"
              aria-label="Kirim"
            >
              <Send size={16} />
            </button>
          </form>
        </div>
      )}

      <button
        onClick={() => setOpen((v) => !v)}
        className="fixed bottom-5 right-5 z-50 h-14 w-14 overflow-hidden rounded-full shadow-glow transition-transform hover:scale-105 focus-ring animate-pulse-ring"
        aria-label={open ? "Tutup chat" : "Buka chat"}
      >
        {open ? (
          <span className="grid h-full w-full place-items-center bg-ink-800 text-white">
            <X size={22} />
          </span>
        ) : (
          <LogoBubble />
        )}
      </button>
    </>
  );
}
