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
type HistoryWindowKey = "15m" | "1h" | "6h" | "24h";
type ChartView = "best" | "top_books";

const HISTORY_WINDOWS: Array<{ key: HistoryWindowKey; label: string; ms: number }> = [
  { key: "15m", label: "15m", ms: 15 * 60 * 1000 },
  { key: "1h", label: "1h", ms: 60 * 60 * 1000 },
  { key: "6h", label: "6h", ms: 6 * 60 * 60 * 1000 },
  { key: "24h", label: "24h", ms: 24 * 60 * 60 * 1000 }
];
const CHART_COLORS = ["#56cfff", "#7aefc3", "#ffd36a", "#f59666"];

type ChartSeries = {
  id: string;
  label: string;
  color: string;
  points: Array<{ ts: number; priceAmerican: number }>;
};

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

function windowMs(key: HistoryWindowKey): number {
  return HISTORY_WINDOWS.find((entry) => entry.key === key)?.ms ?? 24 * 60 * 60 * 1000;
}

function pointsForBook(book: FairOutcomeBook, windowRangeMs: number): Array<{ ts: number; priceAmerican: number }> {
  const raw = book.movement?.history || [];
  if (!raw.length) return [];

  const parsed = raw
    .map((entry) => ({
      ts: Date.parse(entry.ts),
      priceAmerican: entry.priceAmerican
    }))
    .filter((entry) => Number.isFinite(entry.ts) && Number.isFinite(entry.priceAmerican));
  if (!parsed.length) return [];

  const latestTs = parsed.reduce((max, item) => Math.max(max, item.ts), 0);
  const minTs = latestTs - windowRangeMs;
  const sliced = parsed.filter((item) => item.ts >= minTs);
  return sliced.length ? sliced : parsed;
}

function buildOutcomeSeries(outcome: FairEvent["outcomes"][number], view: ChartView, windowRangeMs: number): ChartSeries[] {
  const ranked = [...outcome.books]
    .filter((book) => (book.movement?.history?.length || 0) > 0)
    .sort((a, b) => b.weight - a.weight || Number(b.isBestPrice) - Number(a.isBestPrice));
  if (!ranked.length) return [];

  const selected = view === "best" ? [ranked.find((book) => book.isBestPrice) || ranked[0]] : ranked.slice(0, 3);
  return selected.map((book, index) => ({
    id: `${book.bookKey}-${outcome.name}`,
    label: book.title,
    color: CHART_COLORS[index % CHART_COLORS.length],
    points: pointsForBook(book, windowRangeMs)
  }));
}

function rowSeriesForEvent(event: FairEvent, windowRangeMs: number): ChartSeries[] {
  const firstOutcome = event.outcomes[0];
  if (!firstOutcome) return [];
  return buildOutcomeSeries(firstOutcome, "best", windowRangeMs).slice(0, 1);
}

function Sparkline({ series, compact = true }: { series: ChartSeries[]; compact?: boolean }) {
  const usable = series.filter((entry) => entry.points.length >= 2);
  if (!usable.length) return <div className="sparkline-placeholder">--</div>;

  const allPoints = usable.flatMap((entry) => entry.points);
  const minTs = Math.min(...allPoints.map((entry) => entry.ts));
  const maxTs = Math.max(...allPoints.map((entry) => entry.ts));
  const minPrice = Math.min(...allPoints.map((entry) => entry.priceAmerican));
  const maxPrice = Math.max(...allPoints.map((entry) => entry.priceAmerican));
  const tsRange = Math.max(1, maxTs - minTs);
  const priceRange = Math.max(1, maxPrice - minPrice);

  const height = compact ? 26 : 86;
  const width = 100;
  const strokeWidth = compact ? 2.8 : 1.8;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className={compact ? "sparkline" : "sparkline-lg"}
      role="img"
      aria-label="Odds movement history"
    >
      {usable.map((entry) => {
        const polyline = entry.points
          .map((point) => {
            const x = ((point.ts - minTs) / tsRange) * width;
            const y = height - ((point.priceAmerican - minPrice) / priceRange) * height;
            return `${x},${y}`;
          })
          .join(" ");
        const last = entry.points[entry.points.length - 1];
        const lastX = ((last.ts - minTs) / tsRange) * width;
        const lastY = height - ((last.priceAmerican - minPrice) / priceRange) * height;
        return (
          <g key={entry.id}>
            <polyline
              points={polyline}
              fill="none"
              stroke={entry.color}
              strokeWidth={strokeWidth}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <circle cx={lastX} cy={lastY} r={compact ? 2.4 : 1.9} fill={entry.color} />
          </g>
        );
      })}
    </svg>
  );
}

function SeriesLegend({ series }: { series: ChartSeries[] }) {
  const visible = series.filter((item) => item.points.length >= 2);
  if (visible.length <= 1) return null;
  return (
    <div className="series-legend">
      {visible.map((item) => (
        <span key={item.id}>
          <i style={{ backgroundColor: item.color }} />
          {item.label}
        </span>
      ))}
    </div>
  );
}

function formatLastPointTs(series: ChartSeries[]): string {
  const lastTs = series
    .flatMap((entry) => entry.points)
    .reduce((max, point) => Math.max(max, point.ts), 0);
  if (!lastTs) return "--";
  return new Date(lastTs).toLocaleTimeString();
}

function HistoryControls({
  historyWindow,
  setHistoryWindow,
  chartView,
  setChartView
}: {
  historyWindow: HistoryWindowKey;
  setHistoryWindow: (next: HistoryWindowKey) => void;
  chartView: ChartView;
  setChartView: (next: ChartView) => void;
}) {
  return (
    <div className="history-controls">
      <div className="toggle-group">
        {HISTORY_WINDOWS.map((entry) => (
          <button
            key={entry.key}
            className={historyWindow === entry.key ? "active" : ""}
            onClick={() => setHistoryWindow(entry.key)}
          >
            {entry.label}
          </button>
        ))}
      </div>
      <div className="toggle-group">
        <button className={chartView === "best" ? "active" : ""} onClick={() => setChartView("best")}>
          Best book line
        </button>
        <button className={chartView === "top_books" ? "active" : ""} onClick={() => setChartView("top_books")}>
          Top books
        </button>
      </div>
    </div>
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
  const [historyWindow, setHistoryWindow] = useState<HistoryWindowKey>("6h");
  const [chartView, setChartView] = useState<ChartView>("best");

  const historyWindowRangeMs = useMemo(() => windowMs(historyWindow), [historyWindow]);

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

        <HistoryControls
          historyWindow={historyWindow}
          setHistoryWindow={setHistoryWindow}
          chartView={chartView}
          setChartView={setChartView}
        />

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
                    <Sparkline series={rowSeriesForEvent(event, historyWindowRangeMs)} />
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
              <Sparkline series={rowSeriesForEvent(event, historyWindowRangeMs)} />
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
            <h4>Movement history</h4>
            <p className="muted">Snapshots are persisted per event/market/outcome/book and deduped by unchanged prices.</p>
            <HistoryControls
              historyWindow={historyWindow}
              setHistoryWindow={setHistoryWindow}
              chartView={chartView}
              setChartView={setChartView}
            />
          </section>

          {selectedEvent.outcomes.map((outcome) => (
            <section key={`${selectedEvent.id}-${outcome.name}`} className="detail-section">
              <h4>{outcome.name}</h4>
              <p className="muted">
                Fair: {formatAmerican(outcome.fairAmerican)} ({(outcome.fairProb * 100).toFixed(2)}%)
              </p>
              {(() => {
                const series = buildOutcomeSeries(outcome, chartView, historyWindowRangeMs);
                return (
                  <div className="detail-history">
                    <Sparkline series={series} compact={false} />
                    <SeriesLegend series={series} />
                    <small className="muted">Last snapshot: {formatLastPointTs(series)}</small>
                  </div>
                );
              })()}
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
