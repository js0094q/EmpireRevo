import type {
  BoardFeedItem,
  DerivedGame,
  DerivedSide,
  DriverRef,
  MarketKey,
  NormalizedEventOdds
} from "@/lib/odds/schemas";
import {
  buildPriceVsFairMetrics,
  classifyOpportunityStrength,
  computeActionableValueScore,
  deriveRecommendationBadge
} from "@/lib/odds/priceValue";
import { compareOffersByMarket } from "@/lib/server/odds/marketCompare";
import { calculateEvPercent } from "@/lib/server/odds/ev";
import { americanFromProb } from "@/lib/server/odds/fairMath";

type MovementState = {
  openByKey: Record<string, number>;
  prevByKey: Record<string, number>;
};

type OutcomeProb = {
  label: string;
  pNoVig: number;
  price: number;
  point?: number;
};

type MarketBookView = {
  book: {
    key: string;
    title: string;
    weight: number;
    isSharpWeighted: boolean;
  };
  market: MarketKey;
  lastUpdate: string;
  outcomes: OutcomeProb[];
};

function impliedProbAmerican(price: number): number {
  if (!Number.isFinite(price) || price === 0) return 0;
  if (price > 0) return 100 / (price + 100);
  return -price / (-price + 100);
}

function clamp01(input: number): number {
  return Math.max(0, Math.min(1, input));
}

function variance(values: number[]): number {
  if (values.length <= 1) return 0;
  const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
  const sq = values.reduce((sum, val) => sum + (val - mean) ** 2, 0);
  return sq / (values.length - 1);
}

function confidenceLabel(bookCount: number, varianceP: number, recencySec: number): DerivedSide["confidence"] {
  const booksScore = bookCount >= 8 ? 1 : bookCount >= 5 ? 0.7 : 0.4;
  const varianceScore = varianceP < 0.0008 ? 1 : varianceP < 0.002 ? 0.65 : 0.3;
  const recencyScore = recencySec <= 45 ? 1 : recencySec <= 120 ? 0.7 : 0.35;
  const score = 0.4 * booksScore + 0.35 * varianceScore + 0.25 * recencyScore;
  if (score >= 0.75) return "High";
  if (score >= 0.5) return "Medium";
  return "Low";
}

function movementKey(gameId: string, market: MarketKey, label: string): string {
  return `${gameId}|${market}|${label}`;
}

function chooseBestPrice(params: {
  market: MarketKey;
  outcomeName: string;
  current: { price: number; point?: number } | null;
  candidate: { price: number; point?: number };
}): boolean {
  if (!params.current) return true;
  // Keep derive-path line selection consistent with fair engine:
  // market-aware point/price comparison, not raw American price sorting.
  return (
    compareOffersByMarket(
      params.market,
      params.outcomeName,
      {
        point: params.candidate.point,
        priceAmerican: params.candidate.price
      },
      {
        point: params.current.point,
        priceAmerican: params.current.price
      }
    ) < 0
  );
}

function normalizeBookMarket(entry: {
  market: MarketKey;
  lastUpdate: string;
  outcomes: { name: string; price: number; point?: number }[];
}): { market: MarketKey; lastUpdate: string; outcomes: OutcomeProb[] } {
  const outcomes = entry.outcomes
    .filter((outcome) => Number.isFinite(outcome.price) && outcome.name)
    .map((outcome) => ({
      label: outcome.name,
      implied: impliedProbAmerican(outcome.price),
      price: outcome.price,
      point: outcome.point
    }));

  const total = outcomes.reduce((sum, outcome) => sum + outcome.implied, 0);
  const safeTotal = total > 0 ? total : 1;

  return {
    market: entry.market,
    lastUpdate: entry.lastUpdate,
    outcomes: outcomes.map((outcome) => ({
      label: outcome.label,
      pNoVig: clamp01(outcome.implied / safeTotal),
      price: outcome.price,
      point: outcome.point
    }))
  };
}

function topEv(game: DerivedGame): number {
  return game.markets.flatMap((market) => market.sides).reduce((max, side) => Math.max(max, side.evPct), -999);
}

function sideActionableValueScore(side: DerivedSide): number {
  const fairPrice = americanFromProb(side.fairProb);
  const marketImpliedProb = impliedProbAmerican(side.bestPrice.price);
  const metrics = buildPriceVsFairMetrics({
    marketPriceAmerican: side.bestPrice.price,
    fairPriceAmerican: fairPrice,
    marketImpliedProb,
    fairImpliedProb: side.fairProb
  });
  const strength = classifyOpportunityStrength({
    marketPrice: metrics.marketPriceAmerican,
    fairPrice: metrics.fairPriceAmerican,
    marketImpliedProb: metrics.marketImpliedProb,
    fairImpliedProb: metrics.fairImpliedProb,
    probabilityGapPctPoints: metrics.probabilityGapPct,
    priceValueDirection: metrics.priceValueDirection
  });
  const badge = deriveRecommendationBadge({
    priceValueDirection: metrics.priceValueDirection,
    strength
  });
  let score = computeActionableValueScore({
    marketPrice: metrics.marketPriceAmerican,
    fairPrice: metrics.fairPriceAmerican,
    marketImpliedProb: metrics.marketImpliedProb,
    fairImpliedProb: metrics.fairImpliedProb,
    probabilityGapPctPoints: metrics.probabilityGapPct,
    priceValueDirection: metrics.priceValueDirection
  });
  if (badge === "best_value") score += 5;
  if (badge === "longshot_price_advantage") score -= 4;
  if (badge === "model_lean") score -= 2;
  return score;
}

function topActionableScore(game: DerivedGame): number {
  return game.markets
    .flatMap((market) => market.sides)
    .reduce((max, side) => Math.max(max, sideActionableValueScore(side)), Number.NEGATIVE_INFINITY);
}

function topConfidence(game: DerivedGame): number {
  return game.markets
    .flatMap((market) => market.sides)
    .reduce((score, side) => Math.max(score, side.confidence === "High" ? 3 : side.confidence === "Medium" ? 2 : 1), 0);
}

export function deriveGames(params: {
  normalized: NormalizedEventOdds[];
  movementState: MovementState;
  nowIso?: string;
}): { games: DerivedGame[]; newMovementState: MovementState } {
  const now = params.nowIso ? new Date(params.nowIso) : new Date();
  const nextOpen = { ...params.movementState.openByKey };
  const nextPrev = { ...params.movementState.prevByKey };

  const games: DerivedGame[] = params.normalized.map((game) => {
    const byMarket = new Map<MarketKey, MarketBookView[]>();

    for (const book of game.books) {
      for (const market of book.markets) {
        const normalizedMarket = normalizeBookMarket({
          market: market.market,
          lastUpdate: market.lastUpdate,
          outcomes: market.outcomes.map((outcome) => ({ name: outcome.name, price: outcome.price, point: outcome.point }))
        });

        const list = byMarket.get(market.market) || [];
        list.push({
          book: {
            key: book.book.key,
            title: book.book.title,
            weight: book.book.weight,
            isSharpWeighted: book.book.isSharpWeighted
          },
          market: market.market,
          lastUpdate: normalizedMarket.lastUpdate,
          outcomes: normalizedMarket.outcomes
        });
        byMarket.set(market.market, list);
      }
    }

    const markets: DerivedGame["markets"] = [];

    for (const [marketKey, entries] of byMarket.entries()) {
      const labels = new Set<string>();
      for (const entry of entries) {
        for (const outcome of entry.outcomes) labels.add(outcome.label);
      }

      const sides: DerivedSide[] = [];

      for (const label of labels) {
        const probsEqual: number[] = [];
        const probsWeighted: Array<{ p: number; w: number; key: string; title: string }> = [];
        const probsSharp: Array<{ p: number; w: number; key: string; title: string }> = [];
        let best: { bookKey: string; bookTitle: string; price: number; point?: number } | null = null;
        let latestUpdateMs = 0;

        for (const entry of entries) {
          const outcome = entry.outcomes.find((candidate) => candidate.label === label);
          if (!outcome) continue;

          probsEqual.push(outcome.pNoVig);
          probsWeighted.push({
            p: outcome.pNoVig,
            w: entry.book.weight,
            key: entry.book.key,
            title: entry.book.title
          });
          if (entry.book.isSharpWeighted) {
            probsSharp.push({
              p: outcome.pNoVig,
              w: entry.book.weight,
              key: entry.book.key,
              title: entry.book.title
            });
          }

          if (
            chooseBestPrice({
              market: marketKey,
              outcomeName: label,
              current: best ? { price: best.price, point: best.point } : null,
              candidate: { price: outcome.price, point: outcome.point }
            })
          ) {
            best = {
              bookKey: entry.book.key,
              bookTitle: entry.book.title,
              price: outcome.price,
              point: outcome.point
            };
          }

          const updateMs = Date.parse(entry.lastUpdate || "");
          if (!Number.isNaN(updateMs)) latestUpdateMs = Math.max(latestUpdateMs, updateMs);
        }

        if (!best || probsEqual.length === 0) continue;

        const equalWeightedProb = clamp01(probsEqual.reduce((sum, p) => sum + p, 0) / probsEqual.length);
        const totalWeighted = probsWeighted.reduce((sum, item) => sum + item.w, 0) || 1;
        const weightedProb = clamp01(probsWeighted.reduce((sum, item) => sum + item.p * item.w, 0) / totalWeighted);

        const sharpSource = probsSharp.length > 0 ? probsSharp : probsWeighted;
        const sharpDenominator = sharpSource.reduce((sum, item) => sum + item.w, 0) || 1;
        const sharpWeightedProb = clamp01(
          sharpSource.reduce((sum, item) => sum + item.p * item.w, 0) / sharpDenominator
        );

        const leanPct = (sharpWeightedProb - equalWeightedProb) * 100;
        // Use canonical EV math shared across the codebase:
        // EV% = (fairProb * decimalOdds) - 1.
        const evPct = calculateEvPercent(weightedProb, best.price);

        const varianceP = variance(probsEqual);
        const recencySec = latestUpdateMs ? Math.max(0, Math.floor((now.getTime() - latestUpdateMs) / 1000)) : 9999;
        const confidence = confidenceLabel(probsEqual.length, varianceP, recencySec);

        const topDrivers: DriverRef[] = sharpSource
          .sort((a, b) => b.w * b.p - a.w * a.p)
          .slice(0, 3)
          .map((item) => ({
            bookKey: item.key,
            bookTitle: item.title,
            weight: item.w
          }));

        const key = movementKey(game.event.id, marketKey, label);
        const current = best.price;
        if (nextOpen[key] === undefined) nextOpen[key] = current;
        const prev = nextPrev[key];
        const deltaCents = prev === undefined ? 0 : current - prev;
        const moveCents = current - nextOpen[key];

        let icon: "up" | "down" | "bolt" | "flat" = "flat";
        if (Math.abs(deltaCents) >= 15) icon = "bolt";
        else if (deltaCents > 0) icon = "up";
        else if (deltaCents < 0) icon = "down";

        nextPrev[key] = current;

        sides.push({
          label,
          bestPrice: best,
          consensusProb: weightedProb,
          fairProb: weightedProb,
          evPct,
          confidence,
          confidenceWhy: {
            books: probsEqual.length,
            variance: varianceP,
            recencySec
          },
          leanPct,
          sharpDrivers: topDrivers,
          explain: {
            equalWeightedProb,
            sharpWeightedProb,
            leanPct,
            bookCount: probsEqual.length,
            variance: varianceP,
            recencySec,
            topDrivers
          },
          movement: {
            openPrice: nextOpen[key],
            currentPrice: current,
            prevPrice: prev,
            deltaCents,
            moveCents,
            icon
          }
        });
      }

      markets.push({
        market: marketKey,
        sides: sides.sort((a, b) => b.evPct - a.evPct)
      });
    }

    return {
      event: game.event,
      markets,
      updatedAt: game.fetchedAt
    };
  });

  return {
    games,
    newMovementState: {
      openByKey: nextOpen,
      prevByKey: nextPrev
    }
  };
}

export function selectComingUp(games: DerivedGame[], windowHours: number): DerivedGame[] {
  const now = Date.now();
  const latestStart = now + windowHours * 60 * 60 * 1000;

  return games
    .filter((game) => {
      const start = Date.parse(game.event.commenceTime);
      return Number.isFinite(start) && start >= now && start <= latestStart;
    })
    .sort((a, b) => Date.parse(a.event.commenceTime) - Date.parse(b.event.commenceTime))
    .slice(0, 3);
}

export function selectBestValue(games: DerivedGame[]): DerivedGame[] {
  return [...games]
    .sort((a, b) => {
      const actionableDiff = topActionableScore(b) - topActionableScore(a);
      if (Math.abs(actionableDiff) > 0.0001) return actionableDiff;
      const evDiff = topEv(b) - topEv(a);
      if (Math.abs(evDiff) > 0.0001) return evDiff;
      return topConfidence(b) - topConfidence(a);
    })
    .slice(0, 6);
}

export function buildFeed(games: DerivedGame[]): BoardFeedItem[] {
  const out: BoardFeedItem[] = [];
  const nowIso = new Date().toISOString();

  for (const game of games) {
    for (const market of game.markets) {
      for (const side of market.sides) {
        if (side.movement.icon === "bolt") {
          out.push({
            id: `${game.event.id}|${market.market}|${side.label}|rapid`,
            ts: nowIso,
            type: "rapid_move",
            title: `${side.label} moved rapidly`,
            subtitle: `${game.event.away.name} @ ${game.event.home.name} (${market.market.toUpperCase()})`,
            gameId: game.event.id,
            market: market.market,
            confidence: side.confidence
          });
        }

        if (side.evPct >= 1.5) {
          out.push({
            id: `${game.event.id}|${market.market}|${side.label}|ev`,
            ts: nowIso,
            type: "ev_edge",
            title: `${side.label} showing ${side.evPct.toFixed(1)}% EV edge`,
            subtitle: `${game.event.away.name} @ ${game.event.home.name}`,
            gameId: game.event.id,
            market: market.market,
            confidence: side.confidence
          });
        }

        if (Math.abs(side.leanPct) >= 2) {
          out.push({
            id: `${game.event.id}|${market.market}|${side.label}|pressure`,
            ts: nowIso,
            type: "pressure_spike",
            title: `${side.label} pressure spike (${side.leanPct.toFixed(1)}pp lean)`,
            subtitle: `Sharp books diverge from market average in ${market.market.toUpperCase()}`,
            gameId: game.event.id,
            market: market.market,
            confidence: side.confidence
          });
        }
      }
    }
  }

  return out.slice(0, 16);
}
