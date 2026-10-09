"use client";

import { useState } from "react";
import { TOOLS } from "@/lib/tools";
import ToolCard from "@/components/ToolCard";
import ToolModal from "@/components/ToolModal";
import QrModal from "@/components/QrModal";
import UploaderModal from "@/components/UploaderModal";
import CompressModal from "@/components/CompressModal";
import PdfModal from "@/components/PdfModal";
import TtsModal from "@/components/TtsModal";

// Tool berjenis khusus punya modal sendiri; selain itu memakai ToolModal umum.
const CUSTOM_MODALS = {
  qr: QrModal,
  uploader: UploaderModal,
  compress: CompressModal,
  pdf: PdfModal,
  tts: TtsModal,
};

export default function ToolsSection() {
  const [active, setActive] = useState(null);

  return (
    <>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {TOOLS.map((tool) => (
          <ToolCard key={tool.id} tool={tool} onClick={() => setActive(tool)} />
        ))}
      </div>

      {active &&
        (() => {
          const Custom = CUSTOM_MODALS[active.kind];
          const close = () => setActive(null);
          return Custom ? <Custom tool={active} onClose={close} /> : <ToolModal tool={active} onClose={close} />;
        })()}
    </>
  );
}
