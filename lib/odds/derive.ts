import type { DerivedGame, DerivedSide, MarketKey, NormalizedEventOdds } from "./schemas";

function impliedProbAmerican(price: number): number {
  if (price === 0) return 0;
  if (price > 0) return 100 / (price + 100);
  return (-price) / ((-price) + 100);
}

function clamp01(x: number): number {
  return Math.max(0, Math.min(1, x));
}

function variance(xs: number[]): number {
  if (xs.length <= 1) return 0;
  const mean = xs.reduce((a, b) => a + b, 0) / xs.length;
  return xs.reduce((acc, x) => acc + (x - mean) * (x - mean), 0) / (xs.length - 1);
}

function confidenceLabel(bookCount: number, varP: number, recencySec: number): DerivedSide["confidence"] {
  const varScore = varP < 0.0008 ? 1 : varP < 0.002 ? 0.6 : 0.3;
  const bookScore = bookCount >= 8 ? 1 : bookCount >= 5 ? 0.7 : 0.4;
  const recScore = recencySec <= 45 ? 1 : recencySec <= 120 ? 0.7 : 0.4;
  const score = 0.4 * bookScore + 0.35 * varScore + 0.25 * recScore;
  if (score >= 0.75) return "High";
  if (score >= 0.5) return "Medium";
  return "Low";
}

type MovementState = {
  openByKey: Record<string, number>;
  prevByKey: Record<string, number>;
};

function movementKey(gameId: string, market: MarketKey, sideLabel: string): string {
  return `${gameId}|${market}|${sideLabel}`;
}

type Entry = {
  book: {
    key: string;
    title: string;
    weight: number;
    isSharpWeighted: boolean;
  };
  snapshot: {
    lastUpdate: string;
    outcomes: { name: string; price: number }[];
  };
};

export function deriveGames(params: {
  normalized: NormalizedEventOdds[];
  movementState: MovementState;
  nowIso?: string;
}): { games: DerivedGame[]; newMovementState: MovementState } {
  const now = params.nowIso ? new Date(params.nowIso) : new Date();
  const newOpen = { ...params.movementState.openByKey };
  const newPrev = { ...params.movementState.prevByKey };

  const derived: DerivedGame[] = params.normalized.map((g) => {
    const markets: DerivedGame["markets"] = [];
    const byMarket = new Map<MarketKey, Entry[]>();

    for (const b of g.books) {
      for (const m of b.markets) {
        const list = byMarket.get(m.market) || [];
        list.push({
          book: {
            key: b.book.key,
            title: b.book.title,
            weight: b.book.weight,
            isSharpWeighted: b.book.isSharpWeighted
          },
          snapshot: {
            lastUpdate: m.lastUpdate,
            outcomes: m.outcomes.map((o) => ({ name: o.name, price: o.price }))
          }
        });
        byMarket.set(m.market, list);
      }
    }

    for (const [market, entries] of byMarket.entries()) {
      const labels = new Set<string>();
      for (const e of entries) for (const o of e.snapshot.outcomes) labels.add(o.name);

      const sides: DerivedSide[] = [];

      for (const label of labels) {
        let best: { bookKey: string; bookTitle: string; price: number } | null = null;
        const probsEqual: number[] = [];
        const probsWeighted: { p: number; w: number; bookKey: string; bookTitle: string }[] = [];
        const sharpDrivers: { bookKey: string; bookTitle: string; weight: number }[] = [];
        let latestUpdateMs = 0;

        for (const e of entries) {
          const out = e.snapshot.outcomes.find((o) => o.name === label);
          if (!out) continue;

          const p = impliedProbAmerican(out.price);
          probsEqual.push(p);
          probsWeighted.push({ p, w: e.book.weight, bookKey: e.book.key, bookTitle: e.book.title });

          if (e.book.isSharpWeighted) {
            sharpDrivers.push({ bookKey: e.book.key, bookTitle: e.book.title, weight: e.book.weight });
          }

          const candidate = out.price;
          const better =
            !best ||
            (candidate > 0 && (best.price <= 0 || candidate > best.price)) ||
            (candidate < 0 && best.price < 0 && candidate > best.price);

          if (better) best = { bookKey: e.book.key, bookTitle: e.book.title, price: candidate };

          const lu = Date.parse(e.snapshot.lastUpdate || "");
          if (!Number.isNaN(lu)) latestUpdateMs = Math.max(latestUpdateMs, lu);
        }

        if (!best || probsEqual.length === 0) continue;

        const sumEqual = probsEqual.reduce((a, b) => a + b, 0) || 1;
        const pEqualNoVig = clamp01(
          probsEqual.reduce((a, b) => a + (b / sumEqual), 0) / Math.max(1, probsEqual.length)
        );

        const wSum = probsWeighted.reduce((a, x) => a + x.w, 0) || 1;
        const pWeighted = clamp01(probsWeighted.reduce((a, x) => a + x.p * x.w, 0) / wSum);

        const leanPct = (pWeighted - pEqualNoVig) * 100;
        const bestImplied = impliedProbAmerican(best.price);
        const evPct = (pWeighted - bestImplied) * 100;

        const recencySec = latestUpdateMs ? Math.max(0, Math.floor((now.getTime() - latestUpdateMs) / 1000)) : 9999;
        const varP = variance(probsEqual);
        const conf = confidenceLabel(probsEqual.length, varP, recencySec);

        const mk = movementKey(g.event.id, market, label);
        const current = best.price;
        if (newOpen[mk] === undefined) newOpen[mk] = current;
        const prev = newPrev[mk];

        const deltaCents = prev !== undefined ? current - prev : 0;
        const moveCents = current - newOpen[mk];

        let icon: "up" | "down" | "bolt" | "flat" = "flat";
        if (Math.abs(deltaCents) >= 15) icon = "bolt";
        else if (deltaCents > 0) icon = "up";
        else if (deltaCents < 0) icon = "down";

        newPrev[mk] = current;

        sides.push({
          label,
          bestPrice: best,
          consensusProb: pWeighted,
          fairProb: pWeighted,
          evPct,
          confidence: conf,
          confidenceWhy: { books: probsEqual.length, variance: varP, recencySec },
          leanPct,
          sharpDrivers: sharpDrivers.slice(0, 3),
          movement: {
            openPrice: newOpen[mk],
            currentPrice: current,
            prevPrice: prev,
            deltaCents,
            moveCents,
            icon
          }
        });
      }

      markets.push({ market, sides: sides.sort((a, b) => b.evPct - a.evPct) });
    }

    return { event: g.event, markets, updatedAt: g.fetchedAt };
  });

  return { games: derived, newMovementState: { openByKey: newOpen, prevByKey: newPrev } };
}
