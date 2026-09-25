"use client";

// Menampilkan teks apa adanya kalau muat di lebar kotaknya, dan berjalan
// terus-menerus ke kiri (seperti running text pada umumnya) kalau kepanjangan.
// Triknya: teks digandakan dua kali berdampingan lalu digeser -50% secara
// linear & infinite — begitu salinan pertama habis, salinan kedua (identik)
// sudah pas di posisi yang sama, jadi putarannya mulus tanpa lompatan/jeda.

import { useEffect, useRef, useState } from "react";

export default function MarqueeText({ text, className = "" }) {
  const boxRef = useRef(null);
  const textRef = useRef(null);
  const [scrollInfo, setScrollInfo] = useState({ scroll: false, width: 0 });

  useEffect(() => {
    const box = boxRef.current;
    const el = textRef.current;
    if (!box || !el) return;

    function measure() {
      const overflow = el.scrollWidth - box.clientWidth;
      setScrollInfo(overflow > 4 ? { scroll: true, width: el.scrollWidth } : { scroll: false, width: 0 });
    }

    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(box);
    return () => ro.disconnect();
  }, [text]);

  if (!scrollInfo.scroll) {
    return (
      <div ref={boxRef} className={`overflow-hidden whitespace-nowrap ${className}`}>
        <span ref={textRef} className="inline-block">
          {text}
        </span>
      </div>
    );
  }

  // ~40px per detik: konsisten pelan untuk teks pendek maupun panjang.
  const duration = Math.max(6, scrollInfo.width / 40);

  return (
    <div ref={boxRef} className={`overflow-hidden whitespace-nowrap ${className}`}>
      <div className="inline-flex w-max" style={{ animation: `marquee-scroll ${duration}s linear infinite` }}>
        <span ref={textRef} className="inline-block pr-12">
          {text}
        </span>
        <span className="inline-block pr-12" aria-hidden="true">
          {text}
        </span>
      </div>
    </div>
  );
}
