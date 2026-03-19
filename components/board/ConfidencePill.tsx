import type { FairEvent } from "@/lib/server/odds/types";
import { Pill } from "@/components/ui/Pill";
import { confidenceTone } from "@/components/board/board-helpers";

function displayLabel(label: FairEvent["confidenceLabel"]): string {
  if (label === "Limited Sharp Coverage") return "Active Market";
  return label;
}

export function ConfidencePill({ label }: { label: FairEvent["confidenceLabel"] }) {
  return <Pill tone={confidenceTone(label)}>{displayLabel(label)}</Pill>;
}
