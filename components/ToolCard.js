"use client";

import * as Icons from "lucide-react";

export default function ToolCard({ tool, onClick }) {
  const Icon = Icons[tool.icon] || Icons.Wand2;
  return (
    <button
      onClick={onClick}
      className="group flex flex-col items-start gap-4 rounded-2xl border border-white/8 bg-ink-900/60 p-5 text-left transition-all hover:-translate-y-0.5 hover:border-white/20 hover:bg-ink-800/60 focus-ring animate-rise"
    >
      <span className="grid h-11 w-11 place-items-center rounded-xl bg-flare-500/15 text-flare-400">
        <Icon size={20} />
      </span>
      <span>
        <span className="block font-display text-base font-semibold text-white">{tool.name}</span>
        <span className="mt-1 block text-sm leading-snug text-white/50">{tool.hint}</span>
      </span>
    </button>
  );
}
