"use client";

import { useState } from "react";
import Image from "next/image";

export default function PlatformCard({ platform, onClick, status }) {
  const [logoFailed, setLogoFailed] = useState(false);
  const showLogo = Boolean(platform.logo) && !logoFailed;

  return (
    <button
      onClick={onClick}
      className="group relative flex flex-col items-start gap-4 rounded-2xl border border-white/8 bg-ink-900/60 p-5 text-left transition-all hover:-translate-y-0.5 hover:border-white/20 hover:bg-ink-800/60 focus-ring animate-rise"
    >
      {status && (
        <span
          className={`absolute right-4 top-4 h-2.5 w-2.5 rounded-full ${
            status === "down" ? "bg-flare-500" : "bg-amber-400"
          }`}
          title={status === "down" ? "Sedang gangguan" : "Sedang tidak stabil"}
          role="img"
          aria-label={status === "down" ? "Sedang gangguan" : "Sedang tidak stabil"}
        />
      )}
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
