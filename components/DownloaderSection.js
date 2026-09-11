"use client";

import { useState } from "react";
import { PLATFORMS } from "@/lib/platforms";
import PlatformCard from "@/components/PlatformCard";
import DownloaderModal from "@/components/DownloaderModal";

export default function DownloaderSection() {
  const [active, setActive] = useState(null);

  return (
    <>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {PLATFORMS.map((platform) => (
          <PlatformCard key={platform.id} platform={platform} onClick={() => setActive(platform)} />
        ))}
      </div>

      {active && <DownloaderModal platform={active} onClose={() => setActive(null)} />}
    </>
  );
}
