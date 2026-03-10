import Link from "next/link";
import { fetchFairBoardServer, hasOddsKey } from "@/lib/server/odds/pageData";
import { buildOutcomeMarketKey } from "@/lib/server/odds/snapshotPersistence";
import { buildMarketTimeline } from "@/lib/server/odds/timeline";
import { detectMarketPressureForMarket } from "@/lib/server/odds/marketPressure";
import { getPersistenceStatus } from "@/lib/server/odds/persistence";
import { EventTimelinePanel } from "@/components/board/EventTimelinePanel";

function formatAmerican(price: number): string {
  return price > 0 ? `+${price}` : `${price}`;
}

function formatProb(prob: number): string {
  return `${(prob * 100).toFixed(2)}%`;
}

function formatPoint(point?: number): string {
  if (!Number.isFinite(point)) return "--";
  const value = Number(point);
  return value > 0 ? `+${value}` : `${value}`;
}

export default async function GamePage({
  params,
  searchParams
}: {
  params: Promise<{ eventId: string }>;
  searchParams?: Promise<{ league?: string; market?: string; model?: string }>;
}) {
  const { eventId } = await params;
  const query = (await searchParams) || {};

  if (!hasOddsKey()) {
    return (
      <main className="config-shell">
        <section className="config-card">
          <h1>Configuration Required</h1>
          <p>ODDS_API_KEY is missing. Configure it to view game details.</p>
        </section>
      </main>
    );
  }

  const league = query.league || "nba";
  const market = query.market === "spreads" || query.market === "totals" ? query.market : "h2h";
  const model = query.model === "sharp" || query.model === "equal" || query.model === "weighted" ? query.model : "weighted";

  const board = await fetchFairBoardServer({
    league,
    market,
    model,
    windowHours: 24,
    historyWindowHours: 72
  });

  const event = board.events.find((entry) => entry.id === eventId);

  if (!event) {
    return (
      <main className="grid-shell">
        <p>Game not found in this market window.</p>
        <Link href={`/?league=${league}&market=${market}&model=${model}`}>Back to board</Link>
      </main>
    );
  }

  const persistence = getPersistenceStatus();
  const outcomeTimeline = persistence.durable
    ? await Promise.all(
        event.outcomes.map(async (outcome) => {
          const point = outcome.books[0]?.point ?? event.linePoint;
          const marketKey = buildOutcomeMarketKey(event.market, outcome.name, point);
          const [timeline, pressureSignals] = await Promise.all([
            buildMarketTimeline({
              sportKey: event.sportKey,
              eventId: event.id,
              marketKey,
              rollingPoints: 200
            }),
            detectMarketPressureForMarket({
              sportKey: event.sportKey,
              eventId: event.id,
              marketKey
            })
          ]);

          return {
            outcomeName: outcome.name,
            timeline,
            pressureSignals
          };
        })
      )
    : [];
  const timelineByOutcome = new Map(outcomeTimeline.map((entry) => [entry.outcomeName, entry]));

  return (
    <main className="grid-shell">
      <Link href={`/?league=${league}&market=${market}&model=${model}`}>Back to board</Link>
      <h1>
        {event.awayTeam} @ {event.homeTeam}
      </h1>
      <p className="muted">
        {new Date(event.commenceTime).toLocaleString()} · {event.market.toUpperCase()} · Score {event.opportunityScore.toFixed(1)} · {event.confidenceLabel}
      </p>

      <section className="detail-section">
        <h3>Market Summary</h3>
        <div className="detail-table">
          <div className="detail-row slim">
            <span>Opportunity Score</span>
            <small>{event.opportunityScore.toFixed(1)}</small>
          </div>
          <div className="detail-row slim">
            <span>Confidence</span>
            <small>{event.confidenceLabel} ({event.confidenceScore.toFixed(2)})</small>
          </div>
          <div className="detail-row slim">
            <span>Book Participation</span>
            <small>{event.contributingBookCount}/{event.totalBookCount} contributing books</small>
          </div>
          <div className="detail-row slim">
            <span>Stale-line Strength</span>
            <small>{event.staleStrength.toFixed(2)}</small>
          </div>
          <div className="detail-row slim">
            <span>Market Timing</span>
            <small>{event.timingLabel}</small>
          </div>
          <div className="detail-row slim">
            <span>Why This Ranks Here</span>
            <small>{event.rankingSummary}</small>
          </div>
        </div>
      </section>

      {event.excludedBooks.length ? (
        <section className="detail-section">
          <h3>Book Participation</h3>
          <div className="detail-table">
            {event.excludedBooks.map((book) => (
              <div key={`${event.id}-${book.bookKey}`} className="detail-row slim">
                <span>{book.title}</span>
                <small>{book.reason === "point_mismatch" ? "Excluded: equivalent-line mismatch" : "Excluded: market unavailable"}</small>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {event.outcomes.map((outcome) => (
        <section key={outcome.name} className="detail-section">
          <h3>{outcome.name}</h3>
          <p className="muted">{outcome.explanation}</p>
          <div className="detail-table">
            <div className="detail-row slim">
              <span>Opportunity Diagnostics</span>
              <small>Fair Price {formatAmerican(outcome.fairAmerican)} · Fair Prob {formatProb(outcome.fairProb)} · Score {outcome.opportunityScore.toFixed(1)}</small>
            </div>
            <div className="detail-row slim">
              <span>Confidence Drivers</span>
              <small>{outcome.confidenceLabel} ({outcome.confidenceScore.toFixed(2)}) · {outcome.confidenceNotes.join(" · ")}</small>
            </div>
            <div className="detail-row slim">
              <span>Stale-Line Analysis</span>
              <small>{outcome.staleSummary} · Sharp deviation {outcome.sharpDeviation.toFixed(2)}pp</small>
            </div>
            <div className="detail-row slim">
              <span>Market Timing Summary</span>
              <small>{outcome.timingSignal.label} ({outcome.timingSignal.urgencyScore.toFixed(2)}) · {outcome.timingSignal.reasons.join(" · ") || outcome.movementSummary}</small>
            </div>
            <div className="detail-row slim">
              <span>Score Breakdown</span>
              <small>
                Edge {((outcome.rankingBreakdown?.componentContributions.edge || 0) * 100).toFixed(1)} ·
                Confidence {((outcome.rankingBreakdown?.componentContributions.confidence || 0) * 100).toFixed(1)} ·
                Coverage {((outcome.rankingBreakdown?.componentContributions.coverage || 0) * 100).toFixed(1)} ·
                Stale {((outcome.rankingBreakdown?.componentContributions.stale || 0) * 100).toFixed(1)}
              </small>
            </div>
          </div>

          <div className="detail-table">
            {outcome.books.map((book) => (
              <div key={`${outcome.name}-${book.bookKey}`} className="detail-row detail-grid">
                <span>
                  {book.title} <small className="muted">({book.tier}, {book.weight.toFixed(2)}x)</small>
                </span>
                <strong>{event.market === "h2h" ? formatAmerican(book.priceAmerican) : `${formatPoint(book.point)} (${formatAmerican(book.priceAmerican)})`}</strong>
                <small>Implied Prob {formatProb(book.impliedProb)}</small>
                <small>No-Vig Prob {formatProb(book.impliedProbNoVig)}</small>
                <small>Fair Prob {formatProb(outcome.fairProb)}</small>
                <small>Fair Price {formatAmerican(outcome.fairAmerican)}</small>
                <small>Edge {book.edgePct.toFixed(2)}%</small>
                <small>
                  {book.evReliability === "suppressed"
                    ? "Expected Value suppressed for this market context"
                    : book.evQualified
                      ? `Expected Value ${book.evPct.toFixed(2)}%`
                      : `Expected Value ${book.evPct.toFixed(2)}% (qualified)`}
                </small>
                <small>{book.staleSummary || "In line with market"}{book.staleFlag && book.staleFlag !== "none" ? ` · ${book.staleFlag}` : ""}</small>
              </div>
            ))}
          </div>

          <EventTimelinePanel
            outcome={outcome.name}
            timeline={timelineByOutcome.get(outcome.name)?.timeline || null}
            pressureSignals={timelineByOutcome.get(outcome.name)?.pressureSignals || []}
          />
        </section>
      ))}

      <section className="detail-section">
        <h3>Book Responsiveness Summary</h3>
        <div className="detail-table">
          {board.bookBehavior.slice(0, 10).map((row) => (
            <div key={`book-behavior-${row.bookKey}`} className="detail-row slim">
              <span>{row.title} ({row.tier})</span>
              <small>Lag {Math.round(row.lagRate * 100)}% · Stale {Math.round(row.staleRate * 100)}% · Move-first {Math.round(row.moveFirstRate * 100)}% · {row.summary}</small>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
