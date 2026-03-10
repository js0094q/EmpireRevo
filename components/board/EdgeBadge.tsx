import { Pill } from "@/components/ui/Pill";
import { edgeTone } from "@/components/board/board-helpers";

export function EdgeBadge({ edgePct }: { edgePct: number }) {
  return <Pill tone={edgeTone(edgePct)}>Edge {edgePct.toFixed(2)}%</Pill>;
}
