import type { BookRef, BookTier } from "@/lib/odds/schemas";

export type WeightModel = "equal" | "weighted" | "sharp";

type BookWeightProfile = {
  tier: BookTier;
  weighted: number;
  sharp: number;
};

export type BookWeightAudit = BookWeightProfile & {
  key: string;
  fallback: boolean;
};

const DEFAULT_PROFILE: BookWeightProfile = {
  tier: "unknown",
  weighted: 0.12,
  sharp: 0.06
};

const BOOK_PROFILES: Record<string, BookWeightProfile> = {
  // Market-making anchors
  pinnacle: { tier: "sharp", weighted: 1.0, sharp: 1.25 },
  circa: { tier: "sharp", weighted: 0.9, sharp: 1.15 },
  bookmaker: { tier: "sharp", weighted: 0.8, sharp: 1.05 },

  // High-signal / semi-sharp
  lowvig: { tier: "signal", weighted: 0.7, sharp: 0.9 },
  betonline: { tier: "signal", weighted: 0.65, sharp: 0.85 },
  cloudbet: { tier: "signal", weighted: 0.6, sharp: 0.8 },
  sportsbetting: { tier: "signal", weighted: 0.6, sharp: 0.8 },
  betanything: { tier: "signal", weighted: 0.6, sharp: 0.75 },

  // Major retail
  draftkings: { tier: "mainstream", weighted: 0.4, sharp: 0.25 },
  fanduel: { tier: "mainstream", weighted: 0.38, sharp: 0.25 },
  betmgm: { tier: "mainstream", weighted: 0.35, sharp: 0.22 },
  caesars: { tier: "mainstream", weighted: 0.34, sharp: 0.22 },
  betrivers: { tier: "mainstream", weighted: 0.32, sharp: 0.2 },
  pointsbet: { tier: "mainstream", weighted: 0.32, sharp: 0.2 },
  barstool: { tier: "mainstream", weighted: 0.3, sharp: 0.18 },

  // Promotional / recreational
  bovada: { tier: "promo", weighted: 0.18, sharp: 0.1 },
  espnbet: { tier: "promo", weighted: 0.2, sharp: 0.12 },
  betr: { tier: "promo", weighted: 0.16, sharp: 0.1 }
};

function resolveProfile(bookKey: string): BookWeightProfile {
  const key = bookKey.toLowerCase().trim();
  return BOOK_PROFILES[key] ?? DEFAULT_PROFILE;
}

export function getBookWeightAudit(bookKey: string): BookWeightAudit {
  const key = bookKey.toLowerCase().trim();
  const profile = BOOK_PROFILES[key];
  if (!profile) {
    return {
      key: bookKey,
      tier: DEFAULT_PROFILE.tier,
      weighted: DEFAULT_PROFILE.weighted,
      sharp: DEFAULT_PROFILE.sharp,
      fallback: true
    };
  }
  return {
    key: bookKey,
    tier: profile.tier,
    weighted: profile.weighted,
    sharp: profile.sharp,
    fallback: false
  };
}

export function getBookRef(bookKey: string, title: string): BookRef {
  const profile = resolveProfile(bookKey);
  return {
    key: bookKey,
    title,
    tier: profile.tier,
    weight: profile.weighted,
    isSharpWeighted: profile.tier === "sharp"
  };
}

export function getWeight(bookKey: string, mode: WeightModel = "weighted"): number {
  if (mode === "equal") return 1;
  const profile = resolveProfile(bookKey);
  return mode === "sharp" ? profile.sharp : profile.weighted;
}
