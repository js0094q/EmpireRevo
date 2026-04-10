import { Badge } from "@/components/primitives/Badge";

export function ConfidenceBadge({ label }: { label: string }) {
  const tone = label === "High Confidence" ? "positive" : label === "Moderate Confidence" ? "neutral" : label === "Stale Market" ? "warning" : "danger";
  return <Badge tone={tone}>{label}</Badge>;
}
