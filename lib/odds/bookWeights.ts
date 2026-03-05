import type { BookRef, BookTier } from "./schemas";

type BookWeightConfig = {
  tier: BookTier;
  weight: number;
};

const defaults: BookWeightConfig = { tier: "unknown", weight: 1.0 };

const WEIGHTS: Record<string, BookWeightConfig> = {
  pinnacle: { tier: "sharp", weight: 1.9 },
  bookmaker: { tier: "sharp", weight: 1.7 },
  circa: { tier: "sharp", weight: 1.6 },
  draftkings: { tier: "mainstream", weight: 1.2 },
  fanduel: { tier: "mainstream", weight: 1.2 },
  betmgm: { tier: "mainstream", weight: 1.1 },
  caesars: { tier: "mainstream", weight: 1.1 },
  betrivers: { tier: "mainstream", weight: 1.0 },
  espnbet: { tier: "promo", weight: 0.9 },
  bovada: { tier: "promo", weight: 0.85 }
};

export function getBookRef(key: string, title: string): BookRef {
  const mapped = WEIGHTS[key] || defaults;
  return {
    key,
    title,
    tier: mapped.tier,
    weight: mapped.weight,
    isSharpWeighted: mapped.weight >= 1.5
  };
}
