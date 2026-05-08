import { Badge } from "@/components/primitives/Badge";
import type { FairEvent } from "@/lib/server/odds/types";
import { confidenceTone } from "@/components/board/board-helpers";

export function ConfidenceBadge({ label }: { label: string }) {
  const tone = confidenceTone(label as FairEvent["confidenceLabel"]);
  return <Badge tone={tone}>{label}</Badge>;
}
