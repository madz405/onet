"use client";

// Menampilkan teks apa adanya (dipotong "...") kalau muat di lebar kotaknya,
// dan otomatis berjalan (marquee) kalau teksnya kepanjangan — dipakai untuk
// judul lagu di MiniPlayer dan halaman Musik supaya judul panjang tetap
// terbaca utuh, bukan cuma terpotong "...".
// Diukur ulang tiap kali teks atau lebar kotak berubah (mis. resize layar).

import { useEffect, useRef, useState } from "react";

export default function MarqueeText({ text, className = "" }) {
  const boxRef = useRef(null);
  const textRef = useRef(null);
  const [scrollInfo, setScrollInfo] = useState({ scroll: false, distance: 0 });

  useEffect(() => {
    const box = boxRef.current;
    const el = textRef.current;
    if (!box || !el) return;

    function measure() {
      const overflow = el.scrollWidth - box.clientWidth;
      setScrollInfo(overflow > 4 ? { scroll: true, distance: overflow + 24 } : { scroll: false, distance: 0 });
    }

    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(box);
    return () => ro.disconnect();
  }, [text]);

  return (
    <div ref={boxRef} className={`overflow-hidden whitespace-nowrap ${className}`}>
      <span
        ref={textRef}
        className="inline-block"
        style={
          scrollInfo.scroll
            ? {
                animation: `marquee-scroll ${Math.max(5, scrollInfo.distance / 25)}s ease-in-out infinite`,
                "--marquee-distance": `-${scrollInfo.distance}px`,
              }
            : undefined
        }
      >
        {text}
      </span>
    </div>
  );
}
