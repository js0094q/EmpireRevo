import type { BookTier, MarketKey } from "@/lib/odds/schemas";
import type { CalibrationMeta, OddsCalibration } from "@/lib/server/odds/calibration";

export type BookKey = string;

export type Outcome = {
  name: string;
  priceAmerican: number;
  point?: number;
};

export type Market = {
  key: "h2h" | "spreads" | "totals";
  lastUpdate?: string;
  outcomes: Outcome[];
};

export type BookOdds = {
  bookKey: BookKey;
  title: string;
  lastUpdate?: string;
  markets: Market[];
};

export type EventOdds = {
  id: string;
  commenceTime: string;
  homeTeam: string;
  awayTeam: string;
  homeLogoUrl?: string;
  awayLogoUrl?: string;
  sportKey: string;
  books: BookOdds[];
};

export type EvReliability = "full" | "qualified" | "suppressed";

export type StaleFlag = "none" | "stale_price" | "lagging_book" | "off_market" | "best_market_confirmed" | "best_moving_against";

export type StaleDiagnostics = {
  marketScale: number;
  edgeSignal: number;
  ageSignal: number;
  movementSignal: number;
  consensusSignal: number;
  confidenceScore: number;
  consensusGapPct: number;
  movementGap: number;
  thresholds: {
    stalePriceStrength: number;
    laggingStrength: number;
    offMarketStrength: number;
  };
};

export type FairOutcomeBook = {
  bookKey: string;
  title: string;
  tier: "sharp" | "signal" | "exchange" | "mainstream" | "promo" | "unknown";
  isSharpBook: boolean;
  weight: number;
  priceAmerican: number;
  impliedProb: number;
  impliedProbNoVig: number;
  edgePct: number;
  evPct: number;
  evQualified: boolean;
  evReliability?: EvReliability;
  isBestPrice: boolean;
  staleStrength?: number;
  staleFlag?: StaleFlag;
  staleSummary?: string;
  staleActionable?: boolean;
  consensusGapPct?: number;
  staleReasons?: string[];
  staleDiagnostics?: StaleDiagnostics;
  point?: number;
  lastUpdate?: string;
  movement?: {
    openPrice: number;
    prevPrice: number;
    currentPrice: number;
    delta: number;
    move: number;
    updatedAt: string;
    history: Array<{
      ts: string;
      priceAmerican: number;
    }>;
  };
};

export type ScoreBreakdown = {
  edgeScore: number;
  evScore: number;
  confidenceScore: number;
  coverageScore: number;
  sharpScore: number;
  freshnessScore: number;
  staleScore: number;
  deviationScore: number;
  componentContributions: {
    edge: number;
    ev: number;
    confidence: number;
    coverage: number;
    sharpParticipation: number;
    freshness: number;
    stale: number;
    sharpDeviation: number;
  };
  penaltiesApplied: Array<{
    reason: string;
    delta: number;
  }>;
};

export type ConfidenceBreakdown = {
  coverageRatio: number;
  sharpParticipation: number;
  freshnessScore: number;
  dispersionScore: number;
  historyQuality: number;
  exclusionPenalty: number;
  componentContributions: {
    coverage: number;
    sharpParticipation: number;
    freshness: number;
    dispersion: number;
    history: number;
    exclusions: number;
  };
};

export type TimingSignalLabel = "Likely closing" | "Stable for now" | "Single-book holdout" | "Market converging" | "Weak timing signal";

export type TimingSignal = {
  label: TimingSignalLabel;
  urgencyScore: number;
  reasons: string[];
};

export type PinnedActionability = {
  bestPinnedBookKey: string | null;
  bestPinnedBookTitle: string | null;
  bestPinnedEdgePct: number;
  bestPinnedEvPct: number;
  pinnedStaleStrength: number;
  pinnedScore: number;
  actionable: boolean;
  globalBestBookKey: string;
  globalBestBookTitle: string;
  globalBestEdgePct: number;
  globalPriceAvailableInPinned: boolean;
};

export type FairOutcome = {
  name: string;
  fairProb: number;
  fairAmerican: number;
  consensusDirection: "favored" | "underdog" | "neutral";
  bestPrice: number;
  bestBook: string;
  opportunityScore: number;
  confidenceScore: number;
  confidenceLabel: "High Confidence" | "Moderate Confidence" | "Thin Market" | "Stale Market" | "Limited Sharp Coverage";
  confidenceNotes: string[];
  confidenceBreakdown?: ConfidenceBreakdown;
  staleStrength: number;
  staleSummary: string;
  staleDiagnostics?: {
    topBookKey: string;
    topBookTitle: string;
    topFlag: StaleFlag;
    topStrength: number;
    thresholdUsed: number;
  };
  sharpParticipationPct: number;
  movementSummary: string;
  movementQuality: "strong" | "moderate" | "weak";
  movementDiagnostics?: {
    sharpAverageMove: number;
    retailAverageMove: number;
    movedBooks: number;
    totalBooks: number;
  };
  timingSignal: TimingSignal;
  sharpDeviation: number;
  explanation: string;
  rankingBreakdown?: ScoreBreakdown;
  rankingReasons?: string[];
  pinnedActionability: PinnedActionability;
  evReliability: EvReliability;
  books: FairOutcomeBook[];
};

export type FairEventBookExclusion = {
  bookKey: string;
  title: string;
  reason: "point_mismatch" | "missing_market_or_outcomes";
};

export type FairEvent = {
  id: string;
  baseEventId: string;
  commenceTime: string;
  homeTeam: string;
  awayTeam: string;
  homeLogoUrl?: string;
  awayLogoUrl?: string;
  sportKey: string;
  market: "h2h" | "spreads" | "totals";
  linePoint?: number;
  bookCount: number;
  contributingBookCount: number;
  totalBookCount: number;
  maxAbsEdgePct: number;
  opportunityScore: number;
  confidenceScore: number;
  confidenceLabel: "High Confidence" | "Moderate Confidence" | "Thin Market" | "Stale Market" | "Limited Sharp Coverage";
  staleStrength: number;
  timingLabel: TimingSignalLabel;
  rankingSummary: string;
  excludedBooks: FairEventBookExclusion[];
  outcomes: FairOutcome[];
};

export type FairBoardOpportunity = {
  eventId: string;
  matchup: string;
  outcome: string;
  score: number;
  confidenceLabel: "High Confidence" | "Moderate Confidence" | "Thin Market" | "Stale Market" | "Limited Sharp Coverage";
  staleSummary: string;
  edgePct: number;
  bestBook: string;
  timingLabel: TimingSignalLabel;
  pinnedActionable: boolean;
  pinnedScore: number;
};

export type BookBehaviorSummary = {
  bookKey: string;
  title: string;
  tier: BookTier;
  samples: number;
  lagRate: number;
  staleRate: number;
  disagreementRate: number;
  moveFirstRate: number;
  confidence: "low" | "medium" | "high";
  summary: string;
};

export type ValidationTrackingSummary = {
  emittedEvents: number;
  sink: "memory" | "custom" | "redis";
};

export type MarketAvailabilityStatus = "active" | "limited" | "unavailable";

export type MarketAvailability = {
  market: MarketKey;
  status: MarketAvailabilityStatus;
  feedEventCount: number;
  comparableEventCount: number;
  qualifiedEventCount: number;
};

export type FairBoardResponse = {
  ok: boolean;
  league: string;
  sportKey: string;
  market: "h2h" | "spreads" | "totals";
  model: "sharp" | "equal" | "weighted";
  updatedAt: string;
  lastUpdatedLabel: string;
  activeMarkets: MarketKey[];
  marketAvailability: MarketAvailability[];
  sharpBooksUsed: string[];
  books: { key: string; title: string; tier: BookTier }[];
  events: FairEvent[];
  topOpportunities: FairBoardOpportunity[];
  bookBehavior: BookBehaviorSummary[];
  diagnostics: {
    calibration: OddsCalibration;
    calibrationMeta: CalibrationMeta;
    validation: ValidationTrackingSummary;
  };
  disclaimer: string;
};

export type PersistedOutcomeSnapshot = {
  name: string;
  point?: number | null;
  priceAmerican?: number | null;
  impliedProb?: number | null;
  noVigProb?: number | null;
};

export type PersistedBookSnapshot = {
  bookKey: string;
  bookTitle: string;
  bookTier?: BookTier;
  isPinned?: boolean;
  isSharp?: boolean;
  isBestPrice?: boolean;
  lastSeenAt: number;
  outcomes: PersistedOutcomeSnapshot[];
};

export type PersistedMarketSnapshot = {
  version: 1;
  capturedAt: number;
  sportKey: string;
  eventId: string;
  marketKey: string;
  marketType: MarketKey;
  fair?: {
    fairProb?: number | null;
    fairAmerican?: number | null;
  };
  diagnostics?: {
    rankingScore?: number | null;
    confidenceScore?: number | null;
    stalePenalty?: number | null;
    timingPenalty?: number | null;
    coveragePenalty?: number | null;
    evDefensibility?: EvReliability | null;
    penaltyReasons?: string[];
    factorBreakdown?: Record<string, number>;
  };
  books: PersistedBookSnapshot[];
};

export type TimelinePoint = {
  ts: number;
  fairAmerican?: number | null;
  globalBestAmerican?: number | null;
  pinnedBestAmerican?: number | null;
};

export type BookTimelinePoint = {
  ts: number;
  bookKey: string;
  american?: number | null;
};

export type MarketTimelineResponse = {
  eventId: string;
  marketKey: string;
  points: TimelinePoint[];
  books: BookTimelinePoint[];
  openTs?: number | null;
  currentTs: number;
};

export type PersistedValidationEvent = {
  version: 1;
  id: string;
  createdAt: number;
  sportKey: string;
  eventId: string;
  marketKey: string;
  sideKey?: string | null;
  commenceTime?: string;
  point?: number | null;
  bookKey?: string | null;
  snapshotRef?: {
    key: string;
    bucketTs: number;
  } | null;
  pinnedContext?: {
    pinnedBookKey?: string | null;
    pinnedBestPriceAmerican?: number | null;
    globalBestPriceAmerican?: number | null;
  };
  model: {
    fairAmerican?: number | null;
    fairProb?: number | null;
    rankingScore?: number | null;
    confidenceScore?: number | null;
    evPct?: number | null;
    evDefensibility?: EvReliability | null;
  };
  diagnostics: {
    stalePenalty?: number | null;
    timingPenalty?: number | null;
    coveragePenalty?: number | null;
    widthPenalty?: number | null;
    reasons?: string[];
    factorBreakdown?: Record<string, number>;
  };
  execution: {
    displayedPriceAmerican?: number | null;
    displayedBookKey?: string | null;
  };
};

export type OutcomeResult = "win" | "loss" | "push" | "void" | "unknown";
export type SampleConfidenceTier = "low" | "medium" | "high";

export type PersistedOutcomeResult = {
  version: 1;
  id: string;
  createdAt: number;
  updatedAt: number;
  sportKey: string;
  eventId: string;
  marketKey: string;
  sideKey: string;
  result: OutcomeResult;
  finalScore?: string | null;
  closeTimestamp?: string | null;
  source: "api" | "manual" | "reconciliation" | "unknown";
};

export type CloseReferenceMethod =
  | "closing_global_best"
  | "closing_pinned_best"
  | "closing_sharp_consensus"
  | "closing_fair";

export type EvaluationMethodology = {
  closeReference: CloseReferenceMethod;
  clvSpace: "implied_probability";
  displaySpace?: "american_odds";
  roiStakeModel: "flat_unit_stake";
  probabilitySource: "validation_event_fair_probability";
  isDefaultCloseReference: boolean;
};

export type ClvResult = {
  betPriceAmerican?: number | null;
  closePriceAmerican?: number | null;
  fairAtBetTime?: number | null;
  betImpliedProb?: number | null;
  closeImpliedProb?: number | null;
  clvProbDelta?: number | null;
  beatClose?: boolean | null;
  displayAmericanDelta?: number | null;
  // Deprecated compatibility field. Prefer displayAmericanDelta.
  clvAmericanDelta?: number | null;
  closeReference: CloseReferenceMethod;
};

export type PersistedEvaluationResult = {
  version: 1;
  id: string;
  validationEventId: string;
  createdAt: number;
  sportKey: string;
  eventId: string;
  marketKey: string;
  close: {
    globalBestAmerican?: number | null;
    pinnedBestAmerican?: number | null;
    sharpConsensusAmerican?: number | null;
    fairAmerican?: number | null;
  };
  clv: {
    global: ClvResult;
    pinned: ClvResult;
    sharpConsensus: ClvResult;
    fair: ClvResult;
  };
  beatCloseGlobal?: boolean | null;
  beatClosePinned?: boolean | null;
  modelEdgeHeld?: boolean | null;
  confidenceBucket: "low" | "medium" | "high";
  rankingDecile: number;
  evDefensibility?: EvReliability | null;
  methodology: EvaluationMethodology;
};

export type MarketPressureSignal = {
  label: string;
  severity: "low" | "medium" | "high";
  explanation: string;
  evidence: {
    sharpBooksMovedFirst?: boolean;
    laggingBooks?: string[];
    staleDurationMs?: number | null;
    fairShiftAmerican?: number | null;
  };
};
