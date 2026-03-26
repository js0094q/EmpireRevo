import type { LeagueKey, MarketKey, NormalizedEventOdds } from "@/lib/odds/schemas";
import { getCalibrationMeta, getOddsCalibration, type OddsCalibration } from "@/lib/server/odds/calibration";
import type {
  FairBoardResponse,
  FairEvent,
  FairOutcome,
  FairOutcomeBook,
  MarketAvailability,
  PinnedActionability,
  ValidationTrackingSummary,
  EvReliability
} from "@/lib/server/odds/types";
import {
  americanToProbability,
  probabilityToAmerican,
  removeVig,
  weightedFairProbability,
  edgePct as probabilityEdgePct
} from "@/lib/server/odds/fairMath";
import { calculateEvPercent } from "@/lib/server/odds/ev";
import { compareOffersByMarket } from "@/lib/server/odds/marketCompare";
import { getBookWeightAudit, getWeight, isBookEnabledForModel, type WeightModel } from "@/lib/server/odds/weights";
import { assessConfidence } from "@/lib/server/odds/confidence";
import { detectStaleForBook } from "@/lib/server/odds/staleDetection";
import { rankOpportunity } from "@/lib/server/odds/ranking";
import { buildOpportunityExplanation } from "@/lib/server/odds/explanations";
import { summarizeMovementSignal } from "@/lib/server/odds/movementSignal";
import { assessTimingSignal } from "@/lib/server/odds/timingSignal";
import { summarizeBookBehavior } from "@/lib/server/odds/evaluation";
import { getValidationSinkMode, trackValidationEvent } from "@/lib/server/odds/validationEvents";
import { buildOutcomeMarketKey, persistBoardSnapshots, snapshotLookupKey } from "@/lib/server/odds/snapshotPersistence";
import type { SnapshotRef } from "@/lib/server/odds/historyStore";
import { canonicalizeTeamName, normalizeTeamName } from "@/lib/server/odds/logos";

type BuildFairBoardParams = {
  normalized: NormalizedEventOdds[];
  league: LeagueKey;
  sportKey: string;
  market: MarketKey;
  model?: WeightModel;
  minBooks?: number;
  includeBooks?: Set<string>;
  timeWindowHours?: number;
};

type BookOutcome = {
  name: string;
  key: string;
  priceAmerican: number;
  impliedProb: number;
  noVigProb: number;
  point?: number;
};

type BookMarketRow = {
  bookKey: string;
  title: string;
  tier: "sharp" | "signal" | "exchange" | "mainstream" | "promo" | "unknown";
  isSharpBook: boolean;
  weight: number;
  lastUpdate?: string;
  linePoint?: number;
  outcomes: BookOutcome[];
};

type GroupedMarket = {
  signature: string;
  linePoint?: number;
  books: BookMarketRow[];
};

const DEFAULT_MODEL: WeightModel = "weighted";
const DEFAULT_MIN_BOOKS = 4;
export const LIMITED_MARKET_MIN_BOOKS = 2;
const FAIR_BOARD_DISCLAIMER =
  "Market-based pricing, not predictions. All values are derived from real sportsbook data, adjusted for margin, and compared to fair market probability. Edge reflects pricing inefficiency, not guaranteed outcomes.";
const MARKET_ORDER: MarketKey[] = ["h2h", "spreads", "totals"];

function normalizeModel(model?: string | null): WeightModel {
  if (model === "sharp" || model === "equal" || model === "weighted") return model;
  return DEFAULT_MODEL;
}

function normalizeIncludedBooks(includeBooks?: Set<string> | null): Set<string> | null {
  if (!includeBooks || includeBooks.size === 0) return null;
  return new Set(Array.from(includeBooks).map((book) => book.toLowerCase()));
}

function formatWindowLabel(windowHours?: number): string {
  const safe = Number.isFinite(windowHours) && windowHours ? Math.max(1, Math.floor(windowHours)) : 24;
  return `Rolling ${safe}h window`;
}

function hasComparablePoints(market: MarketKey, outcomes: BookOutcome[]): boolean {
  if (market === "h2h") return true;
  if (outcomes.length < 2) return false;
  return outcomes.every((outcome) => Number.isFinite(outcome.point));
}

function displayPoint(outcomes: BookOutcome[]): number | undefined {
  const first = outcomes[0];
  if (!first || !Number.isFinite(first.point)) return undefined;
  return Number(first.point);
}

function pointSignature(market: MarketKey, outcomes: BookOutcome[]): string {
  if (market === "h2h") return "moneyline";
  if (!hasComparablePoints(market, outcomes)) return "invalid";
  const normalized = outcomes
    .map((outcome) => Number(outcome.point ?? Number.NaN))
    .map((value) => Math.round(value * 1000) / 1000)
    .sort((a, b) => a - b);
  return normalized.join("|");
}

function normalizeOutcomeName(name: string): string {
  return normalizeTeamName(name);
}

function directionalTotalsKey(name: string): "over" | "under" | null {
  const normalized = normalizeOutcomeName(name);
  if (!normalized) return null;
  if (normalized === "o" || normalized.startsWith("over")) return "over";
  if (normalized === "u" || normalized.startsWith("under")) return "under";
  return null;
}

function trailingToken(value: string): string {
  const parts = value.split(" ").filter(Boolean);
  return parts[parts.length - 1] ?? "";
}

function createOutcomeKeyResolver(params: {
  market: MarketKey;
  event: NormalizedEventOdds["event"];
}): (name: string) => string {
  if (params.market === "totals") {
    return (name) => directionalTotalsKey(name) ?? normalizeOutcomeName(name);
  }

  const league = params.event.league;
  const homeCanonical = normalizeOutcomeName(canonicalizeTeamName(params.event.home.name, league));
  const awayCanonical = normalizeOutcomeName(canonicalizeTeamName(params.event.away.name, league));
  const homeRaw = normalizeOutcomeName(params.event.home.name);
  const awayRaw = normalizeOutcomeName(params.event.away.name);
  const homeNickname = trailingToken(homeCanonical || homeRaw);
  const awayNickname = trailingToken(awayCanonical || awayRaw);
  const uniqueNicknames = Boolean(homeNickname && awayNickname && homeNickname !== awayNickname);

  return (name: string) => {
    const normalized = normalizeOutcomeName(name);
    const canonical = normalizeOutcomeName(canonicalizeTeamName(name, league));
    const nickname = trailingToken(canonical || normalized);
    const candidate = canonical || normalized;

    if (candidate === homeCanonical || candidate === homeRaw) return "home";
    if (candidate === awayCanonical || candidate === awayRaw) return "away";
    if (uniqueNicknames && nickname === homeNickname) return "home";
    if (uniqueNicknames && nickname === awayNickname) return "away";

    return candidate;
  };
}

function outcomeByKey(book: BookMarketRow, outcomeKey: string): BookOutcome | undefined {
  return book.outcomes.find((outcome) => outcome.key === outcomeKey);
}

function rawMarketPresence(event: NormalizedEventOdds, market: MarketKey, includeBooks: Set<string> | null): boolean {
  return event.books.some((book) => {
    const keyLc = book.book.key.toLowerCase();
    if (includeBooks && !includeBooks.has(keyLc)) return false;
    const targetMarket = book.markets.find((entry) => entry.market === market);
    return Boolean(targetMarket && targetMarket.outcomes.length > 0);
  });
}

function toBookRows(params: {
  event: NormalizedEventOdds;
  market: MarketKey;
  model: WeightModel;
  includeBooks: Set<string> | null;
}): {
  rows: BookMarketRow[];
  excluded: Array<{ bookKey: string; title: string; reason: "point_mismatch" | "missing_market_or_outcomes" }>;
  totalBookCount: number;
} {
  const outcomeKey = createOutcomeKeyResolver({
    market: params.market,
    event: params.event.event
  });
  const rows: BookMarketRow[] = [];
  const excluded: Array<{ bookKey: string; title: string; reason: "point_mismatch" | "missing_market_or_outcomes" }> = [];
  let eligibleBookCount = 0;
  for (const book of params.event.books) {
    const keyLc = book.book.key.toLowerCase();
    if (params.includeBooks && !params.includeBooks.has(keyLc)) continue;
    if (!isBookEnabledForModel(book.book.key, params.model)) continue;
    eligibleBookCount += 1;

    const targetMarket = book.markets.find((m) => m.market === params.market);
    if (!targetMarket || targetMarket.outcomes.length < 2) {
      excluded.push({
        bookKey: book.book.key,
        title: book.book.title,
        reason: "missing_market_or_outcomes"
      });
      continue;
    }

    const outcomes = targetMarket.outcomes.slice(0, 2).map<BookOutcome>((outcome) => ({
      name: outcome.name,
      key: outcomeKey(outcome.name),
      priceAmerican: outcome.price,
      impliedProb: americanToProbability(outcome.price),
      noVigProb: 0,
      point: outcome.point
    }));

    if (!hasComparablePoints(params.market, outcomes)) {
      excluded.push({
        bookKey: book.book.key,
        title: book.book.title,
        reason: "point_mismatch"
      });
      continue;
    }

    const noVig = removeVig(outcomes.map((outcome) => outcome.impliedProb));
    outcomes.forEach((outcome, idx) => {
      outcome.noVigProb = noVig[idx] ?? 0.5;
    });
    const profile = getBookWeightAudit(book.book.key);

    rows.push({
      bookKey: book.book.key,
      title: book.book.title,
      tier: profile.tier,
      isSharpBook: profile.tier === "sharp",
      weight: getWeight(book.book.key, params.model),
      lastUpdate: targetMarket.lastUpdate,
      linePoint: displayPoint(outcomes),
      outcomes
    });
  }
  return {
    rows,
    excluded,
    totalBookCount: eligibleBookCount
  };
}

function groupBooksByPoint(params: {
  rows: BookMarketRow[];
  market: MarketKey;
}): GroupedMarket[] {
  const groups = new Map<string, GroupedMarket>();
  for (const row of params.rows) {
    const signature = pointSignature(params.market, row.outcomes);
    if (signature === "invalid") continue;
    const existing = groups.get(signature);
    if (existing) {
      existing.books.push(row);
    } else {
      groups.set(signature, {
        signature,
        linePoint: row.linePoint,
        books: [row]
      });
    }
  }
  return Array.from(groups.values());
}

function marketCenterPoint(groups: GroupedMarket[]): number | null {
  const withPoints = groups
    .filter((group) => Number.isFinite(group.linePoint))
    .slice()
    .sort((a, b) => Number(a.linePoint ?? 0) - Number(b.linePoint ?? 0));
  if (!withPoints.length) return null;
  const totalWeight = withPoints.reduce((sum, group) => sum + group.books.length, 0);
  if (!totalWeight) return null;

  // Weighted median keeps center anchored to the most widely dealt points
  // without letting fringe alt-lines pull the default too far.
  let runningWeight = 0;
  const halfway = totalWeight / 2;
  for (let idx = 0; idx < withPoints.length; idx += 1) {
    const current = withPoints[idx]!;
    runningWeight += current.books.length;
    if (runningWeight < halfway) continue;

    if (runningWeight === halfway && withPoints[idx + 1]) {
      const next = withPoints[idx + 1]!;
      return (Number(current.linePoint ?? 0) + Number(next.linePoint ?? 0)) / 2;
    }
    return Number(current.linePoint ?? 0);
  }

  return Number(withPoints[withPoints.length - 1]?.linePoint ?? 0);
}

function qualityCoverageScore(group: GroupedMarket): number {
  return group.books.reduce((sum, book) => {
    if (book.tier === "sharp") return sum + 8;
    if (book.tier === "signal") return sum + 4;
    if (book.tier === "exchange") return sum + 3;
    if (book.tier === "mainstream") return sum + 2;
    if (book.tier === "promo") return sum + 1;
    return sum + 0.5;
  }, 0);
}

function marketMakingCoverageScore(group: GroupedMarket): number {
  return group.books.reduce((sum, book) => {
    if (book.tier === "sharp") return sum + 2;
    if (book.tier === "signal") return sum + 1;
    if (book.tier === "exchange") return sum + 1;
    return sum;
  }, 0);
}

function consensusDirection(prob: number): "favored" | "underdog" | "neutral" {
  if (prob >= 0.55) return "favored";
  if (prob <= 0.45) return "underdog";
  return "neutral";
}

function resolveEvReliability(params: {
  market: MarketKey;
  confidenceScore: number;
  coverageRatio: number;
  contributingBooks: number;
  calibration: OddsCalibration;
}): EvReliability {
  if (params.market === "h2h") return "full";

  const thresholds = params.calibration.ev.spreadTotals;
  if (
    params.confidenceScore < thresholds.minimumConfidence ||
    params.coverageRatio < thresholds.minimumCoverage ||
    params.contributingBooks < thresholds.minimumContributingBooks
  ) {
    return "suppressed";
  }

  return "qualified";
}

function buildOutcomeBooks(params: {
  market: MarketKey;
  outcomeName: string;
  outcomeKey: string;
  books: BookMarketRow[];
  fairProb: number;
}): { rows: FairOutcomeBook[]; maxAbsEdge: number } {
  const booksWithOutcome = params.books
    .map((book) => ({
      book,
      outcome: outcomeByKey(book, params.outcomeKey)
    }))
    .filter((entry): entry is { book: BookMarketRow; outcome: BookOutcome } => Boolean(entry.outcome));

  const bestLine = [...booksWithOutcome]
    .filter((entry) => Number.isFinite(entry.outcome.priceAmerican))
    .sort((a, b) =>
      compareOffersByMarket(
        params.market,
        params.outcomeName,
        {
          point: a.outcome.point,
          priceAmerican: a.outcome.priceAmerican
        },
        {
          point: b.outcome.point,
          priceAmerican: b.outcome.priceAmerican
        }
      )
    )[0]?.book;

  let maxAbsEdge = 0;
  const rows = booksWithOutcome.map<FairOutcomeBook>(({ book, outcome }) => {
    const implied = outcome.noVigProb;
    const probabilityEdge = probabilityEdgePct(params.fairProb, implied);
    if (Math.abs(probabilityEdge) > maxAbsEdge) {
      maxAbsEdge = Math.abs(probabilityEdge);
    }
    const evPct = calculateEvPercent(params.fairProb, outcome.priceAmerican);
    return {
      bookKey: book.bookKey,
      title: book.title,
      tier: book.tier,
      isSharpBook: book.isSharpBook,
      weight: book.weight,
      priceAmerican: outcome.priceAmerican,
      impliedProb: outcome.impliedProb,
      impliedProbNoVig: implied,
      edgePct: probabilityEdge,
      evPct,
      evQualified: params.market === "h2h",
      evReliability: params.market === "h2h" ? "full" : "qualified",
      isBestPrice: Boolean(bestLine && bestLine.bookKey === book.bookKey),
      point: outcome.point,
      lastUpdate: book.lastUpdate
    };
  });

  return { rows, maxAbsEdge };
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  if (value <= 0) return 0;
  if (value >= 1) return 1;
  return value;
}

function buildPinnedActionability(outcome: FairOutcome, calibration: OddsCalibration): PinnedActionability {
  const bestGlobal = [...outcome.books].sort((a, b) => b.edgePct - a.edgePct || b.evPct - a.evPct)[0];
  const globalBestBookKey = bestGlobal?.bookKey ?? "";
  const globalBestBookTitle = bestGlobal?.title ?? "";
  const globalBestEdgePct = Math.max(0, bestGlobal?.edgePct ?? 0);

  const actionabilityScore =
    100 *
    (calibration.pinned.scoreWeights.edge * clamp01(globalBestEdgePct / 3) +
      calibration.pinned.scoreWeights.confidence * outcome.confidenceScore +
      calibration.pinned.scoreWeights.stale * outcome.staleStrength +
      calibration.pinned.scoreWeights.urgency * outcome.timingSignal.urgencyScore);

  return {
    bestPinnedBookKey: null,
    bestPinnedBookTitle: null,
    bestPinnedEdgePct: 0,
    bestPinnedEvPct: 0,
    pinnedStaleStrength: 0,
    pinnedScore: Math.round(actionabilityScore * 10) / 10,
    actionable: globalBestEdgePct >= calibration.pinned.actionableEdgePct,
    globalBestBookKey,
    globalBestBookTitle,
    globalBestEdgePct,
    globalPriceAvailableInPinned: false
  };
}

function buildFairEvent(params: {
  baseId: string;
  normalized: NormalizedEventOdds;
  sportKey: string;
  market: MarketKey;
  group: GroupedMarket;
  totalBookCount: number;
  excludedBooks: FairEvent["excludedBooks"];
  calibration: OddsCalibration;
}): FairEvent | null {
  if (!params.group.books.length) return null;
  const outcomeDefinitions: Array<{ name: string; key: string }> = [];
  const seenOutcomeKeys = new Set<string>();
  for (const book of params.group.books) {
    for (const outcome of book.outcomes) {
      const key = outcome.key;
      if (!key || seenOutcomeKeys.has(key)) continue;
      seenOutcomeKeys.add(key);
      outcomeDefinitions.push({ name: outcome.name, key });
    }
  }

  if (!outcomeDefinitions.length) return null;

  const outcomes: FairEvent["outcomes"] = [];
  let maxAbsEdge = 0;
  const uniqueBooks = new Set<string>();

  for (let idx = 0; idx < outcomeDefinitions.length; idx += 1) {
    const definition = outcomeDefinitions[idx]!;
    const outcomeName = definition.name || `Outcome ${idx + 1}`;
    const weightedEntries = params.group.books
      .map((book) => ({
        probability: outcomeByKey(book, definition.key)?.noVigProb,
        weight: book.weight
      }))
      .filter((entry): entry is { probability: number; weight: number } => Number.isFinite(entry.probability));

    if (!weightedEntries.length) continue;

    const weighted = weightedFairProbability(
      weightedEntries,
      { allowUnweightedFallback: false }
    );
    const fairAmerican = probabilityToAmerican(weighted);
    const { rows, maxAbsEdge: localMax } = buildOutcomeBooks({
      market: params.market,
      outcomeName,
      outcomeKey: definition.key,
      books: params.group.books,
      fairProb: weighted
    });

    if (!rows.length) continue;

    const confidence = assessConfidence({
      books: rows,
      contributingBooks: rows.length,
      totalBooks: params.totalBookCount,
      excludedBooks: params.excludedBooks,
      calibration: params.calibration
    });

    const evReliability = resolveEvReliability({
      market: params.market,
      confidenceScore: confidence.score,
      coverageRatio: confidence.coverageRatio,
      contributingBooks: rows.length,
      calibration: params.calibration
    });

    const evPreparedRows = rows.map((row) => {
      if (evReliability === "suppressed") {
        return {
          ...row,
          evQualified: false,
          evReliability,
          evPct: 0
        };
      }

      return {
        ...row,
        evQualified: true,
        evReliability
      };
    });

    const staleBooks = detectStaleForBook({
      market: params.market,
      confidenceScore: confidence.score,
      books: evPreparedRows,
      calibration: params.calibration
    });

    const ranking = rankOpportunity({
      market: params.market,
      confidence,
      books: staleBooks,
      contributingBooks: rows.length,
      totalBooks: params.totalBookCount,
      calibration: params.calibration
    });

    const movementSignal = summarizeMovementSignal(staleBooks);
    const timingSignal = assessTimingSignal({
      books: staleBooks,
      confidence,
      staleStrength: ranking.staleStrength,
      movementQuality: movementSignal.quality,
      movedBooks: movementSignal.diagnostics.movedBooks,
      calibration: params.calibration
    });

    const topStaleBook = [...staleBooks].sort((a, b) => (b.staleStrength ?? 0) - (a.staleStrength ?? 0))[0];
    const staleSummary = topStaleBook?.staleSummary || "No stale-line signal";

    const explanation = buildOpportunityExplanation({
      outcomeName,
      confidence,
      ranking,
      books: staleBooks,
      staleSummary,
      timingSignal
    });

    const outcome: FairOutcome = {
      name: outcomeName,
      fairProb: weighted,
      fairAmerican,
      consensusDirection: consensusDirection(weighted),
      bestPrice: staleBooks.find((row) => row.isBestPrice)?.priceAmerican ?? staleBooks[0]?.priceAmerican ?? 0,
      bestBook: staleBooks.find((row) => row.isBestPrice)?.title ?? staleBooks[0]?.title ?? "",
      opportunityScore: ranking.score,
      confidenceScore: confidence.score,
      confidenceLabel: confidence.label,
      confidenceNotes: confidence.notes,
      confidenceBreakdown: confidence.breakdown,
      staleStrength: ranking.staleStrength,
      staleSummary,
      staleDiagnostics: {
        topBookKey: topStaleBook?.bookKey ?? "",
        topBookTitle: topStaleBook?.title ?? "",
        topFlag: topStaleBook?.staleFlag ?? "none",
        topStrength: topStaleBook?.staleStrength ?? 0,
        thresholdUsed: params.calibration.stale.thresholds.stalePriceStrength
      },
      sharpParticipationPct: confidence.sharpParticipation,
      movementSummary: movementSignal.summary,
      movementQuality: movementSignal.quality,
      movementDiagnostics: movementSignal.diagnostics,
      timingSignal,
      sharpDeviation: ranking.sharpDeviation,
      explanation,
      rankingBreakdown: ranking.breakdown,
      rankingReasons: ranking.reasons,
      pinnedActionability: {
        bestPinnedBookKey: null,
        bestPinnedBookTitle: null,
        bestPinnedEdgePct: 0,
        bestPinnedEvPct: 0,
        pinnedStaleStrength: 0,
        pinnedScore: 0,
        actionable: false,
        globalBestBookKey: staleBooks.find((row) => row.bookKey === ranking.bestBookKey)?.bookKey ?? "",
        globalBestBookTitle: staleBooks.find((row) => row.bookKey === ranking.bestBookKey)?.title ?? "",
        globalBestEdgePct: ranking.bestEdgePct,
        globalPriceAvailableInPinned: false
      },
      evReliability,
      books: staleBooks
    };

    outcome.pinnedActionability = buildPinnedActionability(outcome, params.calibration);

    staleBooks.forEach((row) => uniqueBooks.add(row.bookKey));
    maxAbsEdge = Math.max(maxAbsEdge, localMax);
    outcomes.push(outcome);
  }

  const topOutcome = [...outcomes].sort((a, b) => b.opportunityScore - a.opportunityScore)[0];
  const avgConfidence = outcomes.length > 0 ? outcomes.reduce((sum, outcome) => sum + outcome.confidenceScore, 0) / outcomes.length : 0;

  return {
    id: params.group.signature === "moneyline" ? params.baseId : `${params.baseId}:${params.group.signature}`,
    baseEventId: params.baseId,
    commenceTime: params.normalized.event.commenceTime,
    homeTeam: params.normalized.event.home.name,
    awayTeam: params.normalized.event.away.name,
    homeLogoUrl: params.normalized.event.home.logoUrl,
    awayLogoUrl: params.normalized.event.away.logoUrl,
    sportKey: params.sportKey,
    market: params.market,
    linePoint: params.group.linePoint,
    bookCount: uniqueBooks.size,
    contributingBookCount: params.group.books.length,
    totalBookCount: params.totalBookCount,
    maxAbsEdgePct: maxAbsEdge,
    opportunityScore: topOutcome?.opportunityScore ?? 0,
    confidenceScore: avgConfidence,
    confidenceLabel: topOutcome?.confidenceLabel ?? "Moderate Confidence",
    staleStrength: topOutcome?.staleStrength ?? 0,
    timingLabel: topOutcome?.timingSignal.label ?? "Weak timing signal",
    rankingSummary: topOutcome?.explanation ?? "No ranking summary available.",
    excludedBooks: params.excludedBooks,
    outcomes
  };
}

export function buildFairEventsForNormalizedEvent(options: {
  normalized: NormalizedEventOdds;
  sportKey: string;
  market: MarketKey;
  model?: WeightModel;
  minBooks?: number;
  includeBooks?: Set<string> | null;
  calibration?: OddsCalibration;
}): FairEvent[] {
  const calibration = options.calibration ?? getOddsCalibration();
  const model = normalizeModel(options.model);
  const minBooks = Math.max(1, options.minBooks ?? DEFAULT_MIN_BOOKS);
  const includeBooks = normalizeIncludedBooks(options.includeBooks);
  const marketRows = toBookRows({
    event: options.normalized,
    market: options.market,
    model,
    includeBooks
  });
  const groups = groupBooksByPoint({ rows: marketRows.rows, market: options.market });
  const centerPoint = options.market === "h2h" ? null : marketCenterPoint(groups);

  return groups
    .filter((group) => group.books.length >= minBooks)
    .map((group) => {
      const excludedBySignature = marketRows.rows
        .filter((row) => !group.books.some((included) => included.bookKey === row.bookKey))
        .map((row) => ({
          bookKey: row.bookKey,
          title: row.title,
          reason: "point_mismatch" as const
        }));
      const excludedBooks = [...marketRows.excluded, ...excludedBySignature];
      const event = buildFairEvent({
        baseId: options.normalized.event.id,
        normalized: options.normalized,
        sportKey: options.sportKey,
        market: options.market,
        group,
        totalBookCount: marketRows.totalBookCount,
        excludedBooks,
        calibration
      });
      if (!event) return null;
      return {
        event,
        group,
        bookCoverage: group.books.length,
        marketMakingCoverage: marketMakingCoverageScore(group),
        qualityScore: qualityCoverageScore(group),
        consensusShare: marketRows.rows.length > 0 ? group.books.length / marketRows.rows.length : 0,
        pointDistance: centerPoint === null ? 0 : Math.abs((group.linePoint ?? centerPoint) - centerPoint)
      };
    })
    .filter(
      (
        entry
      ): entry is {
        event: FairEvent;
        group: GroupedMarket;
        bookCoverage: number;
        marketMakingCoverage: number;
        qualityScore: number;
        consensusShare: number;
        pointDistance: number;
      } => Boolean(entry)
    )
    .sort((a, b) => {
      const consensusDiff = b.bookCoverage - a.bookCoverage;
      if (consensusDiff) return consensusDiff;
      const marketMakingDiff = b.marketMakingCoverage - a.marketMakingCoverage;
      if (marketMakingDiff) return marketMakingDiff;
      const qualityDiff = b.qualityScore - a.qualityScore;
      if (qualityDiff) return qualityDiff;
      const shareDiff = b.consensusShare - a.consensusShare;
      if (shareDiff) return shareDiff;
      const centerDiff = a.pointDistance - b.pointDistance;
      if (centerDiff) return centerDiff;
      return b.event.maxAbsEdgePct - a.event.maxAbsEdgePct;
    })
    .map((entry) => entry.event);
}

export function getMarketAvailabilityForBoard(options: {
  normalized: NormalizedEventOdds[];
  model?: WeightModel;
  minBooks?: number;
  includeBooks?: Set<string> | null;
}): MarketAvailability[] {
  const model = normalizeModel(options.model);
  const minBooks = Math.max(1, options.minBooks ?? DEFAULT_MIN_BOOKS);
  const includeBooks = normalizeIncludedBooks(options.includeBooks);
  const limitedMinBooks = Math.min(minBooks, LIMITED_MARKET_MIN_BOOKS);

  return MARKET_ORDER.map((market) => {
    let feedEventCount = 0;
    let comparableEventCount = 0;
    let qualifiedEventCount = 0;
    let comparableBookCount = 0;
    let qualifiedBookCount = 0;

    for (const event of options.normalized) {
      if (rawMarketPresence(event, market, includeBooks)) {
        feedEventCount += 1;
      }

      const marketRows = toBookRows({
        event,
        market,
        model,
        includeBooks
      });
      const groups = groupBooksByPoint({ rows: marketRows.rows, market });
      const maxGroupCoverage = groups.reduce((max, group) => Math.max(max, group.books.length), 0);

      if (maxGroupCoverage >= limitedMinBooks) {
        comparableEventCount += 1;
        comparableBookCount += maxGroupCoverage;
      }

      if (maxGroupCoverage >= minBooks) {
        qualifiedEventCount += 1;
        qualifiedBookCount += maxGroupCoverage;
      }
    }

    // Larger slates need more than a single qualifying event to look "active";
    // smaller slates stay usable with one fully comparable event.
    const activeEventThreshold = feedEventCount >= 6 ? 2 : 1;
    const activeBookThreshold = activeEventThreshold * minBooks;
    const status =
      qualifiedEventCount >= activeEventThreshold && qualifiedBookCount >= activeBookThreshold
        ? "active"
        : comparableEventCount > 0 || comparableBookCount > 0 || feedEventCount > 0
          ? "limited"
          : "unavailable";

    return {
      market,
      status,
      feedEventCount,
      comparableEventCount,
      qualifiedEventCount
    };
  });
}

export function getActiveMarketsForBoard(options: {
  normalized: NormalizedEventOdds[];
  model?: WeightModel;
  minBooks?: number;
  includeBooks?: Set<string> | null;
}): MarketKey[] {
  return getMarketAvailabilityForBoard(options)
    .filter((entry) => entry.status === "active")
    .map((entry) => entry.market);
}

async function emitValidationSnapshots(params: {
  events: FairEvent[];
  market: MarketKey;
  sportKey: string;
  capturedAtMs: number;
  snapshotRefs: Map<string, SnapshotRef>;
}): Promise<number> {
  const candidates = params.events
    .flatMap((event) =>
      event.outcomes.map((outcome) => ({
        event,
        outcome,
        bestBook: outcome.books.find((book) => book.bookKey === outcome.pinnedActionability.globalBestBookKey) || outcome.books[0]
      }))
    )
    .sort((a, b) => b.outcome.opportunityScore - a.outcome.opportunityScore)
    .slice(0, 120);

  await Promise.all(
    candidates.map(async ({ event, outcome, bestBook }) => {
      const point = bestBook?.point ?? event.linePoint;
      const marketKey = buildOutcomeMarketKey(event.market, outcome.name, point);
      const snapshotRef = params.snapshotRefs.get(snapshotLookupKey(event.id, marketKey));
      await trackValidationEvent({
        id: `${event.id}:${marketKey}:${params.capturedAtMs}`,
        type: "opportunity_snapshot",
        capturedAt: new Date(params.capturedAtMs).toISOString(),
        sportKey: params.sportKey,
        eventId: event.id,
        market: params.market,
        marketKey,
        outcome: outcome.name,
        sideKey: outcome.name,
        commenceTime: event.commenceTime,
        point: point ?? null,
        score: outcome.opportunityScore,
        edgePct: outcome.pinnedActionability.globalBestEdgePct,
        evPct: bestBook?.evPct ?? 0,
        fairPriceAmerican: outcome.fairAmerican,
        fairProb: outcome.fairProb,
        confidenceLabel: outcome.confidenceLabel,
        confidenceScore: outcome.confidenceScore,
        evDefensibility: outcome.evReliability,
        staleFlag: outcome.staleDiagnostics?.topFlag ?? "none",
        staleStrength: outcome.staleStrength,
        timingLabel: outcome.timingSignal.label,
        timingUrgency: outcome.timingSignal.urgencyScore,
        contributingBookCount: event.contributingBookCount,
        totalBookCount: event.totalBookCount,
        sharpParticipationPct: outcome.sharpParticipationPct,
        pinnedBestBookKey: outcome.pinnedActionability.bestPinnedBookKey,
        pinnedBestEdgePct: outcome.pinnedActionability.bestPinnedEdgePct,
        pinnedScore: outcome.pinnedActionability.pinnedScore,
        bestBookKey: bestBook?.bookKey ?? "",
        bestBookPriceAmerican: bestBook?.priceAmerican ?? 0,
        diagnosticsReasons: outcome.rankingReasons || [],
        factorBreakdown: outcome.rankingBreakdown?.componentContributions,
        snapshotRef: snapshotRef || null
      });
    })
  );

  return candidates.length;
}

export async function buildFairBoard(options: BuildFairBoardParams): Promise<FairBoardResponse> {
  const calibration = getOddsCalibration();
  const calibrationMeta = getCalibrationMeta();
  const model = normalizeModel(options.model);
  const minBooks = Math.max(1, options.minBooks ?? DEFAULT_MIN_BOOKS);
  const includeBooks = normalizeIncludedBooks(options.includeBooks);
  const marketAvailability = getMarketAvailabilityForBoard({
    normalized: options.normalized,
    model,
    minBooks,
    includeBooks
  });
  const activeMarkets = marketAvailability.filter((entry) => entry.status === "active").map((entry) => entry.market);

  const booksDirectory = new Map<string, { title: string; tier: FairBoardResponse["books"][number]["tier"] }>();
  const events: FairEvent[] = [];

  for (const normalized of options.normalized) {
    const normalizedEvents = buildFairEventsForNormalizedEvent({
      normalized,
      sportKey: options.sportKey,
      market: options.market,
      model,
      minBooks,
      includeBooks,
      calibration
    });
    for (const event of normalizedEvents) {
      events.push(event);
      event.outcomes.forEach((outcome) => {
        outcome.books.forEach((book) => booksDirectory.set(book.bookKey, { title: book.title, tier: book.tier }));
      });
    }
  }

  events.sort((a, b) => Date.parse(a.commenceTime) - Date.parse(b.commenceTime));

  const nowIso = new Date().toISOString();
  const books = Array.from(booksDirectory.entries())
    .map(([key, value]) => ({ key, title: value.title, tier: value.tier }))
    .sort((a, b) => a.title.localeCompare(b.title));
  const sharpBooksUsed = books.filter((book) => book.tier === "sharp").map((book) => book.title);

  const topOpportunities = events
    .flatMap((event) =>
      event.outcomes.map((outcome) => ({
        eventId: event.id,
        matchup: `${event.awayTeam} @ ${event.homeTeam}`,
        outcome: outcome.name,
        score: outcome.opportunityScore,
        confidenceLabel: outcome.confidenceLabel,
        staleSummary: outcome.staleSummary,
        edgePct: outcome.pinnedActionability.globalBestEdgePct,
        bestBook: outcome.bestBook,
        timingLabel: outcome.timingSignal.label,
        pinnedActionable: outcome.pinnedActionability.actionable,
        pinnedScore: outcome.pinnedActionability.pinnedScore
      }))
    )
    .sort((a, b) => Math.abs(b.edgePct) - Math.abs(a.edgePct) || b.score - a.score)
    .slice(0, 12);

  const capturedAtMs = Date.now();
  const snapshotRefs = await persistBoardSnapshots({
    sportKey: options.sportKey,
    events,
    capturedAt: capturedAtMs
  });
  const emittedEvents = await emitValidationSnapshots({
    events,
    market: options.market,
    sportKey: options.sportKey,
    capturedAtMs,
    snapshotRefs
  });
  const validationSummary: ValidationTrackingSummary = {
    emittedEvents,
    sink: getValidationSinkMode()
  };

  return {
    ok: true,
    league: options.league,
    sportKey: options.sportKey,
    market: options.market,
    model,
    updatedAt: nowIso,
    lastUpdatedLabel: formatWindowLabel(options.timeWindowHours),
    activeMarkets,
    marketAvailability,
    sharpBooksUsed,
    books,
    events,
    topOpportunities,
    bookBehavior: summarizeBookBehavior(events, calibration),
    diagnostics: {
      calibration,
      calibrationMeta,
      validation: validationSummary
    },
    disclaimer: FAIR_BOARD_DISCLAIMER
  };
}
