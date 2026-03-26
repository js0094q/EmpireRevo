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
  sharp: 0
};

function profile(tier: BookTier, weighted: number): BookWeightProfile {
  return {
    tier,
    weighted,
    sharp: tier === "sharp" ? weighted : 0
  };
}

const BOOK_PROFILES: Record<string, BookWeightProfile> = {
  // Tier 1: sharp / market-making books
  pinnacle: profile("sharp", 1.0),
  circa: profile("sharp", 0.9),
  circasports: profile("sharp", 0.9),
  bookmaker: profile("sharp", 0.85),
  betcris: profile("sharp", 0.85),

  // Tier 2: strong signal / hybrid books
  betonline: profile("signal", 0.75),
  betonlineag: profile("signal", 0.75),
  heritage: profile("signal", 0.7),
  heritagesports: profile("signal", 0.7),
  lowvig: profile("signal", 0.7),
  lowvigag: profile("signal", 0.7),

  // Tier 3: major U.S. market books
  draftkings: profile("mainstream", 0.4),
  fanduel: profile("mainstream", 0.38),
  caesars: profile("mainstream", 0.34),
  williamhillus: profile("mainstream", 0.34),
  betmgm: profile("mainstream", 0.34),
  pointsbet: profile("mainstream", 0.32),
  pointsbetus: profile("mainstream", 0.32),
  barstool: profile("mainstream", 0.3),
  espnbet: profile("mainstream", 0.3),

  // Tier 4: recreational / promotional books
  betrivers: profile("promo", 0.28),
  unibet: profile("promo", 0.28),
  wynnbet: profile("promo", 0.26),
  foxbet: profile("promo", 0.25),
  superbook: profile("promo", 0.25),
  superbookus: profile("promo", 0.25),

  // Tier 5: exchange / niche / regional
  matchbook: profile("exchange", 0.6),
  betfairexchange: profile("exchange", 0.6),
  betfairexuk: profile("exchange", 0.6),
  betfairexau: profile("exchange", 0.6),
  smarkets: profile("exchange", 0.6)
};

function resolveProfile(bookKey: string): BookWeightProfile {
  const key = bookKey.toLowerCase().trim();
  const compact = key.replace(/[^a-z0-9]/g, "");
  return BOOK_PROFILES[key] ?? BOOK_PROFILES[compact] ?? DEFAULT_PROFILE;
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

export function isBookEnabledForModel(bookKey: string, mode: WeightModel = "weighted"): boolean {
  if (mode !== "sharp") return true;
  return resolveProfile(bookKey).tier === "sharp";
}
