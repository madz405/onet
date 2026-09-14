"use client";

import { useState } from "react";
import Image from "next/image";

export default function PlatformCard({ platform, onClick }) {
  const [logoFailed, setLogoFailed] = useState(false);
  const showLogo = Boolean(platform.logo) && !logoFailed;

  return (
    <button
      onClick={onClick}
      className="group flex flex-col items-start gap-4 rounded-2xl border border-white/8 bg-ink-900/60 p-5 text-left transition-all hover:-translate-y-0.5 hover:border-white/20 hover:bg-ink-800/60 focus-ring animate-rise"
    >
      <span
        className="grid h-11 w-11 place-items-center overflow-hidden rounded-xl text-sm font-bold text-ink-950"
        style={{ backgroundColor: platform.accent }}
      >
        {showLogo ? (
          <Image
            src={platform.logo}
            alt={platform.name}
            width={44}
            height={44}
            className="h-full w-full object-cover"
            onError={() => setLogoFailed(true)}
          />
        ) : (
          platform.mono
        )}
      </span>
      <span>
        <span className="block font-display text-base font-semibold text-white">{platform.name}</span>
        <span className="mt-1 block text-sm leading-snug text-white/50">{platform.hint}</span>
      </span>
    </button>
  );
}
