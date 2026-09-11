"use client";

import { useState } from "react";
import { TOOLS } from "@/lib/tools";
import ToolCard from "@/components/ToolCard";
import ToolModal from "@/components/ToolModal";

export default function ToolsSection() {
  const [active, setActive] = useState(null);

  return (
    <>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {TOOLS.map((tool) => (
          <ToolCard key={tool.id} tool={tool} onClick={() => setActive(tool)} />
        ))}
      </div>

      {active && <ToolModal tool={active} onClose={() => setActive(null)} />}
    </>
  );
}
