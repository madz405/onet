"use client";

// Hook playlist: memegang daftar playlist untuk React dan membungkus fungsi di
// lib/musicPlaylists.js. Operasi dihitung dari ref (selalu terbaru) supaya hasil
// (error / added) bisa langsung dikembalikan ke pemanggil.

import { useCallback, useEffect, useRef, useState } from "react";
import * as pl from "@/lib/musicPlaylists";

export default function usePlaylists() {
  const [playlists, setPlaylists] = useState([]);
  const ref = useRef([]);

  useEffect(() => {
    const load = () => {
      const loaded = pl.loadPlaylists();
      ref.current = loaded;
      setPlaylists(loaded);
    };
    load();
    // Pemutar memperbarui sampul lagu di localStorage (updatePlaylistTrackThumbnail).
    window.addEventListener(pl.PLAYLISTS_CHANGED_EVENT, load);
    return () => window.removeEventListener(pl.PLAYLISTS_CHANGED_EVENT, load);
  }, []);

  const commit = useCallback((res) => {
    if (res.list) {
      ref.current = res.list;
      setPlaylists(res.list);
    }
    return res;
  }, []);

  return {
    playlists,
    create: useCallback((name, track) => commit(pl.createPlaylist(ref.current, name, track)), [commit]),
    importTracks: useCallback(
      (name, tracks, cover) => commit(pl.createImportedPlaylist(ref.current, name, tracks, cover)),
      [commit]
    ),
    rename: useCallback((id, name) => commit(pl.renamePlaylist(ref.current, id, name)), [commit]),
    remove: useCallback((id) => commit(pl.deletePlaylist(ref.current, id)), [commit]),
    addTrack: useCallback((id, track) => commit(pl.addTrackToPlaylist(ref.current, id, track)), [commit]),
    removeTrack: useCallback((id, trackId) => commit(pl.removeTrackFromPlaylist(ref.current, id, trackId)), [commit]),
    exportJson: useCallback(() => pl.exportPlaylists(ref.current), []),
    importJson: useCallback((text) => commit(pl.importPlaylists(ref.current, text)), [commit]),
  };
}
