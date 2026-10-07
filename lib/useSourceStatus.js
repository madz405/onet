"use client";

import { useEffect, useState } from "react";

// Mengambil status sumber dari /api/status, diperbarui tiap 60 detik.
// Hasil: { instagram: "down", facebook: "unstable" } (hanya yang bermasalah).
export function useSourceStatus() {
  const [status, setStatus] = useState({});

  useEffect(() => {
    let alive = true;
    const load = () =>
      fetch("/api/status", { cache: "no-store" })
        .then((r) => r.json())
        .then((d) => alive && d?.platforms && setStatus(d.platforms))
        .catch(() => {});
    load();
    const id = setInterval(load, 60000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);

  return status;
}
