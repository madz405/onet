"use client";

// Pemutar musik global. <audio> dan seluruh state pemutaran tinggal di sini
// (dipasang di app/layout.js), BUKAN di MusicSection, supaya tidak ikut
// ter-unmount saat user pindah halaman lewat navbar (navigasi client-side
// Next.js mempertahankan layout, jadi lagu tetap jalan terus).
// MusicSection (halaman /musik) dan MiniPlayer (halaman downloader & tools)
// sama-sama membaca state ini lewat useMusicPlayer().

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { loadMusicHistory, addToMusicHistory, removeFromMusicHistory } from "@/lib/musicHistory";

const MusicPlayerContext = createContext(null);

// Urutan siklus tombol mode tiap diklik.
const NEXT_MODE = { sequential: "repeat", repeat: "shuffle", shuffle: "sequential" };

export function useMusicPlayer() {
  const ctx = useContext(MusicPlayerContext);
  if (!ctx) throw new Error("useMusicPlayer harus dipakai di dalam <MusicPlayerProvider>");
  return ctx;
}

export default function MusicPlayerProvider({ children }) {
  const [track, setTrack] = useState(null);
  const [history, setHistory] = useState([]);
  const [playMode, setPlayMode] = useState("sequential"); // sequential | repeat | shuffle
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [playbackError, setPlaybackError] = useState("");
  const audioRef = useRef(null);

  // Muat riwayat tersimpan begitu situs dibuka (termasuk setelah refresh).
  useEffect(() => {
    setHistory(loadMusicHistory());
  }, []);

  // Otomatis putar tiap kali lagu berganti.
  useEffect(() => {
    if (!track) return;
    setProgress(0);
    setIsPlaying(true);
    const t = setTimeout(() => audioRef.current?.play().catch(() => {}), 50);
    return () => clearTimeout(t);
  }, [track]);

  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = volume;
  }, [volume]);

  const playTrack = useCallback((t) => {
    setPlaybackError("");
    setTrack(t);
  }, []);

  // Dipakai MusicSection setelah pencarian berhasil: simpan ke riwayat + putar.
  const addAndPlay = useCallback(
    (t) => {
      setHistory((h) => addToMusicHistory(h, t));
      playTrack(t);
    },
    [playTrack]
  );

  const removeFromHistory = useCallback((id) => {
    setHistory((h) => removeFromMusicHistory(h, id));
  }, []);

  const togglePlay = useCallback(() => {
    const el = audioRef.current;
    if (!el) return;
    if (el.paused) {
      el.play().catch(() => {});
    } else {
      el.pause();
    }
  }, []);

  const currentIndex = track ? history.findIndex((t) => t.id === track.id) : -1;

  const playByOffset = useCallback(
    (offset) => {
      if (!history.length) return;
      const base = currentIndex === -1 ? 0 : currentIndex;
      const nextIndex = (base + offset + history.length) % history.length;
      playTrack(history[nextIndex]);
    },
    [history, currentIndex, playTrack]
  );

  function playRandom() {
    if (!history.length) return;
    if (history.length === 1) return playTrack(history[0]);
    let idx = Math.floor(Math.random() * history.length);
    while (idx === currentIndex) idx = Math.floor(Math.random() * history.length);
    playTrack(history[idx]);
  }

  function handleEnded() {
    if (playMode === "repeat") {
      if (audioRef.current) {
        audioRef.current.currentTime = 0;
        audioRef.current.play().catch(() => {});
      }
      return;
    }
    if (playMode === "shuffle") return playRandom();
    // sequential: lanjut ke item berikutnya di riwayat, berhenti kalau sudah di ujung.
    if (currentIndex > -1 && currentIndex < history.length - 1) {
      playTrack(history[currentIndex + 1]);
    } else {
      setIsPlaying(false);
    }
  }

  const seek = useCallback((val) => {
    if (audioRef.current) audioRef.current.currentTime = val;
    setProgress(val);
  }, []);

  const cycleMode = useCallback(() => setPlayMode((m) => NEXT_MODE[m]), []);

  // Kontrol di notifikasi/lock screen HP (Media Session API), seperti
  // pemutar YouTube di screenshot contoh. Diabaikan di browser yang tidak mendukung.
  useEffect(() => {
    if (typeof navigator === "undefined" || !("mediaSession" in navigator) || !track) return;
    try {
      navigator.mediaSession.metadata = new window.MediaMetadata({
        title: track.title || "",
        artist: track.artist || "",
        artwork: track.thumbnail ? [{ src: track.thumbnail }] : [],
      });
      navigator.mediaSession.setActionHandler("play", () => audioRef.current?.play().catch(() => {}));
      navigator.mediaSession.setActionHandler("pause", () => audioRef.current?.pause());
      navigator.mediaSession.setActionHandler("previoustrack", history.length > 1 ? () => playByOffset(-1) : null);
      navigator.mediaSession.setActionHandler("nexttrack", history.length > 1 ? () => playByOffset(1) : null);
    } catch {
      // Sebagian browser melempar error untuk action tertentu — abaikan.
    }
  }, [track, history.length, playByOffset]);

  const value = useMemo(
    () => ({
      track,
      history,
      playMode,
      isPlaying,
      progress,
      duration,
      volume,
      playbackError,
      setVolume,
      playTrack,
      addAndPlay,
      removeFromHistory,
      togglePlay,
      playByOffset,
      seek,
      cycleMode,
    }),
    [
      track, history, playMode, isPlaying, progress, duration, volume, playbackError,
      playTrack, addAndPlay, removeFromHistory, togglePlay, playByOffset, seek, cycleMode,
    ]
  );

  return (
    <MusicPlayerContext.Provider value={value}>
      {children}
      {track && (
        <audio
          ref={audioRef}
          src={track.streamUrl}
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
          onTimeUpdate={(e) => setProgress(e.currentTarget.currentTime)}
          onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
          onEnded={handleEnded}
          onError={() => setPlaybackError("Link lagu ini sudah tidak bisa diputar, coba cari ulang.")}
        />
      )}
    </MusicPlayerContext.Provider>
  );
}
