import type { FairEvent } from "@/lib/server/odds/types";
import { Pill } from "@/components/ui/Pill";
import { confidenceTone } from "@/components/board/board-helpers";

function displayLabel(label: FairEvent["confidenceLabel"]): string {
  if (label === "High Confidence") return "High";
  if (label === "Moderate Confidence") return "Medium";
  if (label === "Limited Sharp Coverage") return "Sharp: Low";
  if (label === "Thin Market") return "Thin market";
  if (label === "Stale Market") return "Stale";
  return label;
}

export function ConfidencePill({ label }: { label: FairEvent["confidenceLabel"] }) {
  return <Pill tone={confidenceTone(label)}>{displayLabel(label)}</Pill>;
}
