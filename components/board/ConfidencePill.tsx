import type { FairEvent } from "@/lib/server/odds/types";
import { Pill } from "@/components/ui/Pill";
import { confidenceTone } from "@/components/board/board-helpers";

export function ConfidencePill({ label }: { label: FairEvent["confidenceLabel"] }) {
  return <Pill tone={confidenceTone(label)}>{label}</Pill>;
}
