"use client";

import { useState } from "react";
import { TOOLS } from "@/lib/tools";
import ToolCard from "@/components/ToolCard";
import ToolModal from "@/components/ToolModal";
import QrModal from "@/components/QrModal";
import UploaderModal from "@/components/UploaderModal";

export default function ToolsSection() {
  const [active, setActive] = useState(null);

  return (
    <>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {TOOLS.map((tool) => (
          <ToolCard key={tool.id} tool={tool} onClick={() => setActive(tool)} />
        ))}
      </div>

      {active?.kind === "qr" && <QrModal tool={active} onClose={() => setActive(null)} />}
      {active?.kind === "uploader" && <UploaderModal tool={active} onClose={() => setActive(null)} />}
      {active && active.kind !== "qr" && active.kind !== "uploader" && (
        <ToolModal tool={active} onClose={() => setActive(null)} />
      )}
    </>
  );
}
