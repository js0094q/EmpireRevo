import type { FairEvent } from "@/lib/server/odds/types";
import { Pill } from "@/components/ui/Pill";
import { confidenceTone } from "@/components/board/board-helpers";

function displayLabel(label: FairEvent["confidenceLabel"]): string {
  return label;
}

export function ConfidencePill({ label }: { label: FairEvent["confidenceLabel"] }) {
  return <Pill tone={confidenceTone(label)}>{displayLabel(label)}</Pill>;
}
