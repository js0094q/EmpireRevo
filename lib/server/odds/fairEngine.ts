import type { FairBoardResponse, FairEvent, FairOutcomeBook } from "@/lib/server/odds/types";
import type { LeagueKey, NormalizedEventOdds } from "@/lib/odds/schemas";
import { impliedProbFromAmerican, americanFromProb, devigTwoWay, edgePct } from "@/lib/server/odds/fairMath";

const BOOK_WEIGHTS: Record<string, number> = {
  pinnacle: 1.6,
  circa: 1.5,
  betcris: 1.3,
  draftkings: 1.0,
  fanduel: 1.0,
  betmgm: 1.0,
  caesars: 1.0,
  default: 0.8
};

function getWeight(bookKey: string, model: "sharp" | "equal"): number {
  if (model === "equal") return 1;
  return BOOK_WEIGHTS[bookKey] ?? BOOK_WEIGHTS.default;
}

function median(values: number[]): number | undefined {
  if (!values.length) return undefined;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) return (sorted[mid - 1] + sorted[mid]) / 2;
  return sorted[mid];
}

function chooseMainPoint(points: number[]): number | undefined {
  return median(points.filter((point) => Number.isFinite(point)));
}

function bestPrice(prices: number[]): number {
  return prices.reduce((best, price) => (price > best ? price : best), -99999);
}

export function buildFairBoard(params: {
  normalized: NormalizedEventOdds[];
  league: LeagueKey;
  sportKey: string;
  market: "h2h" | "spreads" | "totals";
  model: "sharp" | "equal";
  minBooks: number;
  includeBooks?: Set<string>;
  timeWindowHours: number;
}): FairBoardResponse {
  const {
    normalized,
    league,
    sportKey,
    market,
    model,
    minBooks,
    includeBooks,
    timeWindowHours
  } = params;

  const now = Date.now();
  const maxTs = now + timeWindowHours * 60 * 60 * 1000;

  const events: FairEvent[] = [];
  const booksSeen = new Map<string, string>();

  for (const event of normalized) {
    const commenceTs = Date.parse(event.event.commenceTime);
    if (!Number.isFinite(commenceTs) || commenceTs < now || commenceTs > maxTs) continue;

    const marketBooks = event.books
      .map((book) => ({
        book,
        market: book.markets.find((m) => m.market === market)
      }))
      .filter((entry) => Boolean(entry.market))
      .filter((entry) => (includeBooks && includeBooks.size > 0 ? includeBooks.has(entry.book.book.key) : true));

    if (marketBooks.length < minBooks) continue;

    for (const entry of marketBooks) {
      booksSeen.set(entry.book.book.key, entry.book.book.title);
    }

    const outcomeNames = new Set<string>();
    for (const entry of marketBooks) {
      for (const outcome of entry.market!.outcomes) {
        outcomeNames.add(outcome.name);
      }
    }

    if (outcomeNames.size < 2) continue;

    const orderedNames = Array.from(outcomeNames).slice(0, 2);

    const allPoints: number[] = [];
    if (market !== "h2h") {
      for (const entry of marketBooks) {
        for (const outcome of entry.market!.outcomes) {
          if (outcome.point !== undefined) allPoints.push(outcome.point);
        }
      }
    }

    const linePoint = chooseMainPoint(allPoints);

    const perBook = marketBooks
      .map((entry) => {
        const outcomes = orderedNames
          .map((name) =>
            entry.market!.outcomes.find(
              (candidate) => candidate.name === name && (linePoint === undefined || candidate.point === linePoint)
            ) || entry.market!.outcomes.find((candidate) => candidate.name === name)
          )
          .filter(Boolean);

        if (outcomes.length !== 2) return null;

        const p1 = impliedProbFromAmerican(outcomes[0]!.price);
        const p2 = impliedProbFromAmerican(outcomes[1]!.price);
        const noVig = devigTwoWay(p1, p2);

        return {
          bookKey: entry.book.book.key,
          title: entry.book.book.title,
          weight: getWeight(entry.book.book.key, model),
          lastUpdate: entry.market!.lastUpdate,
          outcomes: [
            {
              name: outcomes[0]!.name,
              priceAmerican: outcomes[0]!.price,
              point: outcomes[0]!.point,
              pNoVig: noVig.p1NoVig
            },
            {
              name: outcomes[1]!.name,
              priceAmerican: outcomes[1]!.price,
              point: outcomes[1]!.point,
              pNoVig: noVig.p2NoVig
            }
          ]
        };
      })
      .filter(Boolean);

    if (perBook.length < minBooks) continue;

    const fairByOutcome = orderedNames.map((name, idx) => {
      const weighted = perBook.reduce(
        (acc, book) => {
          const out = book!.outcomes[idx];
          acc.num += book!.weight * out.pNoVig;
          acc.den += book!.weight;
          return acc;
        },
        { num: 0, den: 0 }
      );
      const fairProb = weighted.den > 0 ? weighted.num / weighted.den : 0.5;
      return { name, fairProb };
    });

    const outcomePayload = fairByOutcome.map((fair, idx) => {
      const bookRows: FairOutcomeBook[] = perBook.map((book) => {
        const out = book!.outcomes[idx];
        return {
          bookKey: book!.bookKey,
          title: book!.title,
          weight: book!.weight,
          priceAmerican: out.priceAmerican,
          impliedProbNoVig: out.pNoVig,
          edgePct: edgePct(out.pNoVig, fair.fairProb),
          isBestPrice: false,
          point: out.point,
          lastUpdate: book!.lastUpdate
        };
      });

      const best = bestPrice(bookRows.map((row) => row.priceAmerican));
      const bestRow = bookRows.find((row) => row.priceAmerican === best);
      for (const row of bookRows) {
        if (row.priceAmerican === best) row.isBestPrice = true;
      }

      return {
        name: fair.name,
        fairProb: fair.fairProb,
        fairAmerican: americanFromProb(fair.fairProb),
        consensusDirection: (fair.fairProb > 0.52
          ? "favored"
          : fair.fairProb < 0.48
            ? "underdog"
            : "neutral") as "favored" | "underdog" | "neutral",
        bestPrice: best,
        bestBook: bestRow?.title || "",
        books: bookRows
      };
    });

    const maxAbsEdgePct = Math.max(
      ...outcomePayload.flatMap((outcome) => outcome.books.map((book) => Math.abs(book.edgePct))),
      0
    );

    events.push({
      id: event.event.id,
      commenceTime: event.event.commenceTime,
      homeTeam: event.event.home.name,
      awayTeam: event.event.away.name,
      sportKey,
      market,
      linePoint,
      bookCount: perBook.length,
      maxAbsEdgePct,
      outcomes: outcomePayload
    });
  }

  const books = Array.from(booksSeen.entries()).map(([key, title]) => ({ key, title }));

  return {
    ok: true,
    league,
    sportKey,
    market,
    model,
    updatedAt: new Date().toISOString(),
    lastUpdatedLabel: new Date().toLocaleTimeString(),
    books,
    events,
    disclaimer: "Market intelligence only. Sharp-weighted market consensus is not a guaranteed outcome."
  };
}
