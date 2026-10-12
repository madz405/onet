"use client";

// Jendela "Tambah ke playlist": centang playlist mana saja tempat lagu ini
// berada (satu lagu boleh ada di banyak playlist), atau buat playlist baru.

import { useState } from "react";
import { Check, Plus } from "lucide-react";
import Modal from "@/components/Modal";
import { MAX_NAME } from "@/lib/musicPlaylists";

export default function AddToPlaylistModal({ song, pl, onClose }) {
  const [name, setName] = useState("");
  const [error, setError] = useState("");

  function toggle(p) {
    setError("");
    const inside = p.tracks.some((t) => t.id === song.id);
    const res = inside ? pl.removeTrack(p.id, song.id) : pl.addTrack(p.id, song);
    if (res.error) setError(res.error);
  }

  function handleCreate(e) {
    e.preventDefault();
    const res = pl.create(name, song);
    if (res.error) {
      setError(res.error);
      return;
    }
    setName("");
    setError("");
  }

  return (
    <Modal title="Tambah ke playlist" onClose={onClose}>
      <p className="-mt-3 mb-4 truncate text-sm text-white/50">
        {song.title}
        {song.artist ? ` - ${song.artist}` : ""}
      </p>

      {pl.playlists.length > 0 && (
        <div className="mb-4 space-y-2">
          {pl.playlists.map((p) => {
            const inside = p.tracks.some((t) => t.id === song.id);
            return (
              <button
                type="button"
                key={p.id}
                onClick={() => toggle(p)}
                aria-pressed={inside}
                className={`flex w-full items-center gap-3 rounded-xl border px-3 py-3 text-left transition-colors ${
                  inside ? "border-signal-500/40 bg-signal-500/5" : "border-white/10 hover:bg-white/5"
                }`}
              >
                <span
                  className={`grid h-6 w-6 flex-shrink-0 place-items-center rounded-md border ${
                    inside ? "border-signal-500 bg-signal-500 text-ink-950" : "border-white/25 text-transparent"
                  }`}
                >
                  <Check size={14} />
                </span>
                <span className="min-w-0 flex-1 truncate text-sm font-medium text-white">{p.name}</span>
                <span className="text-xs text-white/40">{p.tracks.length} lagu</span>
              </button>
            );
          })}
        </div>
      )}

      <form onSubmit={handleCreate} className="flex gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value.slice(0, MAX_NAME))}
          placeholder="Nama playlist baru"
          maxLength={MAX_NAME}
          aria-label="Nama playlist baru"
          className="min-w-0 flex-1 rounded-xl border border-white/10 bg-ink-950 px-4 py-3 text-base text-white placeholder:text-white/30 focus-ring"
        />
        <button
          type="submit"
          className="flex flex-shrink-0 items-center gap-1.5 rounded-xl bg-signal-500 px-4 py-3 text-sm font-semibold text-ink-950"
        >
          <Plus size={16} />
          Buat
        </button>
      </form>

      {error && (
        <p className="mt-3 rounded-xl border border-flare-500/30 bg-flare-500/10 px-4 py-2.5 text-sm text-flare-400">
          {error}
        </p>
      )}

      <button
        type="button"
        onClick={onClose}
        className="mt-5 w-full rounded-xl border border-white/15 px-4 py-3 text-sm font-medium text-white hover:bg-white/10"
      >
        Selesai
      </button>
    </Modal>
  );
}
