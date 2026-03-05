"use client";

import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { FairBoardResponse, FairEvent, FairOutcomeBook } from "@/lib/server/odds/types";

const LEAGUES = [
  { key: "nba", label: "NBA" },
  { key: "nfl", label: "NFL" },
  { key: "nhl", label: "NHL" },
  { key: "ncaab", label: "NCAAB" },
  { key: "mlb", label: "MLB" }
] as const;

const MARKETS = [
  { key: "h2h", label: "Moneyline" },
  { key: "spreads", label: "Spread" },
  { key: "totals", label: "Total" }
] as const;

type SortKey = "soonest" | "edge" | "best";

function formatAmerican(price: number): string {
  return price > 0 ? `+${price}` : `${price}`;
}

function setParam(router: ReturnType<typeof useRouter>, searchParams: URLSearchParams, key: string, value: string) {
  const next = new URLSearchParams(searchParams.toString());
  next.set(key, value);
  router.replace(`/?${next.toString()}`);
}

function bookInitials(title: string): string {
  return title
    .split(" ")
    .slice(0, 2)
    .map((chunk) => chunk[0]?.toUpperCase() || "")
    .join("");
}

function edgeHeatStyle(edgePct: number): React.CSSProperties {
  const clamped = Math.max(-4, Math.min(4, edgePct));
  const alpha = Math.abs(clamped) / 8;
  if (clamped > 0) {
    return { backgroundColor: `rgba(122, 239, 195, ${0.08 + alpha})` };
  }
  if (clamped < 0) {
    return { backgroundColor: `rgba(245, 102, 102, ${0.08 + alpha})` };
  }
  return {};
}

function marketSparkline(event: FairEvent): number[] {
  const firstOutcome = event.outcomes[0];
  if (!firstOutcome) return [];

  const openBest = Math.max(
    ...firstOutcome.books.map((book) => book.movement?.openPrice ?? book.priceAmerican),
    firstOutcome.bestPrice
  );
  const prevBest = Math.max(
    ...firstOutcome.books.map((book) => book.movement?.prevPrice ?? book.priceAmerican),
    firstOutcome.bestPrice
  );
  const currentBest = Math.max(
    ...firstOutcome.books.map((book) => book.movement?.currentPrice ?? book.priceAmerican),
    firstOutcome.bestPrice
  );

  return [openBest, prevBest, currentBest];
}

function Sparkline({ values }: { values: number[] }) {
  if (values.length < 2) return <div className="sparkline-placeholder">--</div>;

  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  const points = values
    .map((value, idx) => {
      const x = (idx / (values.length - 1)) * 100;
      const y = 100 - ((value - min) / range) * 100;
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <svg viewBox="0 0 100 100" className="sparkline" role="img" aria-label="Line movement sparkline">
      <polyline points={points} fill="none" stroke="currentColor" strokeWidth="6" strokeLinecap="round" />
      {values.map((value, idx) => {
        const x = (idx / (values.length - 1)) * 100;
        const y = 100 - ((value - min) / range) * 100;
        return <circle key={`${idx}-${value}`} cx={x} cy={y} r={4} />;
      })}
    </svg>
  );
}

function FairBestMicrobar({ fairProb, bestBookProb }: { fairProb: number; bestBookProb: number }) {
  const fairPct = Math.max(0, Math.min(100, fairProb * 100));
  const bestPct = Math.max(0, Math.min(100, bestBookProb * 100));
  const edge = (bestBookProb - fairProb) * 100;

  return (
    <div className="microbar-wrap" title="Edge = implied(best) vs implied(fair)">
      <div className="microbar-track">
        <span className="microbar-fair" style={{ left: `${fairPct}%` }} />
        <span className="microbar-best" style={{ left: `${bestPct}%` }} />
      </div>
      <small className={Math.abs(edge) >= 1 ? "edge-badge" : "muted"}>{edge.toFixed(2)}%</small>
    </div>
  );
}

function bestBookProb(outcomes: FairOutcomeBook[]): number {
  const best = outcomes.find((row) => row.isBestPrice) || outcomes[0];
  return best?.impliedProbNoVig || 0.5;
}

export function OddsGridClient({
  board,
  league,
  windowKey
}: {
  board: FairBoardResponse;
  league: string;
  windowKey: "today" | "next24";
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [sortBy, setSortBy] = useState<SortKey>("edge");
  const [search, setSearch] = useState("");
  const [selectedEvent, setSelectedEvent] = useState<FairEvent | null>(null);
  const [bookFilter, setBookFilter] = useState<Set<string>>(new Set());
  const [showBookMenu, setShowBookMenu] = useState(false);
  const [showBestOnly, setShowBestOnly] = useState(false);
  const [condensed, setCondensed] = useState(false);

  const visibleBooks = useMemo(() => {
    if (bookFilter.size === 0) return board.books;
    return board.books.filter((book) => bookFilter.has(book.key));
  }, [board.books, bookFilter]);

  const filteredEvents = useMemo(() => {
    const query = search.trim().toLowerCase();
    let events = board.events;

    if (query) {
      events = events.filter((event) => `${event.awayTeam} ${event.homeTeam}`.toLowerCase().includes(query));
    }

    events = events.filter((event) => {
      if (bookFilter.size === 0) return true;
      return event.outcomes.some((outcome) => outcome.books.some((row) => bookFilter.has(row.bookKey)));
    });

    if (sortBy === "soonest") {
      return [...events].sort((a, b) => Date.parse(a.commenceTime) - Date.parse(b.commenceTime));
    }

    if (sortBy === "best") {
      return [...events].sort((a, b) => {
        const aBest = Math.max(...a.outcomes.map((outcome) => outcome.bestPrice));
        const bBest = Math.max(...b.outcomes.map((outcome) => outcome.bestPrice));
        return bBest - aBest;
      });
    }

    return [...events].sort((a, b) => b.maxAbsEdgePct - a.maxAbsEdgePct);
  }, [board.events, bookFilter, search, sortBy]);

  return (
    <main className="grid-shell">
      <header className="grid-topbar">
        <div className="brand">
          <div className="logo-mark" aria-hidden>
            <span className="logo-bar" />
            <span className="logo-arc" />
          </div>
          <div>
            <strong>EmpirePicks</strong>
            <p>Odds Grid + Sharp-Weighted Fair Line</p>
          </div>
        </div>

        <div className="toolbar-controls">
          <div className="league-tabs">
            {LEAGUES.map((item) => (
              <button
                key={item.key}
                className={league === item.key ? "active" : ""}
                onClick={() => setParam(router, new URLSearchParams(searchParams?.toString() || ""), "league", item.key)}
              >
                {item.label}
              </button>
            ))}
          </div>

          <div className="league-tabs">
            {MARKETS.map((item) => (
              <button
                key={item.key}
                className={board.market === item.key ? "active" : ""}
                onClick={() => setParam(router, new URLSearchParams(searchParams?.toString() || ""), "market", item.key)}
              >
                {item.label}
              </button>
            ))}
          </div>

          <div className="league-tabs">
            <button
              className={windowKey === "today" ? "active" : ""}
              onClick={() => setParam(router, new URLSearchParams(searchParams?.toString() || ""), "window", "today")}
            >
              Today
            </button>
            <button
              className={windowKey === "next24" ? "active" : ""}
              onClick={() => setParam(router, new URLSearchParams(searchParams?.toString() || ""), "window", "next24")}
            >
              Next 24h
            </button>
          </div>

          <div className="league-tabs">
            <button
              className={board.model === "sharp" ? "active" : ""}
              onClick={() => setParam(router, new URLSearchParams(searchParams?.toString() || ""), "model", "sharp")}
              title="Fair line is a weighted blend of sharper books"
            >
              Sharp-weighted fair
            </button>
            <button
              className={board.model === "equal" ? "active" : ""}
              onClick={() => setParam(router, new URLSearchParams(searchParams?.toString() || ""), "model", "equal")}
            >
              Equal-weighted fair
            </button>
          </div>

          <button className="refresh-btn" onClick={() => router.refresh()}>
            Refresh
          </button>
        </div>
      </header>

      <section className="summary-strip">
        <div>
          <strong>{filteredEvents.length}</strong>
          <span> games</span>
        </div>
        <div>
          <strong>{board.lastUpdatedLabel}</strong>
          <span> last updated</span>
        </div>
        <div>
          <strong>{visibleBooks.length}</strong>
          <span> books visible</span>
        </div>
      </section>

      <section className="controls-row">
        <input
          className="search"
          placeholder="Search teams"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />

        <select className="sort-select" value={sortBy} onChange={(event) => setSortBy(event.target.value as SortKey)}>
          <option value="edge">Sort: Highest edge</option>
          <option value="soonest">Sort: Soonest start</option>
          <option value="best">Sort: Best price</option>
        </select>

        <div className="toggle-group">
          <button className={showBestOnly ? "active" : ""} onClick={() => setShowBestOnly((value) => !value)}>
            Show only best price
          </button>
          <button className={condensed ? "active" : ""} onClick={() => setCondensed((value) => !value)}>
            Condensed rows
          </button>
        </div>

        <div className="book-picker">
          <button className="book-picker-btn" onClick={() => setShowBookMenu((open) => !open)}>
            Books ({visibleBooks.length})
          </button>
          {showBookMenu ? (
            <div className="book-picker-menu">
              {board.books.map((book) => {
                const active = bookFilter.size === 0 || bookFilter.has(book.key);
                return (
                  <label key={book.key}>
                    <input
                      type="checkbox"
                      checked={active}
                      onChange={() => {
                        setBookFilter((prev) => {
                          const next = new Set(prev);
                          if (next.size === 0) board.books.forEach((entry) => next.add(entry.key));
                          if (next.has(book.key)) next.delete(book.key);
                          else next.add(book.key);
                          if (next.size === board.books.length || next.size === 0) return new Set();
                          return next;
                        });
                      }}
                    />
                    <span className="book-logo-pill">{bookInitials(book.title)}</span>
                    <span>{book.title}</span>
                  </label>
                );
              })}
            </div>
          ) : null}
        </div>
      </section>

      <section className="odds-grid-wrap desktop-only">
        <table className={`odds-grid ${condensed ? "condensed" : ""}`}>
          <thead>
            <tr>
              <th className="sticky-col">Matchup</th>
              <th title="Edge = implied(best) vs implied(fair)">Fair</th>
              <th>Best</th>
              {visibleBooks.map((book) => (
                <th key={book.key}>{book.title}</th>
              ))}
            </tr>
          </thead>

          <tbody>
            {filteredEvents.map((event) => (
              <tr key={event.id} onClick={() => setSelectedEvent(event)}>
                <td className="sticky-col">
                  <div className="matchup-cell">
                    <strong>{event.awayTeam}</strong>
                    <strong>{event.homeTeam}</strong>
                    <small>{new Date(event.commenceTime).toLocaleString()}</small>
                    <Sparkline values={marketSparkline(event)} />
                    <button
                      className="quick-action"
                      onClick={(e) => {
                        e.stopPropagation();
                        const first = event.outcomes[0];
                        const best = first?.books.find((row) => row.isBestPrice);
                        if (!best) return;
                        navigator.clipboard.writeText(
                          `${event.awayTeam} @ ${event.homeTeam} ${first.name} ${formatAmerican(best.priceAmerican)} (${best.title})`
                        );
                      }}
                    >
                      Copy line
                    </button>
                  </div>
                </td>

                <td>
                  {event.outcomes.map((outcome) => (
                    <div key={`${event.id}-fair-${outcome.name}`} className="dual-line">
                      <span>{outcome.name}</span>
                      <strong>{formatAmerican(outcome.fairAmerican)}</strong>
                      <FairBestMicrobar fairProb={outcome.fairProb} bestBookProb={bestBookProb(outcome.books)} />
                    </div>
                  ))}
                </td>

                <td>
                  {event.outcomes.map((outcome) => (
                    <div key={`${event.id}-best-${outcome.name}`} className="dual-line">
                      <span>{outcome.name}</span>
                      <strong>{formatAmerican(outcome.bestPrice)}</strong>
                      <small className="best-chip">Best · {outcome.bestBook}</small>
                    </div>
                  ))}
                </td>

                {visibleBooks.map((book) => (
                  <td key={`${event.id}-${book.key}`}>
                    {event.outcomes.map((outcome) => {
                      const row = outcome.books.find((item) => item.bookKey === book.key);
                      if (!row) {
                        return (
                          <div key={`${event.id}-${book.key}-${outcome.name}`} className="dual-line muted">
                            --
                          </div>
                        );
                      }

                      if (showBestOnly && !row.isBestPrice) {
                        return (
                          <div key={`${event.id}-${book.key}-${outcome.name}`} className="dual-line muted">
                            --
                          </div>
                        );
                      }

                      return (
                        <div
                          key={`${event.id}-${book.key}-${outcome.name}`}
                          className="dual-line"
                          style={edgeHeatStyle(row.edgePct)}
                        >
                          <strong className={row.isBestPrice ? "best-highlight" : ""}>{formatAmerican(row.priceAmerican)}</strong>
                          {row.isBestPrice ? <small className="best-chip">Best</small> : null}
                          <small className={Math.abs(row.edgePct) >= 1 ? "edge-badge" : "muted"}>{row.edgePct.toFixed(2)}%</small>
                        </div>
                      );
                    })}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="mobile-cards mobile-only">
        {filteredEvents.map((event) => (
          <article key={`mobile-${event.id}`} className="mobile-card" onClick={() => setSelectedEvent(event)}>
            <div className="mobile-card-head">
              <div>
                <strong>{event.awayTeam} @ {event.homeTeam}</strong>
                <small>{new Date(event.commenceTime).toLocaleString()}</small>
              </div>
              <Sparkline values={marketSparkline(event)} />
            </div>

            <div className="mobile-lines">
              {event.outcomes.map((outcome) => (
                <div key={`mobile-${event.id}-${outcome.name}`}>
                  <div className="dual-line">
                    <span>{outcome.name}</span>
                    <strong>{formatAmerican(outcome.bestPrice)}</strong>
                    <small className="best-chip">{outcome.bestBook}</small>
                  </div>
                  <FairBestMicrobar fairProb={outcome.fairProb} bestBookProb={bestBookProb(outcome.books)} />
                </div>
              ))}
            </div>
          </article>
        ))}
      </section>

      {selectedEvent ? (
        <aside className="detail-drawer">
          <div className="detail-head">
            <strong>
              {selectedEvent.awayTeam} @ {selectedEvent.homeTeam}
            </strong>
            <button onClick={() => setSelectedEvent(null)}>Close</button>
          </div>

          <p className="muted">
            {new Date(selectedEvent.commenceTime).toLocaleString()} · {selectedEvent.market.toUpperCase()}
            {selectedEvent.linePoint !== undefined ? ` ${selectedEvent.linePoint}` : ""}
          </p>

          <section className="detail-section">
            <h4>Line movement (best by phase)</h4>
            <Sparkline values={marketSparkline(selectedEvent)} />
          </section>

          {selectedEvent.outcomes.map((outcome) => (
            <section key={`${selectedEvent.id}-${outcome.name}`} className="detail-section">
              <h4>{outcome.name}</h4>
              <p className="muted">
                Fair: {formatAmerican(outcome.fairAmerican)} ({(outcome.fairProb * 100).toFixed(2)}%)
              </p>
              <div className="detail-table">
                {outcome.books.map((book) => (
                  <div
                    key={`${selectedEvent.id}-${outcome.name}-${book.bookKey}`}
                    className="detail-row"
                    style={edgeHeatStyle(book.edgePct)}
                  >
                    <span>{book.title}</span>
                    <strong>{formatAmerican(book.priceAmerican)}</strong>
                    <small>{book.edgePct.toFixed(2)}% edge</small>
                  </div>
                ))}
              </div>
            </section>
          ))}

          <p className="muted">{board.disclaimer}</p>
        </aside>
      ) : null}
    </main>
  );
}
