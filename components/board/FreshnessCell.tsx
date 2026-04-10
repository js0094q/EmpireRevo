import { Badge } from "@/components/primitives/Badge";

export function FreshnessCell({ updated, isStale }: { updated: string; isStale: boolean }) {
  return <Badge tone={isStale ? "warning" : "neutral"}>{isStale ? "Stale" : updated}</Badge>;
}
