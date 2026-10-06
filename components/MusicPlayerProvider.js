"use client";

// Pemutar musik global. <audio> dan seluruh state pemutaran tinggal di sini
// (dipasang di app/layout.js), BUKAN di MusicSection, supaya tidak ikut
// ter-unmount saat user pindah halaman lewat navbar (navigasi client-side
// Next.js mempertahankan layout, jadi lagu tetap jalan terus).
// MusicSection (halaman /musik) dan MiniPlayer (halaman downloader & tools)
// sama-sama membaca state ini lewat useMusicPlayer().

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import {
  loadMusicHistory,
  addToMusicHistory,
  removeFromMusicHistory,
  updateMusicHistoryItem,
} from "@/lib/musicHistory";

const MusicPlayerContext = createContext(null);

// Urutan siklus tombol mode tiap diklik.
const NEXT_MODE = { sequential: "repeat", repeat: "shuffle", shuffle: "sequential" };

// Kata pencarian untuk mengambil ulang link lagu: judul + artis (kalau judul
// belum memuat nama artisnya), lalu query asli user sebagai cadangan.
function refreshQueries(t) {
  const title = (t.title || "").trim();
  const artist = (t.artist || "").trim();
  const withArtist =
    artist && !title.toLowerCase().includes(artist.toLowerCase()) ? `${title} ${artist}` : title;
  return [withArtist, t.query].filter((q, i, arr) => q && arr.indexOf(q) === i);
}

async function fetchFreshStream(t) {
  for (const q of refreshQueries(t)) {
    try {
      const res = await fetch("/api/music", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source: t.source, query: q }),
      });
      const data = await res.json();
      if (data?.status && data.streamUrl) return data;
    } catch {
      // coba query berikutnya
    }
  }
  return null;
}

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
  const [refreshing, setRefreshing] = useState(false);
  const audioRef = useRef(null);
  // id lagu yang sudah dicoba diperbarui linknya (maksimal sekali per putaran,
  // supaya tidak berulang-ulang kalau memang gagal).
  const retriedRef = useRef(null);

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
    retriedRef.current = null;
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

  // Dipakai tombol (X) di MiniPlayer: hentikan lagu sepenuhnya dan sembunyikan
  // mini player (mini player hanya tampil selama ada `track`).
  const stopPlayback = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    setIsPlaying(false);
    setTrack(null);
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

  // Link lagu gagal diputar (biasanya kedaluwarsa): ambil link baru dari judul
  // + artis, simpan ke riwayat, lalu putar ulang otomatis.
  async function handleAudioError() {
    if (!track) return;
    if (retriedRef.current === track.id) {
      setRefreshing(false);
      setPlaybackError("Link lagu ini sudah tidak bisa diputar dan gagal diperbarui. Coba cari ulang.");
      return;
    }
    retriedRef.current = track.id;
    const current = track;
    setPlaybackError("");
    setRefreshing(true);
    const fresh = await fetchFreshStream(current);
    setRefreshing(false);
    if (!fresh) {
      setPlaybackError("Link lagu ini sudah kedaluwarsa dan gagal diperbarui. Coba cari ulang.");
      return;
    }
    const updated = {
      ...current,
      streamUrl: fresh.streamUrl,
      thumbnail: fresh.thumbnail || current.thumbnail,
      resolvedAt: Date.now(),
    };
    setHistory((h) => updateMusicHistoryItem(h, updated));
    // Hanya ganti kalau user belum pindah ke lagu lain selama menunggu.
    setTrack((prev) => (prev && prev.id === current.id ? updated : prev));
  }

  // Diabaikan otomatis di browser yang tidak mendukung.
  const hasMediaSession = typeof navigator !== "undefined" && "mediaSession" in navigator;

  // Posisi/durasi untuk progress bar di layar kunci. Cukup dipanggil saat state
  // berubah (play, pause, seek, metadata siap), bukan tiap detik.
  const syncPositionState = useCallback(() => {
    const el = audioRef.current;
    if (!hasMediaSession || !el || !navigator.mediaSession.setPositionState) return;
    if (!Number.isFinite(el.duration) || el.duration <= 0) return;
    try {
      navigator.mediaSession.setPositionState({
        duration: el.duration,
        playbackRate: el.playbackRate || 1,
        position: Math.min(el.currentTime, el.duration),
      });
    } catch {
      // Nilai tidak valid sesaat saat ganti lagu — abaikan.
    }
  }, [hasMediaSession]);

  const seek = useCallback(
    (val) => {
      if (audioRef.current) audioRef.current.currentTime = val;
      setProgress(val);
      syncPositionState();
    },
    [syncPositionState]
  );

  const cycleMode = useCallback(() => setPlayMode((m) => NEXT_MODE[m]), []);

  // ---- Media Session API: kontrol di notifikasi & layar kunci HP ----
  // 1) Judul, artis, dan cover. Cover lewat /api/artwork supaya same-origin.
  useEffect(() => {
    if (!hasMediaSession) return;
    if (!track) {
      navigator.mediaSession.metadata = null;
      navigator.mediaSession.playbackState = "none";
      return;
    }
    const src = track.thumbnail ? `/api/artwork?url=${encodeURIComponent(track.thumbnail)}` : null;
    try {
      navigator.mediaSession.metadata = new window.MediaMetadata({
        title: track.title || "",
        artist: track.artist || "",
        album: track.album || "KOYEN Musik",
        artwork: src
          ? [96, 128, 192, 256, 384, 512].map((n) => ({ src, sizes: `${n}x${n}` }))
          : [],
      });
    } catch {
      // MediaMetadata tidak tersedia — abaikan.
    }
  }, [hasMediaSession, track?.id, track?.title, track?.artist, track?.thumbnail]); // eslint-disable-line react-hooks/exhaustive-deps

  // 2) Status putar/jeda, supaya ikon di notifikasi selalu sinkron.
  useEffect(() => {
    if (!hasMediaSession || !track) return;
    navigator.mediaSession.playbackState = isPlaying ? "playing" : "paused";
    syncPositionState();
  }, [hasMediaSession, track, isPlaying, syncPositionState]);

  // 3) Tombol di notifikasi/layar kunci.
  useEffect(() => {
    if (!hasMediaSession || !track) return;
    const canSkip = history.length > 1;
    const handlers = {
      play: () => audioRef.current?.play().catch(() => {}),
      pause: () => audioRef.current?.pause(),
      previoustrack: canSkip ? () => playByOffset(-1) : null,
      nexttrack: canSkip ? () => playByOffset(1) : null,
      seekto: (d) => {
        if (typeof d?.seekTime === "number") seek(d.seekTime);
      },
      stop: () => stopPlayback(),
    };
    for (const [action, fn] of Object.entries(handlers)) {
      try {
        navigator.mediaSession.setActionHandler(action, fn);
      } catch {
        // Sebagian browser tidak mendukung action tertentu — abaikan.
      }
    }
  }, [hasMediaSession, track, history.length, playByOffset, seek, stopPlayback]);

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
      refreshing,
      setVolume,
      playTrack,
      addAndPlay,
      removeFromHistory,
      togglePlay,
      stopPlayback,
      playByOffset,
      seek,
      cycleMode,
    }),
    [
      track, history, playMode, isPlaying, progress, duration, volume, playbackError, refreshing,
      playTrack, addAndPlay, removeFromHistory, togglePlay, stopPlayback, playByOffset, seek, cycleMode,
    ]
  );

  return (
    <MusicPlayerContext.Provider value={value}>
      {children}
      {track && (
        <audio
          ref={audioRef}
          src={track.streamUrl}
          onPlay={() => {
            setIsPlaying(true);
            syncPositionState();
          }}
          onPause={() => {
            setIsPlaying(false);
            syncPositionState();
          }}
          onSeeked={syncPositionState}
          onTimeUpdate={(e) => setProgress(e.currentTarget.currentTime)}
          onLoadedMetadata={(e) => {
            setDuration(e.currentTarget.duration);
            syncPositionState();
          }}
          onEnded={handleEnded}
          onError={handleAudioError}
        />
      )}
    </MusicPlayerContext.Provider>
  );
}
