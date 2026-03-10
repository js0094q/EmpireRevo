import type { SampleConfidenceTier } from "@/lib/server/odds/types";

export function confidenceTierForSampleSize(sampleSize: number): SampleConfidenceTier {
  const size = Number.isFinite(sampleSize) ? Math.max(0, Math.floor(sampleSize)) : 0;
  if (size >= 100) return "high";
  if (size >= 25) return "medium";
  return "low";
}
