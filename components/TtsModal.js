"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Loader2, Download, Search } from "lucide-react";
import Modal from "@/components/Modal";
import { TTS_VOICES, TTS_MAX_CHARS, DEFAULT_TTS_VOICE, getVoice } from "@/lib/ttsVoices";

const FIELD =
  "w-full rounded-xl border border-white/10 bg-ink-950 px-4 py-3 text-sm text-white placeholder:text-white/30 focus-ring";

const GENDERS = [
  { value: "all", label: "Semua" },
  { value: "f", label: "Wanita" },
  { value: "m", label: "Pria" },
  { value: "n", label: "Netral" },
];

export default function TtsModal({ tool, onClose }) {
  const [text, setText] = useState("");
  const [voiceId, setVoiceId] = useState(DEFAULT_TTS_VOICE);
  const [gender, setGender] = useState("all");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [audioUrl, setAudioUrl] = useState(null);
  const urlRef = useRef(null);

  useEffect(
    () => () => {
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    },
    []
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return TTS_VOICES.filter((v) => {
      if (gender !== "all" && v.gender !== gender) return false;
      if (!q) return true;
      return `${v.name} ${v.desc}`.toLowerCase().includes(q);
    });
  }, [gender, query]);

  // Suara terpilih selalu tampil di dropdown walau tidak cocok dengan filter.
  const options = useMemo(() => {
    const selected = getVoice(voiceId);
    if (selected && !filtered.some((v) => v.id === voiceId)) return [selected, ...filtered];
    return filtered;
  }, [filtered, voiceId]);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!text.trim()) {
      setError("Tulis teks yang mau dibacakan dulu.");
      return;
    }
    setLoading(true);
    setError("");
    if (urlRef.current) {
      URL.revokeObjectURL(urlRef.current);
      urlRef.current = null;
    }
    setAudioUrl(null);
    try {
      const res = await fetch("/api/tools/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, voice: voiceId }),
      });
      const type = res.headers.get("content-type") || "";
      if (!res.ok || !type.startsWith("audio/")) {
        let message = "Gagal membuat suara.";
        try {
          const data = await res.json();
          message = data.message || message;
        } catch {
          // biarkan pesan default
        }
        throw new Error(message);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      urlRef.current = url;
      setAudioUrl(url);
    } catch (err) {
      setError(err.message || "Terjadi kesalahan.");
    } finally {
      setLoading(false);
    }
  }

  const voice = getVoice(voiceId);
  const fileName = `tts-${(voice?.name || "suara").toLowerCase().replace(/[^a-z0-9]+/g, "-")}.mp3`;

  return (
    <Modal title={tool.name} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <label className="mb-1.5 block text-xs font-medium text-white/50">Teks</label>
          <textarea
            required
            rows={4}
            maxLength={TTS_MAX_CHARS}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Tulis teks yang mau dibacakan..."
            className={FIELD}
          />
          <p className="mt-1 text-right text-xs text-white/40">
            {text.length}/{TTS_MAX_CHARS}
          </p>
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-medium text-white/50">
            Model suara ({filtered.length} dari {TTS_VOICES.length})
          </label>
          <div className="mb-2 flex flex-wrap gap-1.5">
            {GENDERS.map((g) => (
              <button
                key={g.value}
                type="button"
                onClick={() => setGender(g.value)}
                className={`rounded-full border px-3 py-1 text-xs transition-colors focus-ring ${
                  gender === g.value
                    ? "border-signal-500 bg-signal-500/15 text-white"
                    : "border-white/10 text-white/60 hover:border-white/30"
                }`}
              >
                {g.label}
              </button>
            ))}
          </div>
          <div className="relative mb-2">
            <Search size={14} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-white/40" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Cari nama atau gaya (mis. calm, narrator)"
              className={`${FIELD} pl-9`}
            />
          </div>
          <select value={voiceId} onChange={(e) => setVoiceId(e.target.value)} className={FIELD}>
            {options.map((v) => (
              <option key={v.id} value={v.id}>
                {v.no}. {v.name} — {v.desc} ({v.genderLabel})
              </option>
            ))}
          </select>
          {filtered.length === 0 && <p className="mt-1.5 text-xs text-white/40">Tidak ada suara yang cocok.</p>}
        </div>

        <button
          type="submit"
          disabled={loading}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-signal-500 px-4 py-3 text-sm font-semibold text-ink-950 transition-transform hover:scale-[1.01] disabled:opacity-50 disabled:hover:scale-100"
        >
          {loading && <Loader2 size={16} className="animate-spin" />}
          {loading ? "Memproses..." : "Buat suara"}
        </button>
      </form>

      {error && (
        <p className="mt-4 rounded-xl border border-flare-500/30 bg-flare-500/10 px-4 py-3 text-sm text-flare-400">
          {error}
        </p>
      )}

      {audioUrl && (
        <div className="mt-5 animate-rise space-y-3">
          <audio controls autoPlay src={audioUrl} className="w-full" />
          <a
            href={audioUrl}
            download={fileName}
            className="flex items-center justify-center gap-2 rounded-xl bg-signal-500 px-4 py-3 text-sm font-semibold text-ink-950 hover:scale-[1.01]"
          >
            <Download size={16} />
            Unduh MP3
          </a>
        </div>
      )}
    </Modal>
  );
}
