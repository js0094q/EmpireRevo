"use client";

import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { FairBoardResponse, FairEvent } from "@/lib/server/odds/types";

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
      return visibleBooks.every((book) => event.outcomes.some((outcome) => outcome.books.some((row) => row.bookKey === book.key)));
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
  }, [board.events, bookFilter, visibleBooks, search, sortBy]);

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

        <div className="books-filter">
          {board.books.map((book) => {
            const active = bookFilter.size === 0 || bookFilter.has(book.key);
            return (
              <button
                key={book.key}
                className={active ? "active" : ""}
                onClick={() => {
                  setBookFilter((prev) => {
                    const next = new Set(prev);
                    if (next.size === 0) {
                      board.books.forEach((item) => next.add(item.key));
                    }
                    if (next.has(book.key)) next.delete(book.key);
                    else next.add(book.key);
                    if (next.size === board.books.length || next.size === 0) return new Set();
                    return next;
                  });
                }}
              >
                {book.title}
              </button>
            );
          })}
        </div>
      </section>

      <section className="odds-grid-wrap">
        <table className="odds-grid">
          <thead>
            <tr>
              <th className="sticky-col">Matchup</th>
              <th>Fair</th>
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
                  </div>
                </td>

                <td>
                  {event.outcomes.map((outcome) => (
                    <div key={`${event.id}-fair-${outcome.name}`} className="dual-line">
                      <span>{outcome.name}</span>
                      <strong>{formatAmerican(outcome.fairAmerican)}</strong>
                      <small>{(outcome.fairProb * 100).toFixed(1)}%</small>
                    </div>
                  ))}
                </td>

                <td>
                  {event.outcomes.map((outcome) => (
                    <div key={`${event.id}-best-${outcome.name}`} className="dual-line">
                      <span>{outcome.name}</span>
                      <strong>{formatAmerican(outcome.bestPrice)}</strong>
                      <small>{outcome.bestBook}</small>
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

                      return (
                        <div key={`${event.id}-${book.key}-${outcome.name}`} className="dual-line">
                          <strong className={row.isBestPrice ? "best-highlight" : ""}>{formatAmerican(row.priceAmerican)}</strong>
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

          {selectedEvent.outcomes.map((outcome) => (
            <section key={`${selectedEvent.id}-${outcome.name}`} className="detail-section">
              <h4>{outcome.name}</h4>
              <p className="muted">
                Fair: {formatAmerican(outcome.fairAmerican)} ({(outcome.fairProb * 100).toFixed(2)}%)
              </p>
              <div className="detail-table">
                {outcome.books.map((book) => (
                  <div key={`${selectedEvent.id}-${outcome.name}-${book.bookKey}`} className="detail-row">
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
