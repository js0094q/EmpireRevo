import type { MarketKey } from "@/lib/odds/schemas";

export type CalibrationSource = "defaults" | "env";

export type RankingCalibration = {
  normalization: {
    edgePctMax: number;
    evPctMax: number;
    sharpDeviationMax: number;
  };
  evWeightByMarket: Record<MarketKey, number>;
  componentWeights: {
    edge: number;
    ev: number;
    confidence: number;
    coverage: number;
    sharpParticipation: number;
    freshness: number;
    stale: number;
    sharpDeviation: number;
  };
  penalties: {
    sparseCoverageThreshold: number;
    sparseCoveragePenalty: number;
    limitedSharpThreshold: number;
    limitedSharpPenalty: number;
    staleFreshnessThreshold: number;
    staleFreshnessPenalty: number;
    weakLabelPenalty: number;
  };
  reasonThresholds: {
    edgePct: number;
    sharpParticipation: number;
    broadCoverage: number;
    staleStrength: number;
    freshnessPenalty: number;
  };
  historyAdjustments: {
    persistentEdgeBoost: number;
    sharpConfirmationBoost: number;
    fragmentedPenalty: number;
    staleHistoryPenalty: number;
    worseningEdgePenalty: number;
  };
};

export type ConfidenceCalibration = {
  fallbackScores: {
    missingFreshness: number;
    sparseDispersion: number;
    sparseHistory: number;
  };
  freshness: {
    freshMinutes: number;
    staleMinutes: number;
  };
  dispersion: {
    varianceNoiseCap: number;
  };
  history: {
    strongAvgSamples: number;
    weakAvgSamples: number;
  };
  componentWeights: {
    coverage: number;
    sharpParticipation: number;
    freshness: number;
    dispersion: number;
    history: number;
    exclusions: number;
  };
  labelThresholds: {
    thinCoverage: number;
    staleFreshness: number;
    limitedSharp: number;
    highConfidence: number;
  };
  noteThresholds: {
    broadCoverage: number;
    thinCoverage: number;
    strongSharp: number;
    fresh: number;
    stale: number;
    highDisagreement: number;
    sparseHistory: number;
  };
};

export type StaleCalibration = {
  marketScale: Record<MarketKey, number>;
  componentWeights: {
    edge: number;
    age: number;
    movement: number;
    consensusGap: number;
  };
  thresholds: {
    stalePriceStrength: number;
    laggingStrength: number;
    offMarketStrength: number;
    stalePriceEdgePct: number;
    laggingEdgePct: number;
    offMarketGapPct: number;
    staleConfidenceMin: number;
    offMarketConfidenceMax: number;
    marketConfirmedEdgePct: number;
    marketConfirmedConfidence: number;
    marketConfirmedSharpMove: number;
    movingAgainstMove: number;
    laggingMovementGap: number;
  };
  scaling: {
    edgePctMax: number;
    movementGapMax: number;
    consensusGapMax: number;
    consensusGapDenominatorPct: number;
  };
  age: {
    freshMinutes: number;
    staleMinutes: number;
  };
};

export type TimingCalibration = {
  thresholds: {
    weakHistoryQuality: number;
    likelyClosingUrgency: number;
    singleHoldoutUrgency: number;
    convergingUrgency: number;
    stableUrgencyMax: number;
    convergingBooksMoved: number;
  };
  weights: {
    staleStrength: number;
    confidence: number;
    movementStrength: number;
    holdoutFactor: number;
    freshness: number;
  };
};

export type PinnedCalibration = {
  actionableEdgePct: number;
  staleStrengthThreshold: number;
  scoreWeights: {
    edge: number;
    confidence: number;
    stale: number;
    urgency: number;
  };
};

export type EvCalibration = {
  spreadTotals: {
    minimumConfidence: number;
    minimumCoverage: number;
    minimumContributingBooks: number;
  };
};

export type BookBehaviorCalibration = {
  minSamplesForSignal: number;
  lagConsensusGapPct: number;
  moveFirstThreshold: number;
};

export type OddsCalibration = {
  ranking: RankingCalibration;
  confidence: ConfidenceCalibration;
  stale: StaleCalibration;
  timing: TimingCalibration;
  pinned: PinnedCalibration;
  ev: EvCalibration;
  bookBehavior: BookBehaviorCalibration;
};

export type CalibrationMeta = {
  source: CalibrationSource;
  parseError?: string;
};

export type DeepPartial<T> = {
  [K in keyof T]?: T[K] extends Record<string, unknown> ? DeepPartial<T[K]> : T[K];
};

const DEFAULT_CALIBRATION: OddsCalibration = {
  ranking: {
    normalization: {
      edgePctMax: 3.5,
      evPctMax: 8,
      sharpDeviationMax: 2.5
    },
    evWeightByMarket: {
      h2h: 1,
      spreads: 0.55,
      totals: 0.55
    },
    componentWeights: {
      edge: 0.23,
      ev: 0.16,
      confidence: 0.2,
      coverage: 0.13,
      sharpParticipation: 0.11,
      freshness: 0.08,
      stale: 0.06,
      sharpDeviation: 0.03
    },
    penalties: {
      sparseCoverageThreshold: 0.45,
      sparseCoveragePenalty: 14,
      limitedSharpThreshold: 0.2,
      limitedSharpPenalty: 8,
      staleFreshnessThreshold: 0.35,
      staleFreshnessPenalty: 10,
      weakLabelPenalty: 6
    },
    reasonThresholds: {
      edgePct: 1.2,
      sharpParticipation: 0.35,
      broadCoverage: 0.7,
      staleStrength: 0.6,
      freshnessPenalty: 0.35
    },
    historyAdjustments: {
      persistentEdgeBoost: 3,
      sharpConfirmationBoost: 2,
      fragmentedPenalty: 4,
      staleHistoryPenalty: 5,
      worseningEdgePenalty: 2
    }
  },
  confidence: {
    fallbackScores: {
      missingFreshness: 0.45,
      sparseDispersion: 0.55,
      sparseHistory: 0.4
    },
    freshness: {
      freshMinutes: 10,
      staleMinutes: 60
    },
    dispersion: {
      varianceNoiseCap: 0.0009
    },
    history: {
      strongAvgSamples: 8,
      weakAvgSamples: 1
    },
    componentWeights: {
      coverage: 0.3,
      sharpParticipation: 0.22,
      freshness: 0.2,
      dispersion: 0.15,
      history: 0.08,
      exclusions: 0.05
    },
    labelThresholds: {
      thinCoverage: 0.45,
      staleFreshness: 0.35,
      limitedSharp: 0.2,
      highConfidence: 0.78
    },
    noteThresholds: {
      broadCoverage: 0.75,
      thinCoverage: 0.45,
      strongSharp: 0.35,
      fresh: 0.7,
      stale: 0.35,
      highDisagreement: 0.45,
      sparseHistory: 0.35
    }
  },
  stale: {
    marketScale: {
      h2h: 1,
      spreads: 0.8,
      totals: 0.8
    },
    componentWeights: {
      edge: 0.35,
      age: 0.25,
      movement: 0.2,
      consensusGap: 0.2
    },
    thresholds: {
      stalePriceStrength: 0.62,
      laggingStrength: 0.62,
      offMarketStrength: 0.68,
      stalePriceEdgePct: 0.8,
      laggingEdgePct: 0.5,
      offMarketGapPct: 4,
      staleConfidenceMin: 0.55,
      offMarketConfidenceMax: 0.5,
      marketConfirmedEdgePct: 0.75,
      marketConfirmedConfidence: 0.65,
      marketConfirmedSharpMove: 4,
      movingAgainstMove: -3,
      laggingMovementGap: 5
    },
    scaling: {
      edgePctMax: 2.5,
      movementGapMax: 12,
      consensusGapMax: 6,
      consensusGapDenominatorPct: 100
    },
    age: {
      freshMinutes: 5,
      staleMinutes: 60
    }
  },
  timing: {
    thresholds: {
      weakHistoryQuality: 0.35,
      likelyClosingUrgency: 0.72,
      singleHoldoutUrgency: 0.68,
      convergingUrgency: 0.56,
      stableUrgencyMax: 0.42,
      convergingBooksMoved: 2
    },
    weights: {
      staleStrength: 0.34,
      confidence: 0.24,
      movementStrength: 0.2,
      holdoutFactor: 0.14,
      freshness: 0.08
    }
  },
  pinned: {
    actionableEdgePct: 0.5,
    staleStrengthThreshold: 0.58,
    scoreWeights: {
      edge: 0.5,
      confidence: 0.2,
      stale: 0.2,
      urgency: 0.1
    }
  },
  ev: {
    spreadTotals: {
      minimumConfidence: 0.62,
      minimumCoverage: 0.55,
      minimumContributingBooks: 3
    }
  },
  bookBehavior: {
    minSamplesForSignal: 6,
    lagConsensusGapPct: 2,
    moveFirstThreshold: 4
  }
};

let cachedCalibration: OddsCalibration | null = null;
let cachedMeta: CalibrationMeta | null = null;

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  if (value <= 0) return 0;
  if (value >= 1) return 1;
  return value;
}

function clampPositive(value: number, fallback: number): number {
  if (!Number.isFinite(value) || value <= 0) return fallback;
  return value;
}

function clampNonNegative(value: number, fallback = 0): number {
  if (!Number.isFinite(value) || value < 0) return fallback;
  return value;
}

function normalizeWeights<T extends Record<string, number>>(weights: T, fallback: T): T {
  const entries = Object.entries(weights).map(([key, value]) => [key, clampNonNegative(value)] as const);
  const total = entries.reduce((sum, [, value]) => sum + value, 0);
  if (total <= 0) return fallback;
  return Object.fromEntries(entries.map(([key, value]) => [key, value / total])) as T;
}

function mergeDeep<T extends Record<string, unknown>>(base: T, patch: DeepPartial<T>): T {
  const out = { ...base } as Record<string, unknown>;

  for (const key of Object.keys(patch) as Array<keyof T>) {
    const baseValue = base[key];
    const patchValue = patch[key];
    if (patchValue === undefined) continue;

    const baseIsObject = typeof baseValue === "object" && baseValue !== null && !Array.isArray(baseValue);
    const patchIsObject = typeof patchValue === "object" && patchValue !== null && !Array.isArray(patchValue);

    if (baseIsObject && patchIsObject) {
      out[key as string] = mergeDeep(baseValue as Record<string, unknown>, patchValue as DeepPartial<Record<string, unknown>>);
      continue;
    }

    out[key as string] = patchValue;
  }

  return out as T;
}

function parseCalibrationOverride(raw: string): { patch: DeepPartial<OddsCalibration> | null; error?: string } {
  if (!raw.trim()) return { patch: null };
  try {
    const parsed = JSON.parse(raw) as DeepPartial<OddsCalibration>;
    return { patch: parsed };
  } catch (error) {
    const message = error instanceof Error ? error.message : "invalid JSON";
    return { patch: null, error: message };
  }
}

function sanitizeCalibration(calibration: OddsCalibration): OddsCalibration {
  const rankingWeights = normalizeWeights(calibration.ranking.componentWeights, DEFAULT_CALIBRATION.ranking.componentWeights);
  const confidenceWeights = normalizeWeights(
    calibration.confidence.componentWeights,
    DEFAULT_CALIBRATION.confidence.componentWeights
  );
  const staleWeights = normalizeWeights(calibration.stale.componentWeights, DEFAULT_CALIBRATION.stale.componentWeights);
  const timingWeights = normalizeWeights(calibration.timing.weights, DEFAULT_CALIBRATION.timing.weights);
  const pinnedWeights = normalizeWeights(calibration.pinned.scoreWeights, DEFAULT_CALIBRATION.pinned.scoreWeights);
  const freshMinutes = clampPositive(calibration.confidence.freshness.freshMinutes, DEFAULT_CALIBRATION.confidence.freshness.freshMinutes);
  const staleMinutes = clampPositive(calibration.confidence.freshness.staleMinutes, DEFAULT_CALIBRATION.confidence.freshness.staleMinutes);
  const staleAgeFreshMinutes = clampPositive(calibration.stale.age.freshMinutes, DEFAULT_CALIBRATION.stale.age.freshMinutes);
  const staleAgeMinutes = clampPositive(calibration.stale.age.staleMinutes, DEFAULT_CALIBRATION.stale.age.staleMinutes);

  return {
    ...calibration,
    ranking: {
      ...calibration.ranking,
      normalization: {
        edgePctMax: clampPositive(calibration.ranking.normalization.edgePctMax, DEFAULT_CALIBRATION.ranking.normalization.edgePctMax),
        evPctMax: clampPositive(calibration.ranking.normalization.evPctMax, DEFAULT_CALIBRATION.ranking.normalization.evPctMax),
        sharpDeviationMax: clampPositive(
          calibration.ranking.normalization.sharpDeviationMax,
          DEFAULT_CALIBRATION.ranking.normalization.sharpDeviationMax
        )
      },
      componentWeights: rankingWeights,
      penalties: {
        ...calibration.ranking.penalties,
        sparseCoverageThreshold: clamp01(calibration.ranking.penalties.sparseCoverageThreshold),
        limitedSharpThreshold: clamp01(calibration.ranking.penalties.limitedSharpThreshold),
        staleFreshnessThreshold: clamp01(calibration.ranking.penalties.staleFreshnessThreshold),
        sparseCoveragePenalty: clampNonNegative(
          calibration.ranking.penalties.sparseCoveragePenalty,
          DEFAULT_CALIBRATION.ranking.penalties.sparseCoveragePenalty
        ),
        limitedSharpPenalty: clampNonNegative(
          calibration.ranking.penalties.limitedSharpPenalty,
          DEFAULT_CALIBRATION.ranking.penalties.limitedSharpPenalty
        ),
        staleFreshnessPenalty: clampNonNegative(
          calibration.ranking.penalties.staleFreshnessPenalty,
          DEFAULT_CALIBRATION.ranking.penalties.staleFreshnessPenalty
        ),
        weakLabelPenalty: clampNonNegative(
          calibration.ranking.penalties.weakLabelPenalty,
          DEFAULT_CALIBRATION.ranking.penalties.weakLabelPenalty
        )
      }
    },
    confidence: {
      ...calibration.confidence,
      freshness: {
        freshMinutes,
        staleMinutes: Math.max(staleMinutes, freshMinutes + 1)
      },
      componentWeights: confidenceWeights,
      labelThresholds: {
        ...calibration.confidence.labelThresholds,
        thinCoverage: clamp01(calibration.confidence.labelThresholds.thinCoverage),
        staleFreshness: clamp01(calibration.confidence.labelThresholds.staleFreshness),
        limitedSharp: clamp01(calibration.confidence.labelThresholds.limitedSharp),
        highConfidence: clamp01(calibration.confidence.labelThresholds.highConfidence)
      }
    },
    stale: {
      ...calibration.stale,
      componentWeights: staleWeights,
      age: {
        freshMinutes: staleAgeFreshMinutes,
        staleMinutes: Math.max(staleAgeMinutes, staleAgeFreshMinutes + 1)
      },
      scaling: {
        edgePctMax: clampPositive(calibration.stale.scaling.edgePctMax, DEFAULT_CALIBRATION.stale.scaling.edgePctMax),
        movementGapMax: clampPositive(calibration.stale.scaling.movementGapMax, DEFAULT_CALIBRATION.stale.scaling.movementGapMax),
        consensusGapMax: clampPositive(calibration.stale.scaling.consensusGapMax, DEFAULT_CALIBRATION.stale.scaling.consensusGapMax),
        consensusGapDenominatorPct: clampPositive(
          calibration.stale.scaling.consensusGapDenominatorPct,
          DEFAULT_CALIBRATION.stale.scaling.consensusGapDenominatorPct
        )
      }
    },
    timing: {
      ...calibration.timing,
      weights: timingWeights
    },
    pinned: {
      ...calibration.pinned,
      scoreWeights: pinnedWeights
    }
  };
}

function buildCalibration(): { calibration: OddsCalibration; meta: CalibrationMeta } {
  const raw = process.env.ODDS_CALIBRATION_OVERRIDES_JSON || "";
  const { patch, error } = parseCalibrationOverride(raw);
  if (!patch) {
    return {
      calibration: DEFAULT_CALIBRATION,
      meta: {
        source: "defaults",
        parseError: error
      }
    };
  }

  const merged = sanitizeCalibration(mergeDeep(DEFAULT_CALIBRATION, patch));
  return {
    calibration: merged,
    meta: {
      source: "env",
      parseError: error
    }
  };
}

export function getOddsCalibration(): OddsCalibration {
  if (cachedCalibration) return cachedCalibration;
  const built = buildCalibration();
  cachedCalibration = built.calibration;
  cachedMeta = built.meta;
  return cachedCalibration;
}

export function getCalibrationMeta(): CalibrationMeta {
  if (!cachedMeta) {
    const built = buildCalibration();
    cachedCalibration = built.calibration;
    cachedMeta = built.meta;
  }
  return cachedMeta;
}

export function resetCalibrationCacheForTests(): void {
  cachedCalibration = null;
  cachedMeta = null;
}

export const DEFAULT_ODDS_CALIBRATION = DEFAULT_CALIBRATION;
