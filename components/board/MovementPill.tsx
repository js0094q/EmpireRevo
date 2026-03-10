import type { FairOutcome } from "@/lib/server/odds/types";
import { Pill } from "@/components/ui/Pill";
import { movementTone } from "@/components/board/board-helpers";

export function MovementPill({ outcome }: { outcome: FairOutcome }) {
  return <Pill tone={movementTone(outcome)}>{outcome.timingSignal.label}</Pill>;
}
