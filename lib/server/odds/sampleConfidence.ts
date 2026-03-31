import type { SampleConfidenceTier } from "@/lib/server/odds/types";

type SampleConfidenceInput =
  | number
  | {
      sampleSize: number;
      settledSampleSize?: number;
      ciWidth?: number | null;
    };

function normalizeSampleSize(input: SampleConfidenceInput): number {
  if (typeof input === "number") {
    return Number.isFinite(input) ? Math.max(0, Math.floor(input)) : 0;
  }

  const settled = Number.isFinite(input.settledSampleSize) ? Math.max(0, Math.floor(Number(input.settledSampleSize))) : 0;
  const total = Number.isFinite(input.sampleSize) ? Math.max(0, Math.floor(input.sampleSize)) : 0;
  return settled > 0 ? settled : total;
}

function normalizeCiWidth(input: SampleConfidenceInput): number | null {
  if (typeof input === "number") return null;
  if (!Number.isFinite(input.ciWidth)) return null;
  return Math.max(0, Number(input.ciWidth));
}

export function confidenceTierForSampleSize(input: SampleConfidenceInput): SampleConfidenceTier {
  const size = normalizeSampleSize(input);
  const ciWidth = normalizeCiWidth(input);

  if (Number.isFinite(ciWidth)) {
    const width = Number(ciWidth);
    if (size >= 100 && width <= 0.12) return "high";
    if (size >= 40 && width <= 0.24) return "medium";
    if (width >= 0.35) return "low";
  }

  if (size >= 100) return "high";
  if (size >= 25) return "medium";
  return "low";
}
