"use client";

import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { BoardResponse, DerivedGame } from "@/lib/odds/schemas";
import { Drawer } from "@/lib/ui/components/Drawer";
import { MarketFeed } from "@/lib/ui/components/MarketFeed";
import { MatchupCard } from "@/lib/ui/components/MatchupCard";
import { OddsRow } from "@/lib/ui/components/OddsRow";
import { LEAGUES } from "@/lib/ui/theme";

export function BoardClient({ board }: { board: BoardResponse }) {
  const [selectedGame, setSelectedGame] = useState<DerivedGame | null>(null);
  const [query, setQuery] = useState("");

  const router = useRouter();
  const searchParams = useSearchParams();

  const activeLeague = board.league;

  const filteredGames = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return board.games;

    return board.games.filter((game) => {
      const text = `${game.event.away.name} ${game.event.home.name}`.toLowerCase();
      return text.includes(normalizedQuery);
    });
  }, [board.games, query]);

  return (
    <main className="page-shell">
      <nav className="top-nav">
        <div className="brand">
          <div className="logo-mark" aria-hidden>
            <span className="logo-bar" />
            <span className="logo-arc" />
          </div>
          <div>
            <strong>EmpirePicks</strong>
            <p>Live Market Intelligence</p>
          </div>
        </div>

        <div className="nav-tools">
          <div className="league-tabs">
            {LEAGUES.map((league) => (
              <button
                key={league.key}
                className={league.key === activeLeague ? "active" : ""}
                onClick={() => {
                  const params = new URLSearchParams(searchParams?.toString() || "");
                  params.set("league", league.key);
                  router.replace(`/?${params.toString()}`);
                }}
              >
                {league.label}
              </button>
            ))}
          </div>

          <input
            className="search"
            placeholder="Search teams"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />

          <div className="live-pill">
            <span /> LIVE
          </div>
        </div>
      </nav>

      <section className="hero-note">
        <h1>{board.editorNote.headline}</h1>
        <p>{board.editorNote.body}</p>
        <ul>
          {board.editorNote.watchlist.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
        <small>{board.editorNote.lockLike[0]}</small>
        <p className="disclaimer">{board.meta.disclaimer}</p>
      </section>

      <section>
        <div className="section-head">
          <h2>Coming Up</h2>
          <span className="muted">Next {board.meta.windowHours}h</span>
        </div>

        <div className="coming-up-grid">
          {board.comingUp.map((game) => (
            <MatchupCard key={game.event.id} game={game} onOpen={setSelectedGame} />
          ))}
        </div>
      </section>

      <section className="content-grid">
        <div>
          <div className="section-head">
            <h2>Best Value Now</h2>
            <span className="muted">Weighted edge + confidence</span>
          </div>
          <div className="rows">
            {board.bestValueNow.map((game) => (
              <OddsRow key={game.event.id} game={game} onOpen={setSelectedGame} />
            ))}
          </div>

          <div className="section-head">
            <h2>League Board</h2>
            <span className="muted">{filteredGames.length} games</span>
          </div>
          <div className="rows">
            {filteredGames.map((game) => (
              <OddsRow key={`${game.event.id}-board`} game={game} onOpen={setSelectedGame} />
            ))}
          </div>
        </div>

        <MarketFeed feed={board.feed} />
      </section>

      <Drawer game={selectedGame} onClose={() => setSelectedGame(null)} />
    </main>
  );
}
